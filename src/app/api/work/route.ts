import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { notifyAndEmail } from "@/lib/engagement/server";
import { appendLearningEvent } from "@/lib/learning-events";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { validateWorkPoints, validateWorkStatus, validateWorkType } from "@/lib/work/validation";

const WORK_ITEM_TABLE = "learning_work_items";

type StudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  preferences: string | null;
};

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
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");
  const context = await resolveTenantContext(user);

  if (user.user_metadata.role === "student") {
    const work = await d1Query(
      `SELECT wi.*,
              c.name AS class_name,
              ls.status AS submission_status,
              ls.percent AS submission_percent,
              ls.feedback AS submission_feedback
         FROM learning_work_items wi
         ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
         LEFT JOIN classes c ON c.id = wi.class_id
         LEFT JOIN class_enrollments ce ON ce.class_id = wi.class_id AND ce.student_id = ?
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
    return NextResponse.json({ data: work, error: null });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

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
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string | null;
    workType?: string;
    classId?: string | null;
    lessonId?: string | null;
    categoryId?: string | null;
    instructions?: string | null;
    pointsPossible?: number;
    dueAt?: string | null;
    status?: "draft" | "published";
    allowLate?: boolean;
    rubric?: unknown[];
    questions?: Array<{
      prompt?: string;
      questionType?: string;
      options?: unknown[];
      correctAnswer?: string | null;
      points?: number;
    }>;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ data: null, error: "Title is required." }, { status: 400 });
  }

  let workType: ReturnType<typeof validateWorkType>;
  let status: "draft" | "published";
  let pointsPossible: number;
  try {
    workType = validateWorkType(body.workType);
    status = validateWorkStatus(body.status, { allowArchived: false }) as "draft" | "published";
    pointsPossible = validateWorkPoints(body.pointsPossible);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid work item." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const context = await resolveTenantContext(user);
  const scopedClass = await getScopedClass({
    classId: body.classId,
    tenantId: context.tenant.id,
    userId: user.id,
    role: user.user_metadata.role,
  });
  if (body.classId && !scopedClass) {
    return NextResponse.json({ data: null, error: "Choose one of your active classes." }, { status: 400 });
  }

  await d1Query(
    `INSERT INTO learning_work_items (
       id, teacher_id, class_id, lesson_id, category_id, title, description, work_type,
       instructions, points_possible, due_at, status, allow_late, rubric, settings, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [
      id,
      user.id,
      body.classId ?? null,
      body.lessonId ?? null,
      body.categoryId ?? null,
      body.title.trim(),
      body.description ?? null,
      workType,
      body.instructions ?? null,
      pointsPossible,
      body.dueAt ?? null,
      status,
      body.allowLate === false ? 0 : 1,
      JSON.stringify(body.rubric ?? []),
    ],
  );

  const questions = body.questions ?? [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question.prompt) continue;
    await d1Query(
      `INSERT INTO learning_work_questions (
         id, work_item_id, prompt, question_type, options, correct_answer, points, order_index, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'))`,
      [
        crypto.randomUUID(),
        id,
        question.prompt,
        question.questionType ?? "short_answer",
        JSON.stringify(question.options ?? []),
        question.correctAnswer ?? null,
        Math.max(0, Number(question.points ?? 1)),
        index,
      ],
    );
  }

  if (workType === "discussion") {
    await d1Query(
      `INSERT INTO discussion_threads (id, work_item_id, class_id, teacher_id, title, prompt, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [crypto.randomUUID(), id, body.classId ?? null, user.id, body.title.trim(), body.instructions ?? body.description ?? ""],
    );
  }

  if (body.classId && body.dueAt) {
    await d1Query(
      `INSERT INTO schedule_events (
         id, owner_id, class_id, lesson_id, title, description, event_type,
         starts_at, ends_at, due_at, location, visibility, metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'deadline', NULL, NULL, ?, NULL, 'class', ?, datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        user.id,
        body.classId,
        body.lessonId ?? null,
        body.title.trim(),
        body.instructions ?? body.description ?? null,
        body.dueAt,
        JSON.stringify({
          type: "work_deadline",
          workItemId: id,
          workType,
          className: scopedClass?.name ?? null,
          pointsPossible,
        }),
      ],
    );
  }

  if (body.classId && status === "published") {
    const students = await getClassStudents(body.classId, context.tenant.id);
    const title = `${workType[0].toUpperCase()}${workType.slice(1)}: ${body.title.trim()}`;
    const dueText = body.dueAt ? ` Due ${body.dueAt}.` : "";
    await notifyWorkStudents({
      students,
      actorId: user.id,
      title,
      message: `${body.instructions || body.description || "New class work is ready."}${dueText}`,
      priority: body.dueAt ? "high" : "normal",
      metadata: {
        type: "work_assigned",
        workItemId: id,
        workType,
        classId: body.classId,
        dueAt: body.dueAt ?? null,
        pointsPossible,
      },
    });
  }

  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "learning_work_items", objectId: id });
  await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    classId: body.classId ?? null,
    sourceType: "learning_work_item",
    sourceId: id,
    eventType: `work.${workType}.created`,
    payload: { title: body.title.trim(), status, pointsPossible, dueAt: body.dueAt ?? null, classId: body.classId ?? null },
  });

  return NextResponse.json({ data: { id }, error: null });
}
