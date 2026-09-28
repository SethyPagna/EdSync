// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { executeDataRequest, type DataFilter, type DataRequest } from "@/lib/db/d1";
import {
  ADMIN,
  BUYER,
  OTHER_STUDENT,
  OTHER_TEACHER,
  STUDENT,
  TEACHER,
  createSeededDatabase,
  rowOf,
  sqliteAdapter,
} from "@/lib/db/test-database";
import { authorizeDataRequest, parseDataRequest } from "@/lib/security/data-access";

const adapter = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/d1-adapter", () => ({ getD1QueryAdapter: () => adapter.current }));

let db: DatabaseSync;

beforeEach(() => {
  db = createSeededDatabase();
  adapter.current = sqliteAdapter(db);
});

type Payload = Omit<DataRequest, "filters"> & { filters?: DataFilter[] };

async function run(user: SessionUser, payload: Payload) {
  const parsed = parseDataRequest(JSON.parse(JSON.stringify(payload)));
  if (!parsed.ok) return { status: 400, error: parsed.error, data: null as unknown };
  const decision = await authorizeDataRequest(user, parsed.request);
  if (!decision.allowed) return { status: decision.status, error: decision.error, data: null as unknown };
  const result = await executeDataRequest(decision.request, { scope: decision.scope });
  if (result.error) return { status: result.error.status ?? 500, error: result.error.message, data: null as unknown };
  return { status: 200, error: null, data: result.data as unknown, count: result.count };
}

const eq = (column: string, value: unknown): DataFilter => ({ op: "eq", column, value });
const ids = (data: unknown) => (data as { id: string }[]).map((row) => row.id).sort();
const ALL_PROFILE_IDS = [TEACHER, OTHER_TEACHER, STUDENT, OTHER_STUDENT, BUYER, ADMIN].map((user) => user.id);

describe("profile self-service", () => {
  it("does not let a student promote themselves to teacher", async () => {
    const result = await run(STUDENT, {
      table: "profiles",
      action: "update",
      values: { role: "teacher" },
      filters: [eq("id", STUDENT.id)],
    });

    expect(result).toMatchObject({ status: 403, error: "role cannot be changed." });
    expect(rowOf(db, "profiles", STUDENT.id)?.role).toBe("student");
  });

  it.each([
    ["email", "new@example.com"],
    ["total_xp", 99999],
    ["achievements", ["legend"]],
    ["created_at", "2020-01-01"],
  ])("rejects writes to the privileged %s column", async (column, value) => {
    const result = await run(STUDENT, {
      table: "profiles",
      action: "update",
      values: { [column]: value },
      filters: [eq("id", STUDENT.id)],
    });
    expect(result.status).toBe(403);
  });

  it("saves safe fields on the caller's profile only", async () => {
    const own = await run(STUDENT, {
      table: "profiles",
      action: "update",
      values: { full_name: "  Sam S  ", preferences: { theme: "graphite" } },
      filters: [eq("id", STUDENT.id)],
    });
    expect(own.status).toBe(200);
    expect(own.data).toEqual([expect.objectContaining({ full_name: "Sam S", preferences: { theme: "graphite" } })]);

    const other = await run(STUDENT, {
      table: "profiles",
      action: "update",
      values: { full_name: "Hacked" },
      filters: [eq("id", OTHER_STUDENT.id)],
    });
    expect(other).toMatchObject({ status: 200, data: [] });
    expect(rowOf(db, "profiles", OTHER_STUDENT.id)?.full_name).toBe("Sia Student");
  });

  it("validates profile values", async () => {
    const result = await run(STUDENT, {
      table: "profiles",
      action: "update",
      values: { avatar_url: "javascript:alert(1)" },
      filters: [eq("id", STUDENT.id)],
    });
    expect(result.status).toBe(400);
  });

  it("accepts the signup upsert when identity columns repeat the session values", async () => {
    const result = await run(TEACHER, {
      table: "profiles",
      action: "upsert",
      onConflict: "id",
      values: {
        id: TEACHER.id,
        email: TEACHER.email.toUpperCase(),
        full_name: "Tara T",
        role: "teacher",
        preferences: { theme: "light", text_size: "medium", onboarding_space: "individual" },
        subjects: [],
        interests: [],
      },
    });

    expect(result.status).toBe(200);
    expect(rowOf(db, "profiles", TEACHER.id)).toMatchObject({ email: TEACHER.email, role: "teacher", full_name: "Tara T" });
  });

  it("rejects profile upserts that change the role or target another account", async () => {
    const promote = await run(STUDENT, {
      table: "profiles",
      action: "upsert",
      values: { id: STUDENT.id, email: STUDENT.email, role: "teacher" },
    });
    expect(promote).toMatchObject({ status: 403, error: "role cannot be changed." });

    const hijack = await run(STUDENT, {
      table: "profiles",
      action: "upsert",
      values: { id: OTHER_STUDENT.id, full_name: "Hacked" },
    });
    expect(hijack).toMatchObject({ status: 403, error: "id cannot be changed." });
    expect(rowOf(db, "profiles", OTHER_STUDENT.id)?.full_name).toBe("Sia Student");
  });
});

describe("row scoping on reads", () => {
  it("limits profiles to self, class teachers and the teacher's own learners", async () => {
    const select = (user: SessionUser) =>
      run(user, { table: "profiles", action: "select", columns: "id, full_name, email", filters: [{ op: "in", column: "id", value: ALL_PROFILE_IDS }] });

    expect(ids((await select(STUDENT)).data)).toEqual([STUDENT.id, TEACHER.id]);
    expect(ids((await select(TEACHER)).data)).toEqual([STUDENT.id, TEACHER.id]);
    expect(ids((await select(OTHER_TEACHER)).data)).toEqual([OTHER_STUDENT.id, OTHER_TEACHER.id]);
    expect(ids((await select(BUYER)).data)).toEqual([BUYER.id]);
    expect(ids((await select(ADMIN)).data)).toEqual([...ALL_PROFILE_IDS].sort());
  });

  it("shows students only published lessons they were assigned or bought", async () => {
    const lessons = (user: SessionUser) => run(user, { table: "lessons", action: "select", columns: "id" });

    expect(ids((await lessons(STUDENT)).data)).toEqual(["lesson-1"]);
    expect(ids((await lessons(OTHER_STUDENT)).data)).toEqual(["lesson-3"]);
    expect(ids((await lessons(BUYER)).data)).toEqual(["lesson-4"]);
    expect(ids((await lessons(TEACHER)).data)).toEqual(["lesson-1", "lesson-2"]);
  });

  it("scopes lesson content to readable lessons", async () => {
    const questions = await run(STUDENT, {
      table: "quiz_questions",
      action: "select",
      filters: [{ op: "in", column: "lesson_id", value: ["lesson-1", "lesson-3"] }],
    });
    expect(ids(questions.data)).toEqual(["question-1", "question-2"]);
  });

  it("finds a class by exact join code without exposing other classes", async () => {
    const lookup = (code: string) =>
      run(STUDENT, { table: "classes", action: "select", columns: "id, name", filters: [eq("join_code", code)], maybeSingle: true });

    expect(await lookup("JOIN2222")).toMatchObject({ status: 200, data: { id: "class-2", name: "Art 7" } });
    expect((await lookup("OLD33333")).data).toBeNull();

    const sweep = await run(STUDENT, {
      table: "classes",
      action: "select",
      columns: "id",
      filters: [{ op: "gte", column: "join_code", value: "" }],
    });
    expect(ids(sweep.data)).toEqual(["class-1"]);
  });

  it("keeps rosters, progress and alerts inside their owners", async () => {
    expect(ids((await run(OTHER_STUDENT, { table: "class_enrollments", action: "select" })).data)).toEqual(["enroll-2"]);
    expect(ids((await run(TEACHER, { table: "class_enrollments", action: "select" })).data)).toEqual(["enroll-1"]);
    expect(ids((await run(STUDENT, { table: "student_progress", action: "select" })).data)).toEqual(["progress-1"]);
    expect((await run(TEACHER, { table: "student_progress", action: "select", filters: [eq("lesson_id", "lesson-3")] })).data).toEqual([]);
    expect(ids((await run(TEACHER, { table: "teacher_alerts", action: "select" })).data)).toEqual(["alert-1"]);
    expect(ids((await run(STUDENT, { table: "learning_goals", action: "select" })).data)).toEqual(["goal-1"]);
  });

  it("denies tables outside the policy map", async () => {
    for (const table of ["notifications", "auth_users", "gradebook_scores", "student_notes", "entitlements"] as const) {
      expect((await run(ADMIN, { table, action: "select" })).status).toBe(403);
    }
  });
});

describe("null filters", () => {
  it("deletes only lesson-level questions for is(section_id, null)", async () => {
    const result = await run(TEACHER, {
      table: "quiz_questions",
      action: "delete",
      filters: [eq("lesson_id", "lesson-1"), { op: "is", column: "section_id", value: null }],
    });

    expect(result.status).toBe(200);
    expect(rowOf(db, "quiz_questions", "question-1")).toBeUndefined();
    expect(rowOf(db, "quiz_questions", "question-2")).toBeDefined();
  });

  it("returns scored rows for not(score, is, null)", async () => {
    const scored = await run(TEACHER, {
      table: "student_progress",
      action: "select",
      columns: "score",
      filters: [{ op: "in", column: "lesson_id", value: ["lesson-1", "lesson-2"] }, { op: "is_not", column: "score", value: null }],
    });
    expect(scored.data).toEqual([{ score: 80 }]);

    const unscored = await run(OTHER_TEACHER, {
      table: "student_progress",
      action: "select",
      columns: "score",
      filters: [eq("lesson_id", "lesson-3"), { op: "is_not", column: "score", value: null }],
    });
    expect(unscored.data).toEqual([]);
  });
});

describe("guarded writes", () => {
  it("rejects deletes and updates without a filter", async () => {
    const del = await run(TEACHER, { table: "lessons", action: "delete" });
    expect(del).toMatchObject({ status: 400, error: "Refusing to delete rows without a filter." });

    const update = await run(STUDENT, { table: "learning_goals", action: "update", values: { is_complete: true } });
    expect(update.status).toBe(400);
    expect(rowOf(db, "lessons", "lesson-1")).toBeDefined();
    expect(rowOf(db, "learning_goals", "goal-1")?.is_complete).toBe(0);
  });

  it("never touches another teacher's rows", async () => {
    await run(TEACHER, { table: "lessons", action: "delete", filters: [eq("id", "lesson-3")] });
    await run(TEACHER, { table: "classes", action: "update", values: { name: "Mine" }, filters: [eq("id", "class-2")] });
    await run(TEACHER, { table: "lesson_sections", action: "delete", filters: [eq("lesson_id", "lesson-3")] });

    expect(rowOf(db, "lessons", "lesson-3")).toBeDefined();
    expect(rowOf(db, "classes", "class-2")?.name).toBe("Art 7");
    expect(rowOf(db, "lesson_sections", "section-3")).toBeDefined();
  });

  it("blocks class takeovers through ownership columns or upserts", async () => {
    const reassign = await run(TEACHER, {
      table: "classes",
      action: "update",
      values: { teacher_id: TEACHER.id },
      filters: [eq("id", "class-2")],
    });
    expect(reassign).toMatchObject({ status: 200, data: [] });

    const giveAway = await run(TEACHER, {
      table: "classes",
      action: "update",
      values: { teacher_id: OTHER_TEACHER.id },
      filters: [eq("id", "class-1")],
    });
    expect(giveAway).toMatchObject({ status: 403, error: "teacher_id cannot be changed." });

    const upsert = await run(TEACHER, {
      table: "classes",
      action: "upsert",
      values: { id: "class-2", teacher_id: TEACHER.id, name: "Mine" },
    });
    expect(upsert.status).toBe(403);
    expect(rowOf(db, "classes", "class-2")).toMatchObject({ teacher_id: OTHER_TEACHER.id, name: "Art 7" });
  });

  it("keeps progress writes on the lesson progress route", async () => {
    const result = await run(BUYER, {
      table: "student_progress",
      action: "upsert",
      values: { id: "progress-2", lesson_id: "lesson-4", status: "completed", score: 100 },
    });

    expect(result).toMatchObject({ status: 403, error: "Use the lesson progress route to save activity." });
    expect(rowOf(db, "student_progress", "progress-2")).toMatchObject({ student_id: OTHER_STUDENT.id, score: null });
  });

  it("pins upsert conflict targets to the primary key or a declared unique key", async () => {
    const result = await run(STUDENT, {
      table: "class_enrollments",
      action: "upsert",
      onConflict: "class_id",
      values: { class_id: "class-1", join_code: "JOIN1111", is_active: true },
    });
    expect(result.status).toBe(400);

    const own = await run(STUDENT, {
      table: "class_enrollments",
      action: "upsert",
      onConflict: "class_id,student_id",
      values: { class_id: "class-1", join_code: "JOIN1111", is_active: true },
      single: true,
    });
    expect(own).toMatchObject({ status: 200, data: { class_id: "class-1", student_id: STUDENT.id } });
  });

  it("keeps lesson content and sharing inside owned lessons and classes", async () => {
    expect(
      (await run(STUDENT, { table: "lesson_sections", action: "insert", values: { lesson_id: "lesson-1", title: "x", order_index: 1 } })).status,
    ).toBe(403);
    expect(
      (await run(TEACHER, { table: "lesson_sections", action: "insert", values: { lesson_id: "lesson-3", title: "x", order_index: 1 } })).status,
    ).toBe(403);
    expect(
      (
        await run(TEACHER, {
          table: "lesson_assignments",
          action: "insert",
          values: { lesson_id: "lesson-3", class_id: "class-1", assigned_by: TEACHER.id },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await run(TEACHER, {
          table: "lesson_assignments",
          action: "insert",
          values: { lesson_id: "lesson-1", class_id: "class-2", assigned_by: TEACHER.id },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await run(TEACHER, {
          table: "quiz_questions",
          action: "insert",
          values: { lesson_id: "lesson-1", section_id: "section-3", question_text: "x" },
        })
      ).status,
    ).toBe(403);
  });

  it("rejects direct student progress and quiz attempt writes", async () => {
    const result = await run(STUDENT, {
      table: "student_progress",
      action: "insert",
      values: { lesson_id: "lesson-3", status: "in_progress" },
    });
    expect(result).toMatchObject({ status: 403, error: "Use the lesson progress route to save activity." });
    const attempt = await run(STUDENT, {
      table: "quiz_attempts",
      action: "insert",
      values: { lesson_id: "lesson-1", question_id: "question-1", attempt_number: 999, is_correct: true },
    });
    expect(attempt.status).toBe(403);
    expect(db.prepare("SELECT COUNT(*) AS n FROM quiz_attempts").get()).toMatchObject({ n: 0 });
  });
});

describe("class enrollment", () => {
  it("rejects raw enrollment inserts without a join code", async () => {
    const result = await run(STUDENT, {
      table: "class_enrollments",
      action: "insert",
      values: { class_id: "class-2", student_id: STUDENT.id, is_active: true },
    });

    expect(result).toMatchObject({ status: 403, error: "Join a class with its join code." });
    const enrolled = db.prepare("SELECT id FROM class_enrollments WHERE class_id = 'class-2' AND student_id = ?").all(STUDENT.id);
    expect(enrolled).toHaveLength(0);
  });

  it("rejects mismatched or inactive join codes", async () => {
    const mismatched = await run(STUDENT, {
      table: "class_enrollments",
      action: "upsert",
      onConflict: "class_id,student_id",
      values: { class_id: "class-2", student_id: STUDENT.id, is_active: true, join_code: "JOIN1111" },
    });
    expect(mismatched.status).toBe(403);

    const inactive = await run(STUDENT, {
      table: "class_enrollments",
      action: "insert",
      values: { class_id: "class-3", join_code: "OLD33333" },
    });
    expect(inactive.status).toBe(403);
  });

  it("enrolls the caller when the join code matches", async () => {
    const joined = await run(STUDENT, {
      table: "class_enrollments",
      action: "upsert",
      onConflict: "class_id,student_id",
      values: { class_id: "class-2", student_id: STUDENT.id, is_active: true, join_code: "join2222" },
    });
    expect(joined.status).toBe(200);
    expect(joined.data).toEqual([expect.objectContaining({ class_id: "class-2", student_id: STUDENT.id, is_active: true })]);
    expect(ids((await run(STUDENT, { table: "lessons", action: "select", columns: "id" })).data)).toEqual(["lesson-1", "lesson-3"]);
  });

  it("does not let callers enroll someone else or teachers insert raw enrollments", async () => {
    const other = await run(STUDENT, {
      table: "class_enrollments",
      action: "insert",
      values: { class_id: "class-2", student_id: OTHER_STUDENT.id, join_code: "JOIN2222" },
    });
    expect(other).toMatchObject({ status: 403, error: "student_id cannot be changed." });

    const teacher = await run(TEACHER, {
      table: "class_enrollments",
      action: "insert",
      values: { class_id: "class-1", student_id: OTHER_STUDENT.id },
    });
    expect(teacher.status).toBe(403);
  });
});

describe("large in() lists", () => {
  function countBoundParams() {
    const base = sqliteAdapter(db);
    const counts: number[] = [];
    adapter.current = {
      ...base,
      query: (statement: string, params: unknown[] = []) => {
        counts.push(params.length);
        return base.query(statement, params);
      },
    };
    return counts;
  }

  const padded = (count: number, ...real: string[]) => [...Array.from({ length: count - real.length }, (_, i) => `missing-${i}`), ...real];

  it("binds a 300-value list as one parameter next to the scope", async () => {
    const payload: Payload = { table: "lessons", action: "select", columns: "id", filters: [{ op: "in", column: "id", value: padded(300, "lesson-1", "lesson-3") }] };
    const decision = await authorizeDataRequest(STUDENT, payload);
    if (!decision.allowed || !decision.scope) throw new Error("expected a scoped read");

    const counts = countBoundParams();
    const result = await run(STUDENT, payload);
    expect(ids(result.data)).toEqual(["lesson-1"]);
    expect(counts).toEqual([1 + decision.scope.params.length]);
  });

  it("keeps a teacher's 150-student roster read under D1's 100-parameter limit", async () => {
    const counts = countBoundParams();
    const result = await run(TEACHER, {
      table: "profiles",
      action: "select",
      columns: "id",
      filters: [{ op: "in", column: "id", value: padded(150, STUDENT.id, OTHER_STUDENT.id) }],
    });
    expect(ids(result.data)).toEqual([STUDENT.id]);
    expect(Math.max(...counts)).toBeLessThan(100);
  });

  it("matches text, numbers, booleans and null like individually bound values", async () => {
    const select = (user: SessionUser, table: Payload["table"], column: string, value: unknown[]) =>
      run(user, { table, action: "select", columns: "id", filters: [{ op: "in", column, value }] });

    expect(ids((await select(TEACHER, "student_progress", "score", [80, 12.5])).data)).toEqual(["progress-1"]);
    expect(ids((await select(STUDENT, "class_enrollments", "is_active", [true])).data)).toEqual(["enroll-1"]);
    expect((await select(STUDENT, "class_enrollments", "is_active", [false])).data).toEqual([]);
    expect(ids((await select(STUDENT, "learning_goals", "id", [null, "goal-1", "goal-2"])).data)).toEqual(["goal-1"]);
    expect(ids((await select(STUDENT, "learning_goals", "title", ["one lesson"])).data)).toEqual([]);
  });

  it("checks ownership of many rows in one statement", async () => {
    const counts = countBoundParams();
    const values = Array.from({ length: 120 }, (_, i) => ({ lesson_id: "lesson-1", class_id: `class-${i + 1}`, due_date: null }));
    const result = await run(TEACHER, { table: "lesson_assignments", action: "insert", values });
    expect(result).toMatchObject({ status: 403, error: "Courses can only be shared with your own classes." });
    expect(Math.max(...counts)).toBeLessThan(100);
  });
});

describe("parseDataRequest", () => {
  it.each([
    [null, "Request body must be an object."],
    [{ table: "nope", action: "select" }, "Unknown table."],
    [{ table: "profiles", action: "rpc" }, "Unsupported action."],
    [{ table: "profiles", action: "select", filters: [{ op: "like", column: "id", value: "%" }] }, "Unsupported filter operator."],
    [{ table: "profiles", action: "select", filters: [{ op: "eq", column: "id; DROP", value: 1 }] }, "Filter columns must be column names."],
    [{ table: "profiles", action: "select", filters: [{ op: "is", column: "id", value: "x" }] }, "is() filters accept null, true or false."],
    [{ table: "profiles", action: "update", values: [{ full_name: "x" }] }, "Updates take an object of values."],
    [{ table: "profiles", action: "insert", values: [] }, "Send between 1 and 200 rows as objects."],
  ])("rejects %j", (payload, error) => {
    expect(parseDataRequest(payload)).toEqual({ ok: false, error });
  });
});
