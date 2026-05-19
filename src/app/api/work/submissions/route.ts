import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent, recordGradeEvent } from "@/lib/learning-events";
import { resolveTenantContext } from "@/lib/tenancy";
import { validateEarnedWorkPoints, validateWorkPoints } from "@/lib/work/validation";

function percent(pointsEarned: number, pointsPossible: number) {
  return pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 10000) / 100 : null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const workItemId = params.get("workItemId");

  if (user.user_metadata.role === "student") {
    const rows = await d1Query(
      `SELECT ls.*, wi.title, wi.work_type, wi.due_at
         FROM learning_submissions ls
         JOIN learning_work_items wi ON wi.id = ls.work_item_id
        WHERE ls.student_id = ?
          ${workItemId ? "AND ls.work_item_id = ?" : ""}
        ORDER BY ls.updated_at DESC`,
      workItemId ? [user.id, workItemId] : [user.id],
    );
    return NextResponse.json({ data: rows, error: null });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const ownerWhere = user.user_metadata.role === "admin" ? "1=1" : "wi.teacher_id = ?";
  const ownerParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const rows = await d1Query(
    `SELECT ls.*, wi.title, wi.work_type, wi.points_possible AS work_points_possible,
            p.full_name, p.email
       FROM learning_submissions ls
       JOIN learning_work_items wi ON wi.id = ls.work_item_id
       JOIN profiles p ON p.id = ls.student_id
      WHERE ${ownerWhere}
        ${workItemId ? "AND ls.work_item_id = ?" : ""}
      ORDER BY ls.updated_at DESC`,
    workItemId ? [...ownerParams, workItemId] : ownerParams,
  );
  return NextResponse.json({ data: rows, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    workItemId?: string;
    response?: Record<string, unknown>;
  };
  if (!body.workItemId) {
    return NextResponse.json({ data: null, error: "Work item is required." }, { status: 400 });
  }

  const [work] = await d1Query<{
    id: string;
    class_id: string | null;
    status: string;
    allow_late: number;
    due_at: string | null;
  }>("SELECT id, class_id, status, allow_late, due_at FROM learning_work_items WHERE id = ? LIMIT 1", [
    body.workItemId,
  ]);
  if (!work || work.status !== "published") {
    return NextResponse.json({ data: null, error: "Work item is not available." }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const context = await resolveTenantContext(user);
  await d1Query(
    `INSERT INTO learning_submissions (
       id, work_item_id, student_id, class_id, response, status, submitted_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'submitted', datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(work_item_id, student_id) DO UPDATE SET
       response = excluded.response,
       status = 'submitted',
       submitted_at = datetime('now'),
       updated_at = datetime('now')`,
    [id, body.workItemId, user.id, work.class_id, JSON.stringify(body.response ?? {})],
  );
  const eventId = await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.id,
    classId: work.class_id,
    sourceType: "learning_work_item",
    sourceId: body.workItemId,
    eventType: "work.submitted",
    payload: { submissionId: id },
  });
  return NextResponse.json({ data: { id, eventId }, error: null });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    submissionId?: string;
    pointsEarned?: number;
    pointsPossible?: number;
    feedback?: string | null;
  };
  if (!body.submissionId) {
    return NextResponse.json({ data: null, error: "Submission id is required." }, { status: 400 });
  }

  const [submission] = await d1Query<{
    id: string;
    work_item_id: string;
    student_id: string;
    class_id: string | null;
    title: string;
    work_type: string;
    teacher_id: string;
    category_id: string | null;
    points_possible: number;
  }>(
    `SELECT ls.id, ls.work_item_id, ls.student_id, ls.class_id,
            wi.title, wi.work_type, wi.teacher_id, wi.category_id, wi.points_possible
       FROM learning_submissions ls
       JOIN learning_work_items wi ON wi.id = ls.work_item_id
      WHERE ls.id = ?
      LIMIT 1`,
    [body.submissionId],
  );
  if (!submission) return NextResponse.json({ data: null, error: "Submission not found." }, { status: 404 });
  if (user.user_metadata.role !== "admin" && submission.teacher_id !== user.id) {
    return NextResponse.json({ data: null, error: "Submission not found." }, { status: 404 });
  }

  let pointsPossible: number;
  let pointsEarned: number;
  try {
    pointsPossible = validateWorkPoints(body.pointsPossible, submission.points_possible ?? 0);
    pointsEarned = validateEarnedWorkPoints(body.pointsEarned, pointsPossible);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid score." },
      { status: 400 },
    );
  }
  const scorePercent = percent(pointsEarned, pointsPossible);

  await d1Query(
    `UPDATE learning_submissions
        SET points_earned = ?, points_possible = ?, percent = ?, feedback = ?,
            status = 'graded', graded_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [pointsEarned, pointsPossible, scorePercent, body.feedback ?? null, body.submissionId],
  );

  const context = await resolveTenantContext(user);
  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: submission.student_id,
    classId: submission.class_id,
    sourceType: submission.work_type,
    sourceId: submission.work_item_id,
    eventType: "grade.work_submission.recorded",
    teacherId: submission.teacher_id,
    title: submission.title,
    pointsEarned,
    pointsPossible,
    feedback: body.feedback ?? null,
    payload: { submissionId: submission.id, categoryId: submission.category_id },
  });

  return NextResponse.json({ data: { graded: true, percent: scorePercent, eventId: result.eventId }, error: null });
}
