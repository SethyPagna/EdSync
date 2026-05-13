import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.user_metadata.role !== "student") {
    return NextResponse.json({ data: null, error: "Student access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    lessonId?: string;
    score?: number;
    pointsEarned?: number;
    pointsPossible?: number;
  };
  if (!body.lessonId || body.score === undefined) {
    return NextResponse.json({ data: null, error: "Lesson and score are required." }, { status: 400 });
  }

  const [lesson] = await d1Query<{ id: string; title: string; teacher_id: string; class_id: string | null }>(
    "SELECT id, title, teacher_id, class_id FROM lessons WHERE id = ? LIMIT 1",
    [body.lessonId],
  );
  if (!lesson) return NextResponse.json({ data: null, error: "Lesson not found." }, { status: 404 });

  const score = Math.max(0, Math.min(100, Number(body.score || 0)));
  const pointsPossible = Math.max(0, Number(body.pointsPossible ?? 100));
  const pointsEarned = body.pointsEarned !== undefined ? Number(body.pointsEarned) : Math.round((score / 100) * pointsPossible);

  await d1Query(
    `INSERT OR REPLACE INTO gradebook_scores (
       id, class_id, student_id, teacher_id, source_type, source_id, title,
       points_earned, points_possible, percent, status, graded_at, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'lesson_quiz', ?, ?, ?, ?, ?, 'graded', datetime('now'), '{}', datetime('now'), datetime('now'))`,
    [
      crypto.randomUUID(),
      lesson.class_id,
      user.id,
      lesson.teacher_id,
      lesson.id,
      `${lesson.title} final quiz`,
      pointsEarned,
      pointsPossible,
      score,
    ],
  );

  return NextResponse.json({ data: { recorded: true }, error: null });
}
