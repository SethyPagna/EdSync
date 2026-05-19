import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { createNotification } from "@/lib/engagement/server";
import { normalizeStudentNoteInput } from "@/lib/notes/validation";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const studentId = params.get("studentId");

  if (user.user_metadata.role === "student") {
    const rows = await d1Query(
      `SELECT sn.*, p.full_name AS teacher_name
         FROM student_notes sn
         JOIN profiles p ON p.id = sn.teacher_id
        WHERE sn.student_id = ?
          AND sn.visibility IN ('student', 'guardian')
        ORDER BY sn.created_at DESC`,
      [user.id],
    );
    return NextResponse.json({ data: rows, error: null });
  }

  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const ownerWhere = user.user_metadata.role === "admin" ? "1=1" : "sn.teacher_id = ?";
  const ownerParams = user.user_metadata.role === "admin" ? [] : [user.id];
  const rows = await d1Query(
    `SELECT sn.*, p.full_name AS student_name, p.email AS student_email
       FROM student_notes sn
       JOIN profiles p ON p.id = sn.student_id
      WHERE ${ownerWhere}
        ${studentId ? "AND sn.student_id = ?" : ""}
      ORDER BY sn.created_at DESC`,
    studentId ? [...ownerParams, studentId] : ownerParams,
  );
  return NextResponse.json({ data: rows, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin")) {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    studentId?: string;
    classId?: string | null;
    title?: string;
    body?: string;
    visibility?: "teacher" | "student" | "guardian";
    priority?: "low" | "normal" | "high";
  };
  if (!body.studentId) {
    return NextResponse.json({ data: null, error: "Student is required." }, { status: 400 });
  }

  let note;
  try {
    note = normalizeStudentNoteInput(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid student note." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO student_notes (
       id, teacher_id, student_id, class_id, title, body, visibility, priority, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [
      id,
      user.id,
      body.studentId,
      body.classId ?? null,
      note.title,
      note.body,
      note.visibility,
      note.priority,
    ],
  );

  if (note.visibility !== "teacher") {
    await createNotification({
      userId: body.studentId,
      actorId: user.id,
      type: "student_note",
      title: note.title,
      message: note.body.slice(0, 180),
      actionUrl: "/student/notes",
      priority: note.priority,
      metadata: { noteId: id },
    });
  }

  return NextResponse.json({ data: { id }, error: null });
}
