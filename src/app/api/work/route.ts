import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";
import { validateWorkPoints, validateWorkStatus, validateWorkType } from "@/lib/work/validation";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");

  if (user.user_metadata.role === "student") {
    const work = await d1Query(
      `SELECT wi.*,
              c.name AS class_name,
              ls.status AS submission_status,
              ls.percent AS submission_percent,
              ls.feedback AS submission_feedback
         FROM learning_work_items wi
         LEFT JOIN classes c ON c.id = wi.class_id
         LEFT JOIN class_enrollments ce ON ce.class_id = wi.class_id AND ce.student_id = ?
         LEFT JOIN learning_submissions ls ON ls.work_item_id = wi.id AND ls.student_id = ?
        WHERE wi.status = 'published'
          AND (wi.class_id IS NULL OR ce.student_id = ?)
          ${classId ? "AND wi.class_id = ?" : ""}
        ORDER BY COALESCE(wi.due_at, wi.created_at) ASC`,
      classId ? [user.id, user.id, user.id, classId] : [user.id, user.id, user.id],
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
       LEFT JOIN classes c ON c.id = wi.class_id
       LEFT JOIN learning_submissions ls ON ls.work_item_id = wi.id
      WHERE ${ownerWhere}
        ${classId ? "AND wi.class_id = ?" : ""}
      GROUP BY wi.id
      ORDER BY wi.updated_at DESC`,
    classId ? [...ownerParams, classId] : ownerParams,
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

  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "learning_work_items", objectId: id });
  await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    classId: body.classId ?? null,
    sourceType: "learning_work_item",
    sourceId: id,
    eventType: `work.${workType}.created`,
    payload: { title: body.title.trim(), status, pointsPossible },
  });

  return NextResponse.json({ data: { id }, error: null });
}
