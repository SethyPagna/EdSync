import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { sqlInPlaceholders } from "@/lib/db/sql";
import { notifyAndEmail } from "@/lib/engagement/server";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { resolveTenantContext } from "@/lib/tenancy";
import {
  PLANNER_BODY_MAX_LENGTH,
  PLANNER_LOCATION_MAX_LENGTH,
  PLANNER_TITLE_MAX_LENGTH,
  normalizePlannerDateTime,
  normalizePlannerEventType,
  normalizePlannerPriority,
  normalizePlannerText,
  validatePlannerDateOrder,
} from "@/lib/planner-validation";

type PlannerPayload = {
  kind?: "announcement" | "event";
  classId?: string | null;
  lessonId?: string | null;
  title?: string;
  body?: string;
  description?: string | null;
  priority?: "low" | "normal" | "high";
  eventType?: "deadline" | "class" | "office_hours" | "study" | "announcement" | "other";
  startsAt?: string | null;
  endsAt?: string | null;
  dueAt?: string | null;
  location?: string | null;
};

type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
};

type StudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  preferences: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

function parsePreferences(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function classScopeParams(tenantId: string) {
  return tenantObjectParams({ objectTable: "classes", tenantId });
}

function classPredicateParams(tenantId: string) {
  return classScopeParams(tenantId).slice(1);
}

async function getTeacherClass(userId: string, tenantId: string, classId?: string | null) {
  if (!classId) return null;
  const [row] = await d1Query<ClassRow>(
    `SELECT c.id, c.teacher_id, c.name
       FROM classes c
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND c.id = ?
        AND c.teacher_id = ?
        AND c.is_active = 1
      LIMIT 1`,
    [...classScopeParams(tenantId), classId, userId],
  );
  return row ?? null;
}

async function getClassStudents(classId: string, tenantId: string) {
  return d1Query<StudentRow>(
    `SELECT p.id, p.email, p.full_name, p.preferences
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       JOIN profiles p ON p.id = ce.student_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND ce.class_id = ?
        AND ce.is_active = 1
        AND c.is_active = 1
        AND p.role = 'student'`,
    [...classScopeParams(tenantId), classId],
  );
}

async function notifyClassStudents({
  students,
  actorId,
  title,
  message,
  actionUrl,
  priority,
  metadata,
}: {
  students: StudentRow[];
  actorId: string;
  title: string;
  message: string;
  actionUrl: string;
  priority: "low" | "normal" | "high";
  metadata: Record<string, unknown>;
}) {
  await Promise.all(
    students.map((student) => {
      const preferences = parsePreferences(student.preferences);
      const wantsEmail =
        preferences.email_notifications !== false &&
        preferences.assignment_notifications !== false;

      return notifyAndEmail({
        userId: student.id,
        actorId,
        type: String(metadata.type ?? "planner"),
        title,
        message,
        actionUrl,
        priority,
        channels: wantsEmail ? ["in_app", "email"] : ["in_app"],
        metadata,
        email: wantsEmail
          ? {
              recipientUserId: student.id,
              recipientEmail: student.email,
              subject: `EdSync: ${title}`,
              bodyText: `Hi ${student.full_name || "there"},\n\n${message}\n\nOpen EdSync: ${process.env.NEXT_PUBLIC_APP_URL || ""}${actionUrl}`,
              metadata,
            }
          : null,
      });
    }),
  );
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonError("Authentication required.", 401);
  const context = await resolveTenantContext(user);

  const role = user.user_metadata.role;
  if (role === "teacher") {
    const [announcements, events] = await Promise.all([
      d1Query(
        `SELECT a.*, c.name AS class_name
           FROM announcements a
           LEFT JOIN classes c ON c.id = a.class_id
           ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND a.teacher_id = ?
          ORDER BY datetime(a.publish_at) DESC, datetime(a.created_at) DESC
          LIMIT 20`,
        [...classScopeParams(context.tenant.id), user.id],
      ),
      d1Query(
        `SELECT e.*, c.name AS class_name, l.title AS lesson_title
           FROM schedule_events e
           LEFT JOIN classes c ON c.id = e.class_id
           LEFT JOIN lessons l ON l.id = e.lesson_id
           ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
          WHERE (e.owner_id = ? AND e.class_id IS NULL)
             OR (${tenantObjectPredicate({ linkAlias: "class_link" })}
                AND (e.owner_id = ? OR c.teacher_id = ?))
          ORDER BY COALESCE(e.due_at, e.starts_at, e.created_at) ASC
          LIMIT 30`,
        [
          classScopeParams(context.tenant.id)[0],
          user.id,
          ...classPredicateParams(context.tenant.id),
          user.id,
          user.id,
        ],
      ),
    ]);

    return NextResponse.json({ data: { announcements, events }, error: null });
  }

  const classRows = await d1Query<ClassRow>(
    `SELECT c.id, c.teacher_id, c.name
       FROM class_enrollments ce
       JOIN classes c ON c.id = ce.class_id
       ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
      WHERE ce.student_id = ?
        AND ${tenantObjectPredicate({ linkAlias: "class_link" })}
        AND ce.is_active = 1
        AND c.is_active = 1`,
    [classScopeParams(context.tenant.id)[0], user.id, ...classPredicateParams(context.tenant.id)],
  );
  const classIds = classRows.map((row) => row.id);
  if (classIds.length === 0) {
    return NextResponse.json({ data: { announcements: [], events: [] }, error: null });
  }

  const classPlaceholders = sqlInPlaceholders(classIds);
  const [announcements, events] = await Promise.all([
    d1Query(
      `SELECT a.*, c.name AS class_name
         FROM announcements a
         LEFT JOIN classes c ON c.id = a.class_id
        WHERE a.class_id IN (${classPlaceholders})
          AND datetime(a.publish_at) <= datetime('now')
          AND (a.expires_at IS NULL OR datetime(a.expires_at) >= datetime('now'))
        ORDER BY datetime(a.publish_at) DESC, datetime(a.created_at) DESC
        LIMIT 20`,
      classIds,
    ),
    d1Query(
      `SELECT e.*, c.name AS class_name, l.title AS lesson_title
         FROM schedule_events e
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN lessons l ON l.id = e.lesson_id
        WHERE (e.class_id IN (${classPlaceholders}) AND e.visibility IN ('class', 'student'))
           OR (e.owner_id = ? AND e.visibility = 'student')
        ORDER BY COALESCE(e.due_at, e.starts_at, e.created_at) ASC
        LIMIT 30`,
      [...classIds, user.id],
    ),
  ]);

  return NextResponse.json({ data: { announcements, events }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Authentication required.", 401);
  const context = await resolveTenantContext(user);

  const body = (await request.json()) as PlannerPayload;
  let title: string;
  let bodyText: string | null;
  let description: string | null;
  let startsAt: string | null;
  let endsAt: string | null;
  let dueAt: string | null;
  let location: string | null;
  let priority: "low" | "normal" | "high";
  let eventType: "deadline" | "class" | "office_hours" | "study" | "announcement" | "other";

  try {
    title = normalizePlannerText(body.title, "Title", PLANNER_TITLE_MAX_LENGTH);
    bodyText = normalizePlannerText(body.body, "Body", PLANNER_BODY_MAX_LENGTH, false);
    description = normalizePlannerText(body.description ?? body.body, "Details", PLANNER_BODY_MAX_LENGTH, false);
    startsAt = normalizePlannerDateTime(body.startsAt, "Start time");
    endsAt = normalizePlannerDateTime(body.endsAt, "End time");
    dueAt = normalizePlannerDateTime(body.dueAt, "Due time");
    location = normalizePlannerText(body.location, "Location", PLANNER_LOCATION_MAX_LENGTH, false);
    priority = normalizePlannerPriority(body.priority);
    eventType = normalizePlannerEventType(body.eventType, dueAt ? "deadline" : "class");
    validatePlannerDateOrder({ startsAt, endsAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Planner payload is invalid.";
    return jsonError(message, 400);
  }

  const role = user.user_metadata.role;
  const now = new Date().toISOString();

  if (role === "student") {
    const eventId = crypto.randomUUID();
    await d1Query(
      `INSERT INTO schedule_events (
         id, owner_id, class_id, lesson_id, title, description, event_type,
         starts_at, ends_at, due_at, location, visibility, metadata, created_at, updated_at
       ) VALUES (?, ?, NULL, NULL, ?, ?, 'study', ?, ?, ?, ?, 'student', '{}', datetime('now'), datetime('now'))`,
      [
        eventId,
        user.id,
        title,
        description,
        startsAt,
        endsAt,
        dueAt,
        location,
      ],
    );
    return NextResponse.json({ data: { id: eventId }, error: null });
  }

  const classRow = await getTeacherClass(user.id, context.tenant.id, body.classId);
  if (!classRow) return jsonError("Choose one of your active classes.", 400);

  const students = await getClassStudents(classRow.id, context.tenant.id);
  if (body.kind === "announcement") {
    if (!bodyText) return jsonError("Announcement body is required.", 400);

    const announcementId = crypto.randomUUID();
    await d1Query(
      `INSERT INTO announcements (
         id, teacher_id, class_id, title, body, priority, audience,
         publish_at, expires_at, metadata, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'class', ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        announcementId,
        user.id,
        classRow.id,
        title,
        bodyText,
        priority,
        startsAt ?? now,
        endsAt,
        JSON.stringify({ className: classRow.name, type: "announcement" }),
      ],
    );

    await notifyClassStudents({
      students,
      actorId: user.id,
      title,
      message: bodyText,
      actionUrl: "/student/dashboard",
      priority,
      metadata: { type: "announcement", announcementId, classId: classRow.id },
    });

    return NextResponse.json({ data: { id: announcementId, notified: students.length }, error: null });
  }

  if (eventType === "deadline" && !dueAt) return jsonError("Due time is required for deadlines.", 400);

  const eventId = crypto.randomUUID();
  await d1Query(
    `INSERT INTO schedule_events (
       id, owner_id, class_id, lesson_id, title, description, event_type,
       starts_at, ends_at, due_at, location, visibility, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'class', ?, datetime('now'), datetime('now'))`,
    [
      eventId,
      user.id,
      classRow.id,
      body.lessonId ?? null,
      title,
      description,
      eventType,
      startsAt,
      endsAt,
      dueAt,
      location,
      JSON.stringify({ className: classRow.name, type: eventType }),
    ],
  );

  if (eventType === "deadline" || priority === "high") {
    await notifyClassStudents({
      students,
      actorId: user.id,
      title: eventType === "deadline" ? `Deadline: ${title}` : title,
      message: dueAt
        ? `${title} is due ${dueAt}.`
        : description || "A new class event was added to your schedule.",
      actionUrl: "/student/dashboard",
      priority: eventType === "deadline" ? "high" : priority,
      metadata: { type: eventType, eventId, classId: classRow.id, dueAt },
    });
  }

  return NextResponse.json({ data: { id: eventId, notified: students.length }, error: null });
}
