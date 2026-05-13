import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { notifyAndEmail } from "@/lib/engagement/server";

type AssignmentPayload = {
  lessonId?: string;
  classId?: string | null;
  studentId?: string | null;
  dueDate?: string | null;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.user_metadata.role !== "teacher") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const body = (await request.json()) as AssignmentPayload;
  if (!body.lessonId || (!body.classId && !body.studentId)) {
    return NextResponse.json({ data: null, error: "Lesson and class or student are required." }, { status: 400 });
  }

  const [lesson] = await d1Query<{ id: string; title: string; teacher_id: string }>(
    "SELECT id, title, teacher_id FROM lessons WHERE id = ? LIMIT 1",
    [body.lessonId],
  );
  if (!lesson || lesson.teacher_id !== user.id) {
    return NextResponse.json({ data: null, error: "Lesson not found." }, { status: 404 });
  }

  const students = body.studentId
    ? await d1Query<{ id: string; email: string; full_name: string | null; preferences: string | null }>(
        "SELECT id, email, full_name, preferences FROM profiles WHERE id = ? AND role = 'student' LIMIT 1",
        [body.studentId],
      )
    : await d1Query<{ id: string; email: string; full_name: string | null; preferences: string | null }>(
        `SELECT p.id, p.email, p.full_name, p.preferences
           FROM class_enrollments ce
           JOIN profiles p ON p.id = ce.student_id
          WHERE ce.class_id = ? AND ce.is_active = 1`,
        [body.classId],
      );

  const dueText = body.dueDate ? ` Due ${body.dueDate}.` : "";
  const actionUrl = `/student/lessons/${lesson.id}`;

  const results = await Promise.all(
    students.map(async (student) => {
      let preferences: { email_notifications?: boolean; assignment_notifications?: boolean } = {};
      try {
        preferences = student.preferences ? JSON.parse(student.preferences) : {};
      } catch {
        preferences = {};
      }

      const wantsEmail = preferences.email_notifications !== false && preferences.assignment_notifications !== false;
      return notifyAndEmail({
        userId: student.id,
        actorId: user.id,
        type: "lesson_assigned",
        title: "New lesson assigned",
        message: `"${lesson.title}" is ready for you.${dueText}`,
        actionUrl,
        priority: body.dueDate ? "high" : "normal",
        channels: wantsEmail ? ["in_app", "email"] : ["in_app"],
        metadata: { lessonId: lesson.id, classId: body.classId ?? null, dueDate: body.dueDate ?? null },
        email: wantsEmail
          ? {
              recipientUserId: student.id,
              recipientEmail: student.email,
              subject: `EdSync lesson assigned: ${lesson.title}`,
              bodyText: `Hi ${student.full_name || "there"},\n\nYour teacher assigned "${lesson.title}".${dueText}\n\nOpen EdSync to start: ${process.env.NEXT_PUBLIC_APP_URL || ""}${actionUrl}`,
              metadata: { lessonId: lesson.id, classId: body.classId ?? null },
            }
          : null,
      });
    }),
  );

  return NextResponse.json({ data: { notified: results.length }, error: null });
}
