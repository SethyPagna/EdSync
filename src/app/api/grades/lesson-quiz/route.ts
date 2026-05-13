import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { recordGradeEvent } from "@/lib/learning-events";
import { resolveTenantContext } from "@/lib/tenancy";

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

  const context = await resolveTenantContext(user);
  const result = await recordGradeEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.id,
    classId: lesson.class_id,
    sourceType: "lesson_quiz",
    sourceId: lesson.id,
    eventType: "grade.lesson_quiz.recorded",
    teacherId: lesson.teacher_id,
    title: `${lesson.title} final quiz`,
    pointsEarned,
    pointsPossible,
    payload: { score },
  });

  return NextResponse.json({ data: { recorded: true, eventId: result.eventId }, error: null });
}
