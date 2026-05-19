import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  normalizeContentBlockTags,
  normalizeContentBlockType,
  validateContentBlockData,
  validateContentBlockStatus,
  validateContentBlockTitle,
} from "@/lib/studio/content-block-validation";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";

type ContentBlockRow = {
  id: string;
  tenant_id: string;
  owner_id: string | null;
  block_type: string;
  title: string;
  data: string;
  version: number;
  status: "draft" | "published" | "archived";
  tags: string;
  created_at: string;
  updated_at: string;
};

function parseJson(value: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function serializeBlock(row: ContentBlockRow) {
  const tags = parseJson(row.tags);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerId: row.owner_id,
    blockType: row.block_type,
    title: row.title,
    data: parseJson(row.data),
    version: row.version,
    status: row.status,
    tags: Array.isArray(tags) ? (tags as string[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message }, { status });
}

async function assertBlockOwner(input: {
  blockId: string;
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const [row] = await d1Query<Pick<ContentBlockRow, "id" | "tenant_id" | "owner_id">>(
    "SELECT id, tenant_id, owner_id FROM content_blocks WHERE id = ? LIMIT 1",
    [input.blockId],
  );
  if (!row) throw new Error("Content block not found.");
  if (row.tenant_id !== input.tenantId) throw new Error("Content block belongs to another tenant.");
  if (!input.isAdmin && row.owner_id !== input.userId) throw new Error("You cannot modify this content block.");
}

async function recordBlockEvent(input: {
  tenantId: string;
  actorId: string;
  blockId: string;
  eventType: string;
  title?: string;
  status?: string;
  blockType?: string;
}) {
  await appendLearningEvent({
    tenantId: input.tenantId,
    actorId: input.actorId,
    sourceType: "content_block",
    sourceId: input.blockId,
    eventType: input.eventType,
    payload: {
      title: input.title,
      status: input.status,
      blockType: input.blockType,
    },
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const blocks = await d1Query<ContentBlockRow>(
    "SELECT * FROM content_blocks WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 100",
    [context.tenant.id],
  );
  return NextResponse.json({ data: { blocks: blocks.map(serializeBlock), context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  const body = (await request.json()) as { title?: string; blockType?: string; data?: Record<string, unknown>; tags?: string[]; status?: string };
  let title: string;
  let data: Record<string, unknown>;
  let status: "draft" | "published";
  try {
    title = validateContentBlockTitle(body.title);
    data = validateContentBlockData(body.data);
    status = validateContentBlockStatus(body.status, { allowArchived: false }) as "draft" | "published";
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid content block.");
  }
  const blockType = normalizeContentBlockType(body.blockType);
  const tags = normalizeContentBlockTags(body.tags);
  if (status === "published") await requirePermission(user, context, PERMISSIONS.coursesPublish);
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO content_blocks (id, tenant_id, owner_id, block_type, title, data, version, status, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      user.id,
      blockType,
      title,
      JSON.stringify(data),
      status,
      JSON.stringify(tags),
    ],
  );
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "content_blocks", objectId: id });
  await recordBlockEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    blockId: id,
    eventType: "content_block.created",
    title,
    status,
    blockType,
  });
  const [row] = await d1Query<ContentBlockRow>("SELECT * FROM content_blocks WHERE id = ? LIMIT 1", [id]);
  return NextResponse.json({ data: { block: row ? serializeBlock(row) : { id } }, error: null });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);

  const body = (await request.json()) as {
    id?: string;
    title?: string;
    blockType?: string;
    data?: Record<string, unknown>;
    tags?: string[];
    status?: "draft" | "published" | "archived";
  };
  if (!body.id) return jsonError("Content block id is required.");
  await assertBlockOwner({
    blockId: body.id,
    tenantId: context.tenant.id,
    userId: user.id,
    isAdmin: user.user_metadata.role === "admin",
  });

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.title !== undefined) {
    let title: string;
    try {
      title = validateContentBlockTitle(body.title);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid content block title.");
    }
    updates.push("title = ?");
    values.push(title);
  }
  if (body.blockType !== undefined) {
    updates.push("block_type = ?");
    values.push(normalizeContentBlockType(body.blockType));
  }
  if (body.data !== undefined) {
    let data: Record<string, unknown>;
    try {
      data = validateContentBlockData(body.data);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid content block data.");
    }
    updates.push("data = ?");
    values.push(JSON.stringify(data));
  }
  if (body.tags !== undefined) {
    updates.push("tags = ?");
    values.push(JSON.stringify(normalizeContentBlockTags(body.tags)));
  }
  let status: "draft" | "published" | "archived" | null = null;
  if (body.status !== undefined) {
    try {
      status = validateContentBlockStatus(body.status);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid content block status.");
    }
    if (status === "published") await requirePermission(user, context, PERMISSIONS.coursesPublish);
    updates.push("status = ?");
    values.push(status);
  }
  if (updates.length === 0) return jsonError("No changes provided.");

  await d1Query(
    `UPDATE content_blocks
        SET ${updates.join(", ")}, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?`,
    [...values, body.id, context.tenant.id],
  );
  const [row] = await d1Query<ContentBlockRow>("SELECT * FROM content_blocks WHERE id = ? LIMIT 1", [body.id]);
  await recordBlockEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    blockId: body.id,
    eventType:
      status === "published"
        ? "content_block.published"
        : status === "archived"
          ? "content_block.archived"
          : "content_block.updated",
    title: row?.title,
    status: row?.status,
    blockType: row?.block_type,
  });
  return NextResponse.json({ data: { block: row ? serializeBlock(row) : null }, error: null });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);

  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const hard = params.get("hard") === "true";
  if (!id) return jsonError("Content block id is required.");
  await assertBlockOwner({
    blockId: id,
    tenantId: context.tenant.id,
    userId: user.id,
    isAdmin: user.user_metadata.role === "admin",
  });

  if (hard) {
    await recordBlockEvent({
      tenantId: context.tenant.id,
      actorId: user.id,
      blockId: id,
      eventType: "content_block.deleted",
    });
    await d1Query("DELETE FROM content_blocks WHERE id = ? AND tenant_id = ?", [id, context.tenant.id]);
    return NextResponse.json({ data: { id, deleted: true }, error: null });
  }

  await d1Query(
    "UPDATE content_blocks SET status = 'archived', version = version + 1, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [id, context.tenant.id],
  );
  await recordBlockEvent({
    tenantId: context.tenant.id,
    actorId: user.id,
    blockId: id,
    eventType: "content_block.archived",
    status: "archived",
  });
  return NextResponse.json({ data: { id, archived: true }, error: null });
}
