import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import {
  buildLessonAssignmentCopy,
  normalizeAssignmentDueDate,
  parseAssignmentPreferences,
  wantsAssignmentEmail,
} from "@/lib/engagement/assignment-notifications";
import { notifyAndEmail } from "@/lib/engagement/server";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

type AssignmentPayload = {
  lessonId?: string;
  classId?: string | null;
  studentId?: string | null;
  dueDate?: string | null;
};

type LessonRow = {
  id: string;
  title: string;
  teacher_id: string;
};

type StudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  preferences: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ data: null, error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);

  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  } catch {
    return jsonError("Teacher access required.", 403);
  }

  const body = (await request.json()) as AssignmentPayload;
  if (!body.lessonId || (!body.classId && !body.studentId)) {
    return jsonError("Lesson and class or student are required.", 400);
  }

  let dueDate: string | null;
  try {
    dueDate = normalizeAssignmentDueDate(body.dueDate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Due date is invalid.";
    return jsonError(message, 400);
  }

  const [lesson] = await d1Query<LessonRow>(
    "SELECT id, title, teacher_id FROM lessons WHERE id = ? LIMIT 1",
    [body.lessonId],
  );
  const isAdmin = user.user_metadata.role === "admin";
  if (!lesson || (!isAdmin && lesson.teacher_id !== user.id)) {
    return jsonError("Lesson not found.", 404);
  }

  if (body.classId) {
    const [classRow] = await d1Query<{ id: string; teacher_id: string }>(
      "SELECT id, teacher_id FROM classes WHERE id = ? AND is_active = 1 LIMIT 1",
      [body.classId],
    );
    if (!classRow || (!isAdmin && classRow.teacher_id !== user.id)) {
      return jsonError("Class not found.", 404);
    }
  }

  const students = body.studentId
    ? await d1Query<StudentRow>(
        body.classId
          ? `SELECT p.id, p.email, p.full_name, p.preferences
               FROM class_enrollments ce
               JOIN classes c ON c.id = ce.class_id
               JOIN profiles p ON p.id = ce.student_id
              WHERE ce.class_id = ?
                AND ce.student_id = ?
                AND ce.is_active = 1
                AND p.role = 'student'
                AND (? = 1 OR c.teacher_id = ?)
              LIMIT 1`
          : `SELECT DISTINCT p.id, p.email, p.full_name, p.preferences
               FROM profiles p
               LEFT JOIN class_enrollments ce ON ce.student_id = p.id AND ce.is_active = 1
               LEFT JOIN classes c ON c.id = ce.class_id AND c.is_active = 1
              WHERE p.id = ?
                AND p.role = 'student'
                AND (? = 1 OR c.teacher_id = ?)
              LIMIT 1`,
        body.classId
          ? [body.classId, body.studentId, isAdmin ? 1 : 0, user.id]
          : [body.studentId, isAdmin ? 1 : 0, user.id],
      )
    : await d1Query<StudentRow>(
        `SELECT p.id, p.email, p.full_name, p.preferences
           FROM class_enrollments ce
           JOIN classes c ON c.id = ce.class_id
           JOIN profiles p ON p.id = ce.student_id
          WHERE ce.class_id = ?
            AND ce.is_active = 1
            AND p.role = 'student'
            AND (? = 1 OR c.teacher_id = ?)`,
        [body.classId, isAdmin ? 1 : 0, user.id],
      );

  if (students.length === 0) return jsonError("No active student recipients found.", 404);

  const actionUrl = `/student/lessons/${lesson.id}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const results = await Promise.all(
    students.map(async (student) => {
      const preferences = parseAssignmentPreferences(student.preferences);
      const shouldEmail = wantsAssignmentEmail(preferences);
      const copy = buildLessonAssignmentCopy({
        lessonTitle: lesson.title,
        dueDate,
        studentName: student.full_name,
        actionUrl,
        appUrl,
      });

      return notifyAndEmail({
        userId: student.id,
        actorId: user.id,
        type: "lesson_assigned",
        title: copy.title,
        message: copy.message,
        actionUrl,
        priority: dueDate ? "high" : "normal",
        channels: shouldEmail ? ["in_app", "email"] : ["in_app"],
        metadata: { lessonId: lesson.id, classId: body.classId ?? null, dueDate },
        email: shouldEmail
          ? {
              recipientUserId: student.id,
              recipientEmail: student.email,
              subject: copy.subject,
              bodyText: copy.bodyText,
              metadata: { lessonId: lesson.id, classId: body.classId ?? null },
            }
          : null,
      });
    }),
  );

  return NextResponse.json({ data: { notified: results.length }, error: null });
}
