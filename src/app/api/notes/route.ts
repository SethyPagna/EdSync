import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { createNotification } from "@/lib/engagement/server";
import { normalizeStudentNoteInput } from "@/lib/notes/validation";
import type { SessionUser } from "@/lib/auth/session";
import { linkTenantObject, resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";

const CLASS_TABLE = "classes";
const NOTE_TABLE = "student_notes";

function classScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: CLASS_TABLE, tenantId });
}

function noteScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: NOTE_TABLE, tenantId });
}

function classPredicateParams(tenantId: string) {
  return classScopeParams(tenantId).slice(1);
}

function notePredicateParams(tenantId: string) {
  return noteScopeParams(tenantId).slice(1);
}

async function canCreateStudentNote(input: {
  user: SessionUser;
  context: TenantContext;
  studentId: string;
  classId?: string | null;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  if (input.classId) {
    const [row] = await d1Query<{ id: string }>(
      `SELECT c.id
         FROM classes c
         ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
         JOIN class_enrollments ce
           ON ce.class_id = c.id
          AND ce.student_id = ?
          AND ce.is_active = 1
        WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
          AND c.id = ?
          AND c.is_active = 1
          AND (? = 1 OR c.teacher_id = ?)
        LIMIT 1`,
      [
        CLASS_TABLE,
        input.studentId,
        ...classPredicateParams(input.context.tenant.id),
        input.classId,
        isAdmin ? 1 : 0,
        input.user.id,
      ],
    );
    return Boolean(row);
  }

  const rows = isAdmin
    ? await d1Query<{ id: string }>(
        `SELECT p.id
           FROM profiles p
           JOIN tenant_memberships tm
             ON tm.user_id = p.id
            AND tm.tenant_id = ?
            AND tm.status = 'active'
          WHERE p.id = ?
            AND p.role = 'student'
          LIMIT 1`,
        [input.context.tenant.id, input.studentId],
      )
    : await d1Query<{ id: string }>(
        `SELECT p.id
           FROM profiles p
           JOIN class_enrollments ce
             ON ce.student_id = p.id
            AND ce.is_active = 1
           JOIN classes c ON c.id = ce.class_id
           ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND p.id = ?
            AND p.role = 'student'
            AND c.is_active = 1
            AND c.teacher_id = ?
          LIMIT 1`,
        [CLASS_TABLE, ...classPredicateParams(input.context.tenant.id), input.studentId, input.user.id],
      );
  return rows.length > 0;
}

async function canManageStudentNote(input: {
  user: SessionUser;
  context: TenantContext;
  noteId: string;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  const [row] = await d1Query<{ id: string }>(
    `SELECT sn.id
       FROM student_notes sn
       ${tenantObjectJoin({ objectTable: NOTE_TABLE, objectAlias: "sn", linkAlias: "note_link" })}
       LEFT JOIN classes c ON c.id = sn.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE (${tenantObjectPredicate({ linkAlias: "note_link" })}
          OR (sn.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND sn.id = ?
        AND (? = 1 OR sn.teacher_id = ?)
      LIMIT 1`,
    [
      NOTE_TABLE,
      CLASS_TABLE,
      ...notePredicateParams(input.context.tenant.id),
      ...classPredicateParams(input.context.tenant.id),
      input.noteId,
      isAdmin ? 1 : 0,
      input.user.id,
    ],
  );
  return Boolean(row);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);

  const params = new URL(request.url).searchParams;
  const studentId = params.get("studentId");

  if (user.user_metadata.role === "student") {
    const rows = await d1Query(
      `SELECT sn.*, p.full_name AS teacher_name
         FROM student_notes sn
         ${tenantObjectJoin({ objectTable: NOTE_TABLE, objectAlias: "sn", linkAlias: "note_link" })}
         LEFT JOIN classes c ON c.id = sn.class_id
         ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
         JOIN profiles p ON p.id = sn.teacher_id
        WHERE (${tenantObjectPredicate({ linkAlias: "note_link" })}
            OR (sn.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
          AND sn.student_id = ?
          AND sn.visibility IN ('student', 'guardian')
        ORDER BY sn.created_at DESC`,
      [
        NOTE_TABLE,
        CLASS_TABLE,
        ...notePredicateParams(context.tenant.id),
        ...classPredicateParams(context.tenant.id),
        user.id,
      ],
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
       ${tenantObjectJoin({ objectTable: NOTE_TABLE, objectAlias: "sn", linkAlias: "note_link" })}
       LEFT JOIN classes c ON c.id = sn.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
       JOIN profiles p ON p.id = sn.student_id
      WHERE (${tenantObjectPredicate({ linkAlias: "note_link" })}
          OR (sn.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND ${ownerWhere}
        ${studentId ? "AND sn.student_id = ?" : ""}
      ORDER BY sn.created_at DESC`,
    studentId
      ? [
          NOTE_TABLE,
          CLASS_TABLE,
          ...notePredicateParams(context.tenant.id),
          ...classPredicateParams(context.tenant.id),
          ...ownerParams,
          studentId,
        ]
      : [
          NOTE_TABLE,
          CLASS_TABLE,
          ...notePredicateParams(context.tenant.id),
          ...classPredicateParams(context.tenant.id),
          ...ownerParams,
        ],
  );
  return NextResponse.json({ data: rows, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }
  const context = await resolveTenantContext(user);

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
  const canCreate = await canCreateStudentNote({
    user,
    context,
    studentId: body.studentId,
    classId: body.classId,
  });
  if (!canCreate) {
    return NextResponse.json({ data: null, error: "Student not found." }, { status: 404 });
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
  await linkTenantObject({
    tenantId: context.tenant.id,
    portalId: context.portal?.id,
    table: NOTE_TABLE,
    objectId: id,
  });

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

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    body?: string;
    visibility?: "teacher" | "student" | "guardian";
    priority?: "low" | "normal" | "high";
  };
  if (!body.id) return NextResponse.json({ data: null, error: "Note id is required." }, { status: 400 });
  const canManage = await canManageStudentNote({ user, context, noteId: body.id });
  if (!canManage) return NextResponse.json({ data: null, error: "Note not found." }, { status: 404 });

  let note;
  try {
    note = normalizeStudentNoteInput({
      title: body.title,
      body: body.body,
      visibility: body.visibility,
      priority: body.priority,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid student note." },
      { status: 400 },
    );
  }

  await d1Query(
    `UPDATE student_notes
        SET title = ?, body = ?, visibility = ?, priority = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [note.title, note.body, note.visibility, note.priority, body.id],
  );

  if (note.visibility !== "teacher") {
    const [row] = await d1Query<{ student_id: string }>("SELECT student_id FROM student_notes WHERE id = ? LIMIT 1", [body.id]);
    if (row?.student_id) {
      await createNotification({
        userId: row.student_id,
        actorId: user.id,
        type: "student_note",
        title: note.title,
        message: note.body.slice(0, 180),
        actionUrl: "/student/notes",
        priority: note.priority,
        metadata: { noteId: body.id, updated: true },
      });
    }
  }

  return NextResponse.json({ data: { id: body.id }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata.role !== "teacher" && user.user_metadata.role !== "admin") {
    return NextResponse.json({ data: null, error: "Teacher access required." }, { status: 403 });
  }
  const context = await resolveTenantContext(user);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ data: null, error: "Note id is required." }, { status: 400 });
  const canManage = await canManageStudentNote({ user, context, noteId: id });
  if (!canManage) return NextResponse.json({ data: null, error: "Note not found." }, { status: 404 });

  await d1Query("DELETE FROM tenant_object_links WHERE object_table = ? AND object_id = ?", [NOTE_TABLE, id]);
  await d1Query("DELETE FROM student_notes WHERE id = ?", [id]);
  return NextResponse.json({ data: { id, deleted: true }, error: null });
}
