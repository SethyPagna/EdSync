import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { notifyAndEmail } from "@/lib/engagement/server";
import { errorMessage, jsonError, optionalId, readJsonObject } from "@/lib/grades/http";
import { appendLearningEvent } from "@/lib/learning-events";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import {
  mergeWorkItemPatch,
  newWorkItemRecord,
  normalizeWorkSettings,
  type WorkItemRecord,
  type WorkSettings,
} from "@/lib/work/update";
import { studentWorkQuestion, type StudentWorkQuestion, type WorkQuestionRow } from "@/lib/work/questions";

const WORK_ITEM_TABLE = "learning_work_items";
const THREAD_TABLE = "discussion_threads";

type StudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  preferences: string | null;
};

type ScopedWorkItem = WorkItemRecord & {
  id: string;
  class_id: string | null;
  teacher_id: string;
};

type WorkQuestionInput = {
  prompt?: unknown;
  questionType?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  points?: unknown;
};

function isStaff(user: SessionUser) {
  return user.user_metadata.role === "teacher" || user.user_metadata.role === "admin";
}

function workScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: WORK_ITEM_TABLE, tenantId });
}

function workObjectTableParam() {
  return WORK_ITEM_TABLE;
}

function workPredicateParams(tenantId: string) {
  return workScopeParams(tenantId).slice(1);
}

async function getScopedClass({
  classId,
  tenantId,
  userId,
  role,
}: {
  classId?: string | null;
  tenantId: string;
  userId: string;
  role: string;
}) {
  if (!classId) return null;
  const ownerWhere = role === "admin" ? "1=1" : "c.teacher_id = ?";
  const ownerParams = role === "admin" ? [] : [userId];
  const [row] = await d1Query<{ id: string; name: string }>(
    `SELECT c.id, c.name
       FROM classes c
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND c.id = ?
        AND c.is_active = 1
        AND ${ownerWhere}
      LIMIT 1`,
    [...tenantObjectParams({ objectTable: "classes", tenantId }), classId, ...ownerParams],
  );
  return row ?? null;
}

async function getScopedWorkItem({
  workItemId,
  tenantId,
  userId,
  role,
}: {
  workItemId?: string | null;
  tenantId: string;
  userId: string;
  role: string;
}) {
  if (!workItemId) return null;
  const ownerWhere = role === "admin" ? "1=1" : "wi.teacher_id = ?";
  const ownerParams = role === "admin" ? [] : [userId];
  const [row] = await d1Query<ScopedWorkItem>(
    `SELECT wi.id, wi.class_id, wi.teacher_id, wi.status, wi.title, wi.description, wi.work_type,
            wi.instructions, wi.points_possible, wi.due_at, wi.allow_late, wi.lesson_id,
            wi.category_id, wi.rubric, wi.settings
       FROM learning_work_items wi
       ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
        AND wi.id = ?
        AND ${ownerWhere}
      LIMIT 1`,
    [...workScopeParams(tenantId), workItemId, ...ownerParams],
  );
  if (!row) return null;
  return {
    ...row,
    points_possible: Number(row.points_possible ?? 0),
    allow_late: Number(row.allow_late ?? 1),
    rubric: row.rubric ?? "[]",
    settings: row.settings ?? "{}",
  };
}

/**
 * Returns an error message when the lesson or grade category is not part of the work item's class.
 * Work without a class may link any lesson the teacher owns (admins: any lesson).
 */
async function findWorkLinkError(input: {
  lessonId: string | null;
  categoryId: string | null;
  classId: string | null;
  userId: string;
  role: string;
}) {
  if (input.lessonId) {
    const [lesson] = await d1Query<{ id: string }>(
      `SELECT l.id
         FROM lessons l
        WHERE l.id = ?
          AND ((? IS NOT NULL AND (l.class_id = ? OR EXISTS (
                 SELECT 1
                   FROM lesson_assignments la
                  WHERE la.lesson_id = l.id
                    AND la.class_id = ?
                    AND la.is_active = 1)))
            OR (? IS NULL AND (l.teacher_id = ? OR ? = 1)))
        LIMIT 1`,
      [
        input.lessonId,
        input.classId,
        input.classId,
        input.classId,
        input.classId,
        input.userId,
        input.role === "admin" ? 1 : 0,
      ],
    );
    if (!lesson) return "Choose a lesson from this class.";
  }
  if (input.categoryId) {
    if (!input.classId) return "Grade categories need a class.";
    const [category] = await d1Query<{ id: string }>(
      "SELECT id FROM gradebook_categories WHERE id = ? AND class_id = ? LIMIT 1",
      [input.categoryId, input.classId],
    );
    if (!category) return "Choose a grade category from this class.";
  }
  return null;
}

async function syncDeadlineEvent(input: {
  workItemId: string;
  classId: string | null;
  ownerId: string;
  record: WorkItemRecord;
  settings: WorkSettings;
  className: string | null;
}) {
  const { record } = input;
  if (!input.classId || !record.due_at || record.status !== "published") {
    await d1Query("DELETE FROM schedule_events WHERE json_extract(metadata, '$.workItemId') = ?", [input.workItemId]);
    return;
  }
  const description = record.instructions ?? record.description ?? null;
  const metadata = JSON.stringify({
    type: "work_deadline",
    workItemId: input.workItemId,
    workType: record.work_type,
    className: input.className,
    pointsPossible: record.points_possible,
    grading: input.settings,
  });
  const updated = await d1Query<{ id: string }>(
    `UPDATE schedule_events
        SET title = ?, description = ?, due_at = ?, lesson_id = ?, metadata = ?, updated_at = datetime('now')
      WHERE json_extract(metadata, '$.workItemId') = ?
      RETURNING id`,
    [record.title, description, record.due_at, record.lesson_id, metadata, input.workItemId],
  );
  if (updated.length > 0) return;
  await d1Query(
    `INSERT INTO schedule_events (
       id, owner_id, class_id, lesson_id, title, description, event_type,
       starts_at, ends_at, due_at, location, visibility, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'deadline', NULL, NULL, ?, NULL, 'class', ?, datetime('now'), datetime('now'))`,
    [
      crypto.randomUUID(),
      input.ownerId,
      input.classId,
      record.lesson_id,
      record.title,
      description,
      record.due_at,
      metadata,
    ],
  );
}

async function syncDiscussionThread(input: {
  workItemId: string;
  classId: string | null;
  teacherId: string;
  record: WorkItemRecord;
  context: TenantContext;
}) {
  const { record } = input;
  if (record.work_type !== "discussion") return;
  const prompt = record.instructions ?? record.description ?? "";
  const updated = await d1Query<{ id: string }>(
    `UPDATE discussion_threads
        SET title = ?, prompt = ?, updated_at = datetime('now')
      WHERE work_item_id = ?
      RETURNING id`,
    [record.title, prompt, input.workItemId],
  );
  if (updated.length > 0) return;
  const threadId = crypto.randomUUID();
  await d1Query(
    `INSERT INTO discussion_threads (id, work_item_id, class_id, teacher_id, title, prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [threadId, input.workItemId, input.classId, input.teacherId, record.title, prompt],
  );
  await linkTenantObject({
    tenantId: input.context.tenant.id,
    portalId: input.context.portal?.id,
    table: THREAD_TABLE,
    objectId: threadId,
  });
}

function parsePreferences(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function getClassStudents(classId: string, tenantId: string) {
  return d1Query<StudentRow>(
    `SELECT p.id, p.email, p.full_name, p.preferences
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       JOIN profiles p ON p.id = ce.student_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND ce.class_id = ?
        AND ce.is_active = 1
        AND c.is_active = 1
        AND p.role = 'student'`,
    [...tenantObjectParams({ objectTable: "classes", tenantId }), classId],
  );
}

async function notifyWorkStudents({
  students,
  actorId,
  title,
  message,
  priority,
  metadata,
}: {
  students: StudentRow[];
  actorId: string;
  title: string;
  message: string;
  priority: "normal" | "high";
  metadata: Record<string, unknown>;
}) {
  await Promise.all(
    students.map((student) => {
      const preferences = parsePreferences(student.preferences);
      const wantsEmail =
        preferences.email_notifications !== false &&
        preferences.assignment_notifications !== false;

      return notifyAndEmail({
        userId: student.id,
        actorId,
        type: "work_assigned",
        title,
        message,
        actionUrl: "/student/work",
        priority,
        channels: wantsEmail ? ["in_app", "email"] : ["in_app"],
        metadata,
        email: wantsEmail
          ? {
              recipientUserId: student.id,
              recipientEmail: student.email,
              subject: `EdSync: ${title}`,
              bodyText: `Hi ${student.full_name || "there"},\n\n${message}\n\nOpen EdSync: ${process.env.NEXT_PUBLIC_APP_URL || ""}/student/work`,
              metadata,
            }
          : null,
      });
    }),
  );
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");
  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);

  if (user.user_metadata.role === "student") {
    const work = await d1Query<{ id: string } & Record<string, unknown>>(
      `SELECT wi.*,
              c.name AS class_name,
              ls.status AS submission_status,
              ls.percent AS submission_percent,
              ls.feedback AS submission_feedback
         FROM learning_work_items wi
         ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
         LEFT JOIN classes c ON c.id = wi.class_id
         LEFT JOIN class_enrollments ce ON ce.class_id = wi.class_id AND ce.student_id = ? AND ce.is_active = 1
         LEFT JOIN learning_submissions ls ON ls.work_item_id = wi.id AND ls.student_id = ?
        WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
          AND wi.status = 'published'
          AND (wi.class_id IS NULL OR ce.student_id = ?)
          ${classId ? "AND wi.class_id = ?" : ""}
        ORDER BY COALESCE(wi.due_at, wi.created_at) ASC`,
      classId
        ? [
            workObjectTableParam(),
            user.id,
            user.id,
            ...workPredicateParams(context.tenant.id),
            user.id,
            classId,
          ]
        : [
            workObjectTableParam(),
            user.id,
            user.id,
            ...workPredicateParams(context.tenant.id),
            user.id,
          ],
    );
    const byWorkId = new Map<string, StudentWorkQuestion[]>();
    for (let start = 0; start < work.length; start += 400) {
      const workIds = work.slice(start, start + 400).map((item) => item.id);
      const questions = await d1Query<WorkQuestionRow>(
        `SELECT id, work_item_id, prompt, question_type, options, points, order_index
           FROM learning_work_questions
          WHERE work_item_id IN (${workIds.map(() => "?").join(", ")})
          ORDER BY work_item_id, order_index, id`,
        workIds,
      );
      for (const row of questions) {
        const existing = byWorkId.get(row.work_item_id) ?? [];
        existing.push(studentWorkQuestion(row));
        byWorkId.set(row.work_item_id, existing);
      }
    }
    return NextResponse.json({ data: work.map((item) => ({ ...item, questions: byWorkId.get(item.id) ?? [] })), error: null });
  }

  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const ownerWhere = user.user_metadata.role === "admin" ? "1=1" : "wi.teacher_id = ?";
  const ownerParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const work = await d1Query(
    `SELECT wi.*, c.name AS class_name,
            COUNT(ls.id) AS submission_count
       FROM learning_work_items wi
       ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
       LEFT JOIN classes c ON c.id = wi.class_id
       LEFT JOIN learning_submissions ls ON ls.work_item_id = wi.id
      WHERE ${tenantObjectPredicate({ linkAlias: "work_link" })}
        AND ${ownerWhere}
        ${classId ? "AND wi.class_id = ?" : ""}
      GROUP BY wi.id
      ORDER BY wi.updated_at DESC`,
    classId
      ? [...workScopeParams(context.tenant.id), ...ownerParams, classId]
      : [...workScopeParams(context.tenant.id), ...ownerParams],
  );
  return NextResponse.json({ data: work, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  if (body.questions !== undefined && !Array.isArray(body.questions)) {
    return jsonError("Questions must be a list.", 400);
  }

  let record: WorkItemRecord;
  try {
    record = newWorkItemRecord(body);
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid work item."), 400);
  }
  const settings = normalizeWorkSettings(record.settings);
  const classId = optionalId(body.classId);

  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);
  const scopedClass = await getScopedClass({
    classId,
    tenantId: context.tenant.id,
    userId: user.id,
    role: user.user_metadata.role,
  });
  if (classId && !scopedClass) return jsonError("Choose one of your active classes.", 400);
  const linkError = await findWorkLinkError({
    lessonId: record.lesson_id,
    categoryId: record.category_id,
    classId,
    userId: user.id,
    role: user.user_metadata.role,
  });
  if (linkError) return jsonError(linkError, 400);

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO learning_work_items (
       id, teacher_id, class_id, lesson_id, category_id, title, description, work_type,
       instructions, points_possible, due_at, status, allow_late, rubric, settings, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      user.id,
      classId,
      record.lesson_id,
      record.category_id,
      record.title,
      record.description,
      record.work_type,
      record.instructions,
      record.points_possible,
      record.due_at,
      record.status,
      record.allow_late,
      record.rubric,
      record.settings,
    ],
  );
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: WORK_ITEM_TABLE, objectId: id });

  const questions = (body.questions ?? []) as WorkQuestionInput[];
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (typeof question?.prompt !== "string" || !question.prompt.trim()) continue;
    const points = Number(question.points ?? 1);
    await d1Query(
      `INSERT INTO learning_work_questions (
         id, work_item_id, prompt, question_type, options, correct_answer, points, order_index, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'))`,
      [
        crypto.randomUUID(),
        id,
        question.prompt,
        typeof question.questionType === "string" ? question.questionType : "short_answer",
        JSON.stringify(Array.isArray(question.options) ? question.options : []),
        typeof question.correctAnswer === "string" ? question.correctAnswer : null,
        Number.isFinite(points) ? Math.max(0, points) : 1,
        index,
      ],
    );
  }

  await syncDiscussionThread({ workItemId: id, classId, teacherId: user.id, record, context });
  if (classId && record.due_at) {
    await syncDeadlineEvent({
      workItemId: id,
      classId,
      ownerId: user.id,
      record,
      settings,
      className: scopedClass?.name ?? null,
    });
  }

  if (classId && record.status === "published") {
    const students = await getClassStudents(classId, context.tenant.id);
    const title = `${record.work_type[0].toUpperCase()}${record.work_type.slice(1)}: ${record.title}`;
    const dueText = record.due_at ? ` Due ${record.due_at}.` : "";
    await notifyWorkStudents({
      students,
      actorId: user.id,
      title,
      message: `${record.instructions || record.description || "New class work is ready."}${dueText}`,
      priority: record.due_at ? "high" : "normal",
      metadata: {
        type: "work_assigned",
        workItemId: id,
        workType: record.work_type,
        classId,
        dueAt: record.due_at,
        pointsPossible: record.points_possible,
        grading: settings,
      },
    });
  }

  await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    classId,
    sourceType: "learning_work_item",
    sourceId: id,
    eventType: `work.${record.work_type}.created`,
    payload: {
      title: record.title,
      status: record.status,
      pointsPossible: record.points_possible,
      grading: settings,
      dueAt: record.due_at,
      classId,
    },
  });

  return NextResponse.json({ data: { id }, error: null });
}

/** Partial update: only fields present in the body change. The class of a work item cannot be changed. */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const body = await readJsonObject(request);
  if (!body) return jsonError("Send a JSON object body.", 400);
  const id = optionalId(body.id);
  if (!id) return jsonError("Work item id is required.", 400);

  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);
  const existing = await getScopedWorkItem({
    workItemId: id,
    tenantId: context.tenant.id,
    userId: user.id,
    role: user.user_metadata.role,
  });
  if (!existing) return jsonError("Work item not found.", 404);

  let record: WorkItemRecord;
  try {
    record = mergeWorkItemPatch(existing, body);
  } catch (error) {
    return jsonError(errorMessage(error, "Invalid work item."), 400);
  }

  if (record.work_type !== existing.work_type) {
    const [submission] = await d1Query<{ id: string }>(
      "SELECT id FROM learning_submissions WHERE work_item_id = ? LIMIT 1",
      [id],
    );
    if (submission) return jsonError("The work type can't change after students have submitted.", 409);
  }
  if (record.lesson_id !== existing.lesson_id || record.category_id !== existing.category_id) {
    const linkError = await findWorkLinkError({
      lessonId: record.lesson_id !== existing.lesson_id ? record.lesson_id : null,
      categoryId: record.category_id !== existing.category_id ? record.category_id : null,
      classId: existing.class_id,
      userId: user.id,
      role: user.user_metadata.role,
    });
    if (linkError) return jsonError(linkError, 400);
  }
  const settings = normalizeWorkSettings(record.settings);

  await d1Query(
    `UPDATE learning_work_items
        SET title = ?, description = ?, work_type = ?, instructions = ?, points_possible = ?,
            due_at = ?, status = ?, allow_late = ?, lesson_id = ?, category_id = ?, rubric = ?,
            settings = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [
      record.title,
      record.description,
      record.work_type,
      record.instructions,
      record.points_possible,
      record.due_at,
      record.status,
      record.allow_late,
      record.lesson_id,
      record.category_id,
      record.rubric,
      record.settings,
      id,
    ],
  );

  const [klass] = existing.class_id
    ? await d1Query<{ name: string }>("SELECT name FROM classes WHERE id = ? LIMIT 1", [existing.class_id])
    : [];
  await syncDeadlineEvent({
    workItemId: id,
    classId: existing.class_id,
    ownerId: existing.teacher_id,
    record,
    settings,
    className: klass?.name ?? null,
  });
  await syncDiscussionThread({
    workItemId: id,
    classId: existing.class_id,
    teacherId: existing.teacher_id,
    record,
    context,
  });

  await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    classId: existing.class_id,
    sourceType: "learning_work_item",
    sourceId: id,
    eventType: `work.${record.work_type}.updated`,
    payload: {
      title: record.title,
      status: record.status,
      pointsPossible: record.points_possible,
      grading: settings,
      dueAt: record.due_at,
      changed: Object.keys(body).filter((key) => key !== "id" && body[key] !== undefined),
    },
  });

  return NextResponse.json({ data: { id }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isStaff(user)) return jsonError("Teacher access required.", 403);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Work item id is required.", 400);

  const context = await resolveTenantContext(user);
  if (!(await isFeatureEnabled("work_items"))) return jsonError("Assignments are unavailable.", 403);
  const workItem = await getScopedWorkItem({
    workItemId: id,
    tenantId: context.tenant.id,
    userId: user.id,
    role: user.user_metadata.role,
  });
  if (!workItem) return jsonError("Work item not found.", 404);

  await d1Query("UPDATE learning_work_items SET status = 'archived', updated_at = datetime('now') WHERE id = ?", [id]);
  await d1Query("DELETE FROM schedule_events WHERE json_extract(metadata, '$.workItemId') = ?", [id]);
  await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    classId: workItem.class_id,
    sourceType: "learning_work_item",
    sourceId: id,
    eventType: "work.archived",
    payload: { previousStatus: workItem.status },
  });

  return NextResponse.json({ data: { id, archived: true }, error: null });
}
