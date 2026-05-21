import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";
import type { NormalizedLearningEventInput } from "@/lib/learning-events-validation";
import { normalizeLearningEventInput } from "@/lib/learning-events-validation";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext, type TenantContext } from "@/lib/tenancy";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";

const CLASS_TABLE = "classes";
const LESSON_TABLE = "lessons";
const WORK_ITEM_TABLE = "learning_work_items";

function predicateParams(objectTable: string, tenantId: string) {
  return tenantObjectParams({ objectTable, tenantId }).slice(1);
}

async function canReferenceStudioDocument(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    `SELECT id
       FROM studio_documents
      WHERE id = ?
        AND tenant_id = ?
        AND (owner_id = ? OR status = 'published' OR ? = 'admin')
      LIMIT 1`,
    [input.sourceId, input.context.tenant.id, input.user.id, input.user.user_metadata.role],
  );
  return Boolean(row);
}

async function canReferenceContentBlock(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    `SELECT id
       FROM content_blocks
      WHERE id = ?
        AND tenant_id = ?
        AND (owner_id = ? OR status = 'published' OR ? = 'admin')
      LIMIT 1`,
    [input.sourceId, input.context.tenant.id, input.user.id, input.user.user_metadata.role],
  );
  return Boolean(row);
}

async function canReferenceLesson(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  const [row] = await d1Query<{ id: string }>(
    `SELECT l.id
       FROM lessons l
       ${tenantObjectJoin({ objectTable: LESSON_TABLE, objectAlias: "l", linkAlias: "lesson_link" })}
       LEFT JOIN classes c ON c.id = l.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE l.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "lesson_link" })}
          OR (l.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (
          ? = 1
          OR l.teacher_id = ?
          OR l.class_id IS NULL
          OR EXISTS (
            SELECT 1
              FROM class_enrollments ce
             WHERE ce.class_id = l.class_id
               AND ce.student_id = ?
               AND ce.is_active = 1
          )
        )
      LIMIT 1`,
    [
      LESSON_TABLE,
      CLASS_TABLE,
      input.sourceId,
      ...predicateParams(LESSON_TABLE, input.context.tenant.id),
      ...predicateParams(CLASS_TABLE, input.context.tenant.id),
      isAdmin ? 1 : 0,
      input.user.id,
      input.user.id,
    ],
  );
  return Boolean(row);
}

async function canReferenceWorkItem(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const isAdmin = input.user.user_metadata.role === "admin";
  const [row] = await d1Query<{ id: string }>(
    `SELECT wi.id
       FROM learning_work_items wi
       ${tenantObjectJoin({ objectTable: WORK_ITEM_TABLE, objectAlias: "wi", linkAlias: "work_link" })}
       LEFT JOIN classes c ON c.id = wi.class_id
       ${tenantObjectJoin({ objectTable: CLASS_TABLE, objectAlias: "c", linkAlias: "class_link" })}
      WHERE wi.id = ?
        AND (${tenantObjectPredicate({ linkAlias: "work_link" })}
          OR (wi.class_id IS NOT NULL AND ${tenantObjectPredicate({ linkAlias: "class_link" })}))
        AND (
          ? = 1
          OR wi.teacher_id = ?
          OR wi.class_id IS NULL
          OR EXISTS (
            SELECT 1
              FROM class_enrollments ce
             WHERE ce.class_id = wi.class_id
               AND ce.student_id = ?
               AND ce.is_active = 1
          )
        )
      LIMIT 1`,
    [
      WORK_ITEM_TABLE,
      CLASS_TABLE,
      input.sourceId,
      ...predicateParams(WORK_ITEM_TABLE, input.context.tenant.id),
      ...predicateParams(CLASS_TABLE, input.context.tenant.id),
      isAdmin ? 1 : 0,
      input.user.id,
      input.user.id,
    ],
  );
  return Boolean(row);
}

async function canReferencePracticeAttempt(input: {
  user: SessionUser;
  context: TenantContext;
  sourceId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    `SELECT id
       FROM practice_attempts
      WHERE id = ?
        AND tenant_id = ?
        AND user_id = ?
      LIMIT 1`,
    [input.sourceId, input.context.tenant.id, input.user.id],
  );
  return Boolean(row);
}

async function canReferenceLearningEventSource(input: {
  user: SessionUser;
  context: TenantContext;
  event: NormalizedLearningEventInput;
}) {
  if (!input.event.sourceId) return true;
  if (input.event.sourceType === "studio" || input.event.sourceType === "studio_document") {
    return canReferenceStudioDocument({ user: input.user, context: input.context, sourceId: input.event.sourceId });
  }
  if (input.event.sourceType === "content_block") {
    return canReferenceContentBlock({ user: input.user, context: input.context, sourceId: input.event.sourceId });
  }
  if (input.event.sourceType === "lesson" || input.event.sourceType === "lesson_quiz") {
    return canReferenceLesson({ user: input.user, context: input.context, sourceId: input.event.sourceId });
  }
  if (input.event.sourceType === "learning_work_item") {
    return canReferenceWorkItem({ user: input.user, context: input.context, sourceId: input.event.sourceId });
  }
  if (input.event.sourceType === "practice") {
    return canReferencePracticeAttempt({ user: input.user, context: input.context, sourceId: input.event.sourceId });
  }
  return true;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.reportsView);
  const events = await d1Query(
    "SELECT * FROM learning_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
    [context.tenant.id],
  );
  return NextResponse.json({ data: { events, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    sourceType?: string;
    sourceId?: string | null;
    eventType?: string;
    payload?: Record<string, unknown>;
  };
  let event;
  try {
    event = normalizeLearningEventInput(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid learning event." },
      { status: 400 },
    );
  }
  const canReferenceSource = await canReferenceLearningEventSource({ user, context, event });
  if (!canReferenceSource) {
    return NextResponse.json({ data: null, error: "Event source not found." }, { status: 404 });
  }
  const id = await appendLearningEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    studentId: user.user_metadata.role === "student" ? user.id : null,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    eventType: event.eventType,
    payload: event.payload,
  });
  return NextResponse.json({ data: { id }, error: null });
}
