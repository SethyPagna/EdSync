import { validateDisplayName } from "@/lib/auth/display-name";
import type { SessionUser } from "@/lib/auth/session";
import { d1Query, type DataFilter, type DataOrder, type DataRequest, type SqlScope } from "@/lib/db/d1";
import { TABLES, type TableName } from "@/lib/db/schema";

type Role = SessionUser["user_metadata"]["role"];
type Row = Record<string, unknown>;
type WriteAction = "insert" | "update" | "delete" | "upsert";
type Denial = { status: 400 | 403; error: string };

export type DataAccessDecision =
  | { allowed: true; request: DataRequest; scope: SqlScope | null }
  | ({ allowed: false } & Denial);

export type ParsedDataRequest = { ok: true; request: DataRequest } | { ok: false; error: string };

type Context = { userId: string; email: string; role: Role; request: DataRequest };

type WritePolicy = {
  roles: readonly Role[];
  actions: readonly WriteAction[];
  /** Columns the caller may set on insert and update. */
  columns: readonly string[];
  /** Columns the caller may set only while creating a row. */
  createOnly?: readonly string[];
  /** Column pinned to the caller's id: filled on insert, never changed afterwards. */
  owner?: string;
  /** Identity columns a write may repeat but never change. */
  pinned?: (ctx: Context) => Row;
  /** Rows an update, delete or upsert may touch. */
  scope: (ctx: Context) => Sql;
  /** Checks (and may normalize) sanitized rows before they are written. */
  prepare?: (ctx: Context, rows: Row[], action: WriteAction) => Promise<Denial | null> | Denial | null;
};

type TablePolicy = {
  read: (ctx: Context) => Sql;
  write?: WritePolicy;
};

class Sql implements SqlScope {
  constructor(
    readonly sql: string,
    readonly params: unknown[],
  ) {}
}

function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((value, index) => {
    if (value instanceof Sql) {
      text += value.sql;
      params.push(...value.params);
    } else {
      text += "?";
      params.push(value);
    }
    text += strings[index + 1];
  });
  return new Sql(text, params);
}

const ANY_ROLE: readonly Role[] = ["student", "teacher", "admin"];
const STAFF: readonly Role[] = ["teacher", "admin"];

const ownLessonIds = (userId: string) => sql`SELECT ol.id FROM lessons ol WHERE ol.teacher_id = ${userId}`;
const ownClassIds = (userId: string) => sql`SELECT oc.id FROM classes oc WHERE oc.teacher_id = ${userId}`;
const enrolledClassIds = (userId: string) =>
  sql`SELECT ec.class_id FROM class_enrollments ec WHERE ec.student_id = ${userId} AND ec.is_active = 1`;
const assignedLessonIds = (userId: string) =>
  sql`SELECT al.lesson_id FROM lesson_assignments al
       WHERE al.is_active = 1 AND (al.student_id = ${userId} OR al.class_id IN (${enrolledClassIds(userId)}))`;
const entitledLessonIds = (userId: string) =>
  sql`SELECT ep.course_id FROM entitlements ee
        JOIN billing_products ep ON ep.id = ee.product_id AND ep.tenant_id = ee.tenant_id
        JOIN tenants et ON et.id = ee.tenant_id
       WHERE ee.user_id = ${userId} AND ee.status = 'active' AND ep.status = 'active' AND et.status = 'active'
         AND ep.course_id IS NOT NULL
         AND (ee.starts_at IS NULL OR datetime(ee.starts_at) <= datetime('now'))
         AND (ee.ends_at IS NULL OR datetime(ee.ends_at) > datetime('now'))`;
const readableLessonIds = (userId: string) =>
  sql`SELECT rl.id FROM lessons rl
       WHERE rl.teacher_id = ${userId}
          OR (rl.status = 'published' AND (rl.id IN (${assignedLessonIds(userId)}) OR rl.id IN (${entitledLessonIds(userId)})))`;

const ownedByStudent = ({ userId }: Context) => sql`student_id = ${userId}`;
const studentOrLessonOwner = ({ userId }: Context) => sql`student_id = ${userId} OR lesson_id IN (${ownLessonIds(userId)})`;
const readableLesson = ({ userId }: Context) => sql`lesson_id IN (${readableLessonIds(userId)})`;
const ownedLesson = ({ userId }: Context) => sql`lesson_id IN (${ownLessonIds(userId)})`;

function forbidden(error: string): Denial {
  return { status: 403, error };
}

function invalid(error: string): Denial {
  return { status: 400, error };
}

function isPlainObject(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function distinct(values: unknown[]) {
  return Array.from(new Set(values));
}

async function everyIdMatches(ids: unknown[], query: (ids: string[]) => Sql) {
  const unique = distinct(ids);
  if (!unique.every((id): id is string => typeof id === "string" && id.length > 0)) return false;
  if (unique.length === 0) return true;
  const statement = query(unique);
  const rows = await d1Query<{ id: string }>(statement.sql, statement.params);
  return new Set(rows.map((row) => row.id)).size === unique.length;
}

/** One JSON parameter instead of one per id: D1 allows at most 100 bound parameters per statement. */
function inList(ids: string[]) {
  return new Sql("SELECT value FROM json_each(?)", [JSON.stringify(ids)]);
}

const lessonsOwnedBy = (userId: string, ids: unknown[]) =>
  everyIdMatches(ids, (unique) => sql`SELECT id FROM lessons WHERE teacher_id = ${userId} AND id IN (${inList(unique)})`);
const classesOwnedBy = (userId: string, ids: unknown[]) =>
  everyIdMatches(ids, (unique) => sql`SELECT id FROM classes WHERE teacher_id = ${userId} AND id IN (${inList(unique)})`);
const lessonsReadableBy = (userId: string, ids: unknown[]) =>
  everyIdMatches(ids, (unique) => sql`SELECT id FROM lessons WHERE id IN (${inList(unique)}) AND id IN (${readableLessonIds(userId)})`);
const sectionsOwnedBy = (userId: string, ids: unknown[]) =>
  everyIdMatches(
    ids,
    (unique) => sql`SELECT s.id FROM lesson_sections s JOIN lessons l ON l.id = s.lesson_id
                     WHERE l.teacher_id = ${userId} AND s.id IN (${inList(unique)})`,
  );

function presentValues(rows: Row[], column: string) {
  return rows.filter((row) => row[column] !== undefined && row[column] !== null).map((row) => row[column]);
}

function requireLessonOwnership(message: string) {
  return async ({ userId }: Context, rows: Row[], action: WriteAction) => {
    if (action === "insert" || action === "upsert") {
      if (!(await lessonsOwnedBy(userId, rows.map((row) => row.lesson_id)))) return forbidden(message);
    }
    return null;
  };
}

function requireReadableLesson(required: boolean) {
  return async ({ userId }: Context, rows: Row[], action: WriteAction) => {
    if (action === "update") return null;
    const lessonIds = required ? rows.map((row) => row.lesson_id) : presentValues(rows, "lesson_id");
    return (await lessonsReadableBy(userId, lessonIds)) ? null : forbidden("That lesson is not available to you.");
  };
}

function isSafeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}

function validateProfileRows(_ctx: Context, rows: Row[]): Denial | null {
  for (const row of rows) {
    if ("full_name" in row) {
      try {
        row.full_name = validateDisplayName(row.full_name);
      } catch (error) {
        return invalid(error instanceof Error ? error.message : "Full name is invalid.");
      }
    }
    if (row.avatar_url != null && !isSafeImageUrl(row.avatar_url)) return invalid("Avatar must be an image link.");
    if (row.preferences != null && !isPlainObject(row.preferences)) return invalid("Preferences must be an object.");
    for (const column of ["subjects", "interests"]) {
      const value = row[column];
      if (value != null && !(Array.isArray(value) && value.every((item) => typeof item === "string"))) {
        return invalid(`${column} must be a list of text.`);
      }
    }
    for (const column of ["school", "grade_level", "last_active_at"]) {
      const value = row[column];
      if (value != null && (typeof value !== "string" || value.length > 200)) return invalid(`${column} must be short text.`);
    }
    if ("streak_days" in row) {
      const streak = row.streak_days;
      if (typeof streak !== "number" || !Number.isInteger(streak) || streak < 0 || streak > 100_000) {
        return invalid("streak_days must be a whole number.");
      }
    }
  }
  return null;
}

function normalizeJoinCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

async function redeemJoinCodes({ userId }: Context, rows: Row[]): Promise<Denial | null> {
  for (const row of rows) {
    const joinCode = normalizeJoinCode(row.join_code);
    delete row.join_code;
    if (!joinCode) return forbidden("Join a class with its join code.");
    const [klass] = await d1Query<{ id: string }>(
      "SELECT id FROM classes WHERE join_code = ? AND is_active = 1 LIMIT 1",
      [joinCode],
    );
    if (!klass || (row.class_id !== undefined && row.class_id !== klass.id)) {
      return forbidden("That join code does not match an active class.");
    }
    row.class_id = klass.id;
    row.student_id = userId;
  }
  return null;
}

function joinCodeLookup(request: DataRequest) {
  const filter = (request.filters ?? []).find((item) => item.op === "eq" && item.column === "join_code");
  const joinCode = normalizeJoinCode(filter?.value);
  return joinCode || null;
}

const LESSON_COLUMNS = [
  "class_id",
  "title",
  "description",
  "objectives",
  "subject",
  "grade_level",
  "status",
  "difficulty",
  "estimated_duration",
  "tags",
  "thumbnail_url",
  "source_url",
  "source_content",
  "ai_generated",
  "complexity_slider",
  "pacing_slider",
  "scaffolding_slider",
  "prerequisites",
  "personalization",
] as const;

const PROGRESS_COLUMNS = [
  "status",
  "current_section_id",
  "sections_completed",
  "score",
  "time_spent",
  "diagnostic_completed",
  "diagnostic_score",
  "final_quiz_score",
  "knowledge_gaps",
  "metadata",
  "started_at",
  "completed_at",
  "last_active",
] as const;

/**
 * Deny-by-default policy for the generic client data API. A table missing here is unavailable;
 * an action, role or column missing from a table's write policy is rejected.
 */
const POLICIES: Partial<Record<TableName, TablePolicy>> = {
  profiles: {
    read: ({ userId }) => sql`id = ${userId}
      OR id IN (SELECT pe.student_id FROM class_enrollments pe JOIN classes pc ON pc.id = pe.class_id WHERE pc.teacher_id = ${userId})
      OR id IN (SELECT pp.student_id FROM student_progress pp JOIN lessons pl ON pl.id = pp.lesson_id WHERE pl.teacher_id = ${userId})
      OR id IN (SELECT tc.teacher_id FROM classes tc JOIN class_enrollments te ON te.class_id = tc.id
                 WHERE te.student_id = ${userId} AND te.is_active = 1)`,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update", "upsert"],
      owner: "id",
      pinned: ({ email, role }) => ({ email, role }),
      columns: [
        "full_name",
        "avatar_url",
        "school",
        "grade_level",
        "subjects",
        "interests",
        "preferences",
        "streak_days",
        "last_active_at",
      ],
      scope: ({ userId }) => sql`id = ${userId}`,
      prepare: validateProfileRows,
    },
  },
  classes: {
    read: (ctx) => {
      const visible = sql`teacher_id = ${ctx.userId} OR id IN (${enrolledClassIds(ctx.userId)})`;
      const joinCode = joinCodeLookup(ctx.request);
      return joinCode ? sql`${visible} OR (join_code = ${joinCode} AND is_active = 1)` : visible;
    },
    write: {
      roles: STAFF,
      actions: ["insert", "update"],
      owner: "teacher_id",
      columns: ["name", "description", "subject", "grade_level", "settings", "is_active"],
      scope: ({ userId }) => sql`teacher_id = ${userId}`,
    },
  },
  class_enrollments: {
    read: ({ userId }) => sql`student_id = ${userId} OR class_id IN (${ownClassIds(userId)})`,
    write: {
      // Admins use the learner workspace ("individual" / "organization-student" view modes) and join classes too.
      roles: ["student", "admin"],
      actions: ["insert", "upsert"],
      owner: "student_id",
      columns: ["class_id", "is_active", "join_code"],
      scope: ownedByStudent,
      prepare: redeemJoinCodes,
    },
  },
  lessons: {
    read: ({ userId }) => sql`id IN (${readableLessonIds(userId)})`,
    write: {
      roles: STAFF,
      actions: ["insert", "update", "delete"],
      owner: "teacher_id",
      columns: LESSON_COLUMNS,
      scope: ({ userId }) => sql`teacher_id = ${userId}`,
      prepare: async ({ userId }, rows) =>
        (await classesOwnedBy(userId, presentValues(rows, "class_id")))
          ? null
          : forbidden("Lessons can only be linked to your own classes."),
    },
  },
  lesson_sections: {
    read: readableLesson,
    write: {
      roles: STAFF,
      actions: ["insert", "update", "delete"],
      createOnly: ["lesson_id"],
      columns: ["title", "content", "content_type", "order_index", "duration_minutes", "is_required", "metadata"],
      scope: ownedLesson,
      prepare: requireLessonOwnership("Lesson content can only be added to your own lessons."),
    },
  },
  quiz_questions: {
    read: readableLesson,
    write: {
      roles: STAFF,
      actions: ["insert", "update", "delete"],
      createOnly: ["lesson_id"],
      columns: [
        "section_id",
        "question_text",
        "question_type",
        "options",
        "correct_answer",
        "explanation",
        "difficulty",
        "points",
        "is_diagnostic",
        "is_micro_check",
        "is_final_quiz",
        "order_index",
      ],
      scope: ownedLesson,
      prepare: async (ctx, rows, action) => {
        const lessonDenied = await requireLessonOwnership("Lesson content can only be added to your own lessons.")(ctx, rows, action);
        if (lessonDenied) return lessonDenied;
        return (await sectionsOwnedBy(ctx.userId, presentValues(rows, "section_id")))
          ? null
          : forbidden("Questions can only be attached to your own lesson blocks.");
      },
    },
  },
  glossary_terms: {
    read: readableLesson,
    write: {
      roles: STAFF,
      actions: ["insert", "update", "delete"],
      createOnly: ["lesson_id"],
      columns: ["term", "definition", "example"],
      scope: ownedLesson,
      prepare: requireLessonOwnership("Lesson content can only be added to your own lessons."),
    },
  },
  lesson_assignments: {
    read: ({ userId }) => sql`assigned_by = ${userId}
      OR lesson_id IN (${ownLessonIds(userId)})
      OR class_id IN (${ownClassIds(userId)})
      OR student_id = ${userId}
      OR class_id IN (${enrolledClassIds(userId)})`,
    write: {
      roles: STAFF,
      actions: ["insert", "update"],
      owner: "assigned_by",
      createOnly: ["lesson_id", "class_id"],
      columns: ["due_date", "is_active"],
      scope: ({ userId }) => sql`assigned_by = ${userId} OR lesson_id IN (${ownLessonIds(userId)})`,
      prepare: async ({ userId }, rows, action) => {
        if (action === "update") return null;
        if (!(await lessonsOwnedBy(userId, rows.map((row) => row.lesson_id)))) {
          return forbidden("Only your own courses can be shared.");
        }
        return (await classesOwnedBy(userId, rows.map((row) => row.class_id)))
          ? null
          : forbidden("Courses can only be shared with your own classes.");
      },
    },
  },
  student_progress: {
    read: studentOrLessonOwner,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update", "upsert"],
      owner: "student_id",
      createOnly: ["lesson_id"],
      columns: PROGRESS_COLUMNS,
      scope: ownedByStudent,
      prepare: requireReadableLesson(true),
    },
  },
  quiz_attempts: {
    read: studentOrLessonOwner,
    write: {
      roles: ANY_ROLE,
      actions: ["insert"],
      owner: "student_id",
      createOnly: ["lesson_id", "question_id"],
      columns: ["answer", "is_correct", "time_taken", "attempt_number"],
      scope: ownedByStudent,
      prepare: requireReadableLesson(true),
    },
  },
  socratic_interactions: {
    read: studentOrLessonOwner,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update"],
      owner: "student_id",
      createOnly: ["lesson_id", "section_id"],
      columns: ["student_question", "hint_response", "hint_type", "conversation_history", "helpful_rating"],
      scope: ownedByStudent,
      prepare: requireReadableLesson(true),
    },
  },
  learning_reflections: {
    read: studentOrLessonOwner,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update", "delete"],
      owner: "student_id",
      createOnly: ["lesson_id"],
      columns: ["confidence", "reflection", "ai_feedback", "next_step"],
      scope: ownedByStudent,
      prepare: requireReadableLesson(false),
    },
  },
  learning_goals: {
    read: ownedByStudent,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update", "delete"],
      owner: "student_id",
      columns: ["title", "target_type", "target_value", "current_value", "is_complete", "due_date", "updated_at"],
      scope: ownedByStudent,
    },
  },
  knowledge_nodes: {
    read: studentOrLessonOwner,
    write: {
      roles: ANY_ROLE,
      actions: ["insert", "update", "upsert", "delete"],
      owner: "student_id",
      createOnly: ["lesson_id"],
      columns: ["concept", "mastery_level", "evidence", "updated_at"],
      scope: ownedByStudent,
      prepare: requireReadableLesson(false),
    },
  },
  teacher_alerts: {
    read: ({ userId }) => sql`teacher_id = ${userId}`,
    write: {
      roles: STAFF,
      actions: ["update"],
      owner: "teacher_id",
      columns: ["is_read", "is_dismissed"],
      scope: ({ userId }) => sql`teacher_id = ${userId}`,
    },
  },
};

function sameIdentity(value: unknown, expected: unknown) {
  if (typeof value === "string" && typeof expected === "string") {
    return value.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return value === expected;
}

function sanitizeRow(ctx: Context, write: WritePolicy, row: Row, creating: boolean): { row: Row } | { denial: Denial } {
  const pinned: Row = { ...(write.pinned?.(ctx) ?? {}), ...(write.owner ? { [write.owner]: ctx.userId } : {}) };
  const next: Row = {};
  for (const [column, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (column in pinned) {
      if (!sameIdentity(value, pinned[column])) return { denial: forbidden(`${column} cannot be changed.`) };
      next[column] = pinned[column];
      continue;
    }
    const writable =
      write.columns.includes(column) || (creating && (column === "id" || Boolean(write.createOnly?.includes(column))));
    if (!writable) return { denial: forbidden(`${column} cannot be written.`) };
    next[column] = value;
  }
  if (creating && write.owner && next[write.owner] === undefined) next[write.owner] = ctx.userId;
  return { row: next };
}

export async function authorizeDataRequest(user: SessionUser, request: DataRequest): Promise<DataAccessDecision> {
  const policy = POLICIES[request.table];
  if (!policy) return { allowed: false, ...forbidden(`${request.table} is not available through the data API.`) };

  const ctx: Context = { userId: user.id, email: user.email, role: user.user_metadata.role, request };
  if (request.action === "select") {
    return { allowed: true, request, scope: ctx.role === "admin" ? null : policy.read(ctx) };
  }
  if (request.action === "rpc") return { allowed: false, ...invalid("Unsupported action.") };

  const write = policy.write;
  if (!write || !write.actions.includes(request.action) || !write.roles.includes(ctx.role)) {
    return { allowed: false, ...forbidden(`You cannot ${request.action} ${request.table}.`) };
  }
  if (request.action === "delete") return { allowed: true, request, scope: write.scope(ctx) };

  const creating = request.action === "insert" || request.action === "upsert";
  const rows: Row[] = [];
  for (const row of Array.isArray(request.values) ? request.values : request.values ? [request.values] : []) {
    const sanitized = sanitizeRow(ctx, write, row, creating);
    if ("denial" in sanitized) return { allowed: false, ...sanitized.denial };
    rows.push(sanitized.row);
  }

  const denied = await write.prepare?.(ctx, rows, request.action);
  if (denied) return { allowed: false, ...denied };

  return {
    allowed: true,
    request: { ...request, values: Array.isArray(request.values) ? rows : rows[0] },
    scope: request.action === "insert" ? null : write.scope(ctx),
  };
}

const ACTIONS = new Set<DataRequest["action"]>(["select", "insert", "update", "delete", "upsert"]);
const FILTER_OPS = new Set<DataFilter["op"]>(["eq", "neq", "gte", "lte", "in", "is", "is_not"]);
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_ROWS = 200;
const MAX_FILTERS = 20;
const MAX_IN_VALUES = 500;

function isScalar(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function parseFilter(value: unknown): DataFilter | string {
  if (!isPlainObject(value)) return "Filters must be objects.";
  const { op, column } = value;
  if (typeof op !== "string" || !FILTER_OPS.has(op as DataFilter["op"])) return "Unsupported filter operator.";
  if (typeof column !== "string" || !IDENTIFIER.test(column)) return "Filter columns must be column names.";
  if (op === "in") {
    if (!Array.isArray(value.value) || value.value.length > MAX_IN_VALUES || !value.value.every(isScalar)) {
      return `in() filters take a list of up to ${MAX_IN_VALUES} values.`;
    }
    return { op, column, value: value.value };
  }
  if (op === "is" || op === "is_not") {
    if (value.value !== null && typeof value.value !== "boolean") return "is() filters accept null, true or false.";
    return { op, column, value: value.value };
  }
  if (!isScalar(value.value)) return "Filter values must be text, numbers, booleans or null.";
  return { op: op as "eq" | "neq" | "gte" | "lte", column, value: value.value };
}

function parseOrder(value: unknown): DataOrder | string {
  if (!isPlainObject(value) || typeof value.column !== "string" || !IDENTIFIER.test(value.column)) {
    return "Order must name a column.";
  }
  if (value.ascending !== undefined && value.ascending !== null && typeof value.ascending !== "boolean") {
    return "Order direction must be a boolean.";
  }
  return { column: value.column, ascending: value.ascending === false ? false : undefined };
}

/** Validates an untrusted /api/data payload and keeps only the fields the executor understands. */
export function parseDataRequest(payload: unknown): ParsedDataRequest {
  const fail = (error: string): ParsedDataRequest => ({ ok: false, error });
  if (!isPlainObject(payload)) return fail("Request body must be an object.");
  const { table, action } = payload;
  if (typeof table !== "string" || !(TABLES as readonly string[]).includes(table)) return fail("Unknown table.");
  if (typeof action !== "string" || !ACTIONS.has(action as DataRequest["action"])) return fail("Unsupported action.");

  const request: DataRequest = { table: table as TableName, action: action as DataRequest["action"] };

  if (payload.columns != null) {
    if (typeof payload.columns !== "string" || payload.columns.length > 1000) return fail("Columns must be text.");
    request.columns = payload.columns;
  }

  if (payload.filters != null) {
    if (!Array.isArray(payload.filters) || payload.filters.length > MAX_FILTERS) {
      return fail(`Use up to ${MAX_FILTERS} filters.`);
    }
    const filters: DataFilter[] = [];
    for (const item of payload.filters) {
      const filter = parseFilter(item);
      if (typeof filter === "string") return fail(filter);
      filters.push(filter);
    }
    request.filters = filters;
  }

  if (payload.order != null) {
    if (!Array.isArray(payload.order) || payload.order.length > 5) return fail("Use up to 5 order columns.");
    const order: DataOrder[] = [];
    for (const item of payload.order) {
      const parsed = parseOrder(item);
      if (typeof parsed === "string") return fail(parsed);
      order.push(parsed);
    }
    request.order = order;
  }

  if (payload.limit != null) {
    if (typeof payload.limit !== "number" || !Number.isInteger(payload.limit) || payload.limit < 0) {
      return fail("Limit must be a whole number.");
    }
    request.limit = payload.limit;
  }

  for (const flag of ["single", "maybeSingle", "head"] as const) {
    if (payload[flag] == null) continue;
    if (typeof payload[flag] !== "boolean") return fail(`${flag} must be a boolean.`);
    request[flag] = payload[flag];
  }

  if (payload.count != null) {
    if (payload.count !== "exact") return fail("Only exact counts are supported.");
    request.count = "exact";
  }

  if (action === "insert" || action === "upsert") {
    const rows = Array.isArray(payload.values) ? payload.values : [payload.values];
    if (rows.length === 0 || rows.length > MAX_ROWS || !rows.every(isPlainObject)) {
      return fail(`Send between 1 and ${MAX_ROWS} rows as objects.`);
    }
    request.values = payload.values as Row | Row[];
  }

  if (action === "update") {
    if (!isPlainObject(payload.values)) return fail("Updates take an object of values.");
    request.values = payload.values;
  }

  if (action === "upsert" && payload.onConflict != null) {
    if (typeof payload.onConflict !== "string" || payload.onConflict.length > 200) return fail("onConflict must be text.");
    request.onConflict = payload.onConflict;
  }

  return { ok: true, request };
}
