import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";
import { PERMISSIONS, getPermissionSet } from "@/lib/permissions";
import {
  normalizeStudioKind,
  validateStudioJsonObject,
  validateStudioTitle,
} from "@/lib/studio/validation";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";
import type { StudioItemKind } from "@/types";

type StudioDocumentRow = {
  id: string;
  tenant_id: string;
  owner_id: string | null;
  item_kind: Exclude<StudioItemKind, "lesson">;
  title: string;
  content: string;
  plain_text: string | null;
  status: "draft" | "published" | "archived";
  source_type: string | null;
  source_id: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
};

type StudioEventRow = {
  id: string;
  actor_id: string | null;
  event_type: string;
  payload: string;
  created_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ data: null, error }, { status });
}

function parseJsonObject(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return validateStudioJsonObject(parsed);
  } catch {
    return {};
  }
}

function serializeRow(row: StudioDocumentRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerId: row.owner_id,
    kind: row.item_kind,
    title: row.title,
    content: parseJsonObject(row.content),
    plainText: row.plain_text ?? "",
    status: row.status,
    sourceType: row.source_type,
    sourceId: row.source_id,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeEvent(row: StudioEventRow) {
  return {
    id: row.id,
    actorId: row.actor_id,
    eventType: row.event_type,
    payload: parseJsonObject(row.payload),
    createdAt: row.created_at,
  };
}

async function canPublish(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  tenantContext: Awaited<ReturnType<typeof resolveTenantContext>>,
) {
  const permissions = await getPermissionSet(user, tenantContext);
  return permissions.has(PERMISSIONS.coursesPublish);
}

async function assertOwnerOrAdmin(documentId: string, tenantId: string, userId: string, isAdmin: boolean) {
  const [row] = await d1Query<Pick<StudioDocumentRow, "id" | "tenant_id" | "owner_id">>(
    "SELECT id, tenant_id, owner_id FROM studio_documents WHERE id = ? LIMIT 1",
    [documentId],
  );
  if (!row) throw new Error("Studio item not found.");
  if (row.tenant_id !== tenantId) throw new Error("Studio item belongs to another tenant.");
  if (!isAdmin && row.owner_id !== userId) throw new Error("You cannot modify this Studio item.");
}

async function recordStudioEvent(input: {
  tenantId: string;
  actorId: string;
  documentId: string;
  eventType: string;
  title?: string;
  status?: string;
  kind?: string;
}) {
  await appendLearningEvent({
    tenantId: input.tenantId,
    actorId: input.actorId,
    sourceType: "studio_document",
    sourceId: input.documentId,
    eventType: input.eventType,
    payload: {
      title: input.title,
      status: input.status,
      kind: input.kind,
    },
  });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const context = await resolveTenantContext(user);
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const historyId = params.get("historyId");
  const includeArchived = params.get("includeArchived") === "true";
  const normalizedKind = kind ? normalizeStudioKind(kind) : null;
  const isAdmin = user.user_metadata.role === "admin";

  if (historyId) {
    await assertOwnerOrAdmin(historyId, context.tenant.id, user.id, isAdmin);
    const events = await d1Query<StudioEventRow>(
      `SELECT id, actor_id, event_type, payload, created_at
         FROM learning_events
        WHERE tenant_id = ?
          AND source_type = 'studio_document'
          AND source_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      [context.tenant.id, historyId],
    );
    return jsonResponse({ events: events.map(serializeEvent) });
  }

  const where = [
    "tenant_id = ?",
    isAdmin ? "1 = 1" : "owner_id = ?",
    normalizedKind ? "item_kind = ?" : "1 = 1",
    includeArchived ? "1 = 1" : "status != 'archived'",
  ].join(" AND ");
  const values = [
    context.tenant.id,
    ...(isAdmin ? [] : [user.id]),
    ...(normalizedKind ? [normalizedKind] : []),
  ];

  const rows = await d1Query<StudioDocumentRow>(
    `SELECT *
       FROM studio_documents
      WHERE ${where}
      ORDER BY updated_at DESC
      LIMIT 100`,
    values,
  );

  return jsonResponse({
    items: rows.map(serializeRow),
    context: { tenantId: context.tenant.id, portalId: context.portal?.id ?? null },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    id?: string;
    kind?: StudioItemKind;
    title?: string;
    content?: Record<string, unknown>;
    plainText?: string;
    status?: "draft" | "published";
    sourceType?: string | null;
    sourceId?: string | null;
    metadata?: Record<string, unknown>;
  };
  let title: string;
  let content: Record<string, unknown>;
  try {
    title = validateStudioTitle(body.title);
    content = validateStudioJsonObject(body.content);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid Studio item.", 400);
  }
  if (body.status === "published" && !(await canPublish(user, context))) {
    return errorResponse("Publishing permission is required.", 403);
  }

  const id = body.id || crypto.randomUUID();
  let existed = false;
  if (body.id) {
    const existing = await d1Query<Pick<StudioDocumentRow, "id" | "tenant_id" | "owner_id">>(
      "SELECT id, tenant_id, owner_id FROM studio_documents WHERE id = ? LIMIT 1",
      [body.id],
    );
    if (existing[0]) {
      existed = true;
      if (existing[0].tenant_id !== context.tenant.id) return errorResponse("Studio item belongs to another tenant.", 403);
      if (user.user_metadata.role !== "admin" && existing[0].owner_id !== user.id) {
        return errorResponse("You cannot modify this Studio item.", 403);
      }
    }
  }
  const kind = normalizeStudioKind(body.kind);
  const metadata = {
    ...validateStudioJsonObject(body.metadata),
    originalKind: body.kind === "lesson" ? "lesson" : kind,
  };

  await d1Query(
    `INSERT INTO studio_documents (
       id, tenant_id, owner_id, item_kind, title, content, plain_text, status,
       source_type, source_id, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       plain_text = excluded.plain_text,
       status = excluded.status,
       source_type = excluded.source_type,
       source_id = excluded.source_id,
       metadata = excluded.metadata,
       updated_at = datetime('now')`,
    [
      id,
      context.tenant.id,
      user.id,
      kind,
      title,
      JSON.stringify(content),
      body.plainText ?? null,
      body.status === "published" ? "published" : "draft",
      body.sourceType ?? null,
      body.sourceId ?? null,
      JSON.stringify(metadata),
    ],
  );
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "studio_documents", objectId: id });
  await recordStudioEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    documentId: id,
    eventType: existed ? "studio.document.updated" : "studio.document.created",
    title,
    status: body.status === "published" ? "published" : "draft",
    kind,
  });

  const [row] = await d1Query<StudioDocumentRow>("SELECT * FROM studio_documents WHERE id = ? LIMIT 1", [id]);
  return jsonResponse({ item: row ? serializeRow(row) : { id } }, 201);
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    content?: Record<string, unknown>;
    plainText?: string;
    status?: "draft" | "published" | "archived";
    metadata?: Record<string, unknown>;
  };
  if (!body.id) return errorResponse("Studio item id is required.", 400);
  await assertOwnerOrAdmin(body.id, context.tenant.id, user.id, user.user_metadata.role === "admin");
  if (body.status === "published" && !(await canPublish(user, context))) {
    return errorResponse("Publishing permission is required.", 403);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.title?.trim()) {
    updates.push("title = ?");
    try {
      values.push(validateStudioTitle(body.title));
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Invalid title.", 400);
    }
  }
  if (body.content) {
    updates.push("content = ?");
    try {
      values.push(JSON.stringify(validateStudioJsonObject(body.content)));
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Invalid Studio content.", 400);
    }
  }
  if (typeof body.plainText === "string") {
    updates.push("plain_text = ?");
    values.push(body.plainText);
  }
  if (body.status) {
    updates.push("status = ?");
    values.push(body.status);
  }
  if (body.metadata) {
    updates.push("metadata = ?");
    values.push(JSON.stringify(validateStudioJsonObject(body.metadata)));
  }
  if (updates.length === 0) return errorResponse("No changes provided.", 400);

  await d1Query(
    `UPDATE studio_documents SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`,
    [...values, body.id, context.tenant.id],
  );
  const [row] = await d1Query<StudioDocumentRow>("SELECT * FROM studio_documents WHERE id = ? LIMIT 1", [body.id]);
  await recordStudioEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    documentId: body.id,
    eventType:
      body.status === "published"
        ? "studio.document.published"
        : body.status === "archived"
          ? "studio.document.archived"
          : body.status === "draft"
            ? "studio.document.restored"
            : "studio.document.updated",
    title: row?.title,
    status: row?.status,
    kind: row?.item_kind,
  });
  return jsonResponse({ item: row ? serializeRow(row) : null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const context = await resolveTenantContext(user);
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const hard = params.get("hard") === "true";
  if (!id) return errorResponse("Studio item id is required.", 400);

  await assertOwnerOrAdmin(id, context.tenant.id, user.id, user.user_metadata.role === "admin");
  if (hard) {
    await recordStudioEvent({
      tenantId: context.tenant.id,
      actorId: user.id,
      documentId: id,
      eventType: "studio.document.deleted",
    });
    await d1Query("DELETE FROM studio_documents WHERE id = ? AND tenant_id = ?", [id, context.tenant.id]);
    return jsonResponse({ id, deleted: true });
  }

  await d1Query(
    "UPDATE studio_documents SET status = 'archived', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [id, context.tenant.id],
  );
  await recordStudioEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    documentId: id,
    eventType: "studio.document.archived",
    status: "archived",
  });
  return jsonResponse({ id, archived: true });
}
