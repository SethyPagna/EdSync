import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

type GradebookScoreRow = {
  category_id: string | null;
  percent: number | null;
  status: string;
};

type TeacherScoreRow = GradebookScoreRow & {
  student_id: string;
  full_name: string | null;
  email: string;
};

function percent(pointsEarned: number, pointsPossible: number) {
  return pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 10000) / 100 : null;
}

function weightedAverage(
  scores: GradebookScoreRow[],
  categories: Array<{ id: string; weight: number }>,
) {
  const byCategory = new Map(categories.map((category) => [category.id, Number(category.weight || 0)]));
  const grouped = new Map<string, number[]>();

  for (const score of scores) {
    if (score.status === "excused" || score.percent === null || score.percent === undefined) continue;
    const key = score.category_id || "uncategorized";
    grouped.set(key, [...(grouped.get(key) ?? []), Number(score.percent)]);
  }

  let weightedTotal = 0;
  let weightTotal = 0;
  for (const [categoryId, values] of Array.from(grouped.entries())) {
    const average = values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
    const weight = byCategory.get(categoryId) ?? 1;
    weightedTotal += average * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round((weightedTotal / weightTotal) * 100) / 100 : null;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId");

  if (user.user_metadata.role === "student") {
    const scores = await d1Query<GradebookScoreRow>(
      `SELECT gs.*, gc.name AS category_name
         FROM gradebook_scores gs
         LEFT JOIN gradebook_categories gc ON gc.id = gs.category_id
        WHERE gs.student_id = ?
        ORDER BY gs.updated_at DESC`,
      [user.id],
    );
    return NextResponse.json({
      data: { scores, overall: weightedAverage(scores, []) },
      error: null,
    });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const categoryParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const categories = await d1Query<{ id: string; class_id: string; name: string; weight: number }>(
    `SELECT *
       FROM gradebook_categories
      WHERE ${user.user_metadata.role === "admin" ? "1=1" : "teacher_id = ?"}
        ${classId ? "AND class_id = ?" : ""}
      ORDER BY class_id, name`,
    classId ? [...categoryParams, classId] : categoryParams,
  );

  const scoreParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const scores = await d1Query<TeacherScoreRow>(
    `SELECT gs.*, p.full_name, p.email, gc.name AS category_name
       FROM gradebook_scores gs
       JOIN profiles p ON p.id = gs.student_id
       LEFT JOIN gradebook_categories gc ON gc.id = gs.category_id
      WHERE ${user.user_metadata.role === "admin" ? "1=1" : "gs.teacher_id = ?"}
        ${classId ? "AND gs.class_id = ?" : ""}
      ORDER BY p.full_name, gs.updated_at DESC`,
    classId ? [...scoreParams, classId] : scoreParams,
  );

  const byStudent = new Map<
    string,
    { studentId: string; name: string; email: string; overall: number | null; scores: TeacherScoreRow[] }
  >();
  for (const score of scores) {
    const existing = byStudent.get(score.student_id) ?? {
      studentId: score.student_id,
      name: score.full_name || score.email,
      email: score.email,
      overall: null,
      scores: [],
    };
    existing.scores.push(score);
    byStudent.set(score.student_id, existing);
  }

  const rows = Array.from(byStudent.values()).map((row) => ({
    ...row,
    overall: weightedAverage(row.scores, categories),
  }));

  return NextResponse.json({ data: { categories, scores, rows }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    kind?: "category" | "score";
    classId?: string;
    name?: string;
    weight?: number;
    studentId?: string;
    categoryId?: string | null;
    sourceType?: string;
    sourceId?: string | null;
    title?: string;
    pointsEarned?: number;
    pointsPossible?: number;
    feedback?: string | null;
  };

  if (body.kind === "category") {
    if (!body.classId || !body.name) {
      return NextResponse.json({ data: null, error: "Class and category name are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO gradebook_categories (id, class_id, teacher_id, name, weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, body.classId, user.id, body.name.trim(), Math.max(0, Number(body.weight ?? 1))],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  if (!body.studentId || !body.title) {
    return NextResponse.json({ data: null, error: "Student and score title are required." }, { status: 400 });
  }

  const pointsEarned = Number(body.pointsEarned ?? 0);
  const pointsPossible = Number(body.pointsPossible ?? 0);
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT OR REPLACE INTO gradebook_scores (
       id, class_id, student_id, teacher_id, category_id, source_type, source_id, title,
       points_earned, points_possible, percent, feedback, status, graded_at, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'graded', datetime('now'), '{}', datetime('now'), datetime('now'))`,
    [
      id,
      body.classId ?? null,
      body.studentId,
      user.id,
      body.categoryId ?? null,
      body.sourceType ?? "manual",
      body.sourceId ?? id,
      body.title.trim(),
      pointsEarned,
      pointsPossible,
      percent(pointsEarned, pointsPossible),
      body.feedback ?? null,
    ],
  );

  return NextResponse.json({ data: { id }, error: null });
}
