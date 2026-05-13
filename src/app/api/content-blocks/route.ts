import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { linkTenantObject, resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const blocks = await d1Query(
    "SELECT * FROM content_blocks WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 100",
    [context.tenant.id],
  );
  return NextResponse.json({ data: { blocks, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  const body = (await request.json()) as { title?: string; blockType?: string; data?: Record<string, unknown>; tags?: string[]; status?: string };
  if (!body.title) return NextResponse.json({ data: null, error: "Title is required." }, { status: 400 });
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO content_blocks (id, tenant_id, owner_id, block_type, title, data, version, status, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      user.id,
      body.blockType || "rich_text",
      body.title.trim(),
      JSON.stringify(body.data ?? {}),
      body.status === "published" ? "published" : "draft",
      JSON.stringify(body.tags ?? []),
    ],
  );
  await linkTenantObject({ tenantId: context.tenant.id, portalId: context.portal?.id, table: "content_blocks", objectId: id });
  return NextResponse.json({ data: { id }, error: null });
}
