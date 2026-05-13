import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const portals = await d1Query("SELECT * FROM tenant_portals WHERE tenant_id = ? ORDER BY is_default DESC, name", [context.tenant.id]);
  const domains = await d1Query("SELECT * FROM tenant_domains WHERE tenant_id = ? ORDER BY hostname", [context.tenant.id]);
  return NextResponse.json({ data: { portals, domains, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.portalsManage);

  const body = (await request.json()) as { name?: string; slug?: string; audience?: string; domain?: string | null };
  const slug = (body.slug || body.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!body.name || !slug) return NextResponse.json({ data: null, error: "Portal name is required." }, { status: 400 });
  const portalId = crypto.randomUUID();
  await d1Query(
    `INSERT INTO tenant_portals (id, tenant_id, slug, name, audience, domain, theme, catalog_settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{"theme":"light"}', '{}', datetime('now'), datetime('now'))`,
    [
      portalId,
      context.tenant.id,
      slug,
      body.name.trim(),
      ["internal", "customer", "partner", "public"].includes(body.audience || "") ? body.audience : "internal",
      body.domain ?? null,
    ],
  );
  if (body.domain) {
    await d1Query(
      `INSERT INTO tenant_domains (id, tenant_id, portal_id, hostname, status, verification_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
      [crypto.randomUUID(), context.tenant.id, portalId, body.domain.toLowerCase(), crypto.randomUUID()],
    );
  }
  return NextResponse.json({ data: { id: portalId }, error: null });
}
