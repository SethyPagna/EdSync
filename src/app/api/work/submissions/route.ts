import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

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
  return NextResponse.json({ data: { id }, error: null });
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

  const pointsPossible = Number(body.pointsPossible ?? submission.points_possible ?? 0);
  const pointsEarned = Number(body.pointsEarned ?? 0);
  const scorePercent = percent(pointsEarned, pointsPossible);

  await d1Query(
    `UPDATE learning_submissions
        SET points_earned = ?, points_possible = ?, percent = ?, feedback = ?,
            status = 'graded', graded_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [pointsEarned, pointsPossible, scorePercent, body.feedback ?? null, body.submissionId],
  );

  await d1Query(
    `INSERT OR REPLACE INTO gradebook_scores (
       id, class_id, student_id, teacher_id, category_id, source_type, source_id, title,
       points_earned, points_possible, percent, feedback, status, graded_at, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'graded', datetime('now'), '{}', datetime('now'), datetime('now'))`,
    [
      crypto.randomUUID(),
      submission.class_id,
      submission.student_id,
      submission.teacher_id,
      submission.category_id,
      submission.work_type,
      submission.work_item_id,
      submission.title,
      pointsEarned,
      pointsPossible,
      scorePercent,
      body.feedback ?? null,
    ],
  );

  return NextResponse.json({ data: { graded: true, percent: scorePercent }, error: null });
}
