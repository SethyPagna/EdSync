import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeAudience(value: string | undefined) {
  return ["internal", "customer", "partner", "public"].includes(value || "") ? value : "internal";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const portalRows = await d1Query("SELECT * FROM tenant_portals WHERE tenant_id = ? ORDER BY is_default DESC, name", [context.tenant.id]);
  const domains = await d1Query("SELECT * FROM tenant_domains WHERE tenant_id = ? ORDER BY hostname", [context.tenant.id]);
  const portals = portalRows.map((row) => deserializeRow("tenant_portals", row));
  return NextResponse.json({ data: { portals, domains, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.portalsManage);

  const body = (await request.json()) as {
    action?: "create" | "update" | "delete" | "toggle_public" | "make_default";
    id?: string;
    name?: string;
    slug?: string;
    audience?: string;
    domain?: string | null;
    catalogEnabled?: boolean;
    featuredOnly?: boolean;
  };

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ data: null, error: "Portal is required." }, { status: 400 });
    const [portal] = await d1Query<{ is_default: number }>(
      "SELECT is_default FROM tenant_portals WHERE id = ? AND tenant_id = ? LIMIT 1",
      [body.id, context.tenant.id],
    );
    if (!portal) return NextResponse.json({ data: null, error: "Portal not found." }, { status: 404 });
    if (portal.is_default) return NextResponse.json({ data: null, error: "Default portal cannot be deleted." }, { status: 400 });
    await d1Query("UPDATE tenant_object_links SET portal_id = NULL WHERE tenant_id = ? AND portal_id = ?", [context.tenant.id, body.id]);
    await d1Query("DELETE FROM tenant_domains WHERE tenant_id = ? AND portal_id = ?", [context.tenant.id, body.id]);
    await d1Query("DELETE FROM tenant_portals WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.id]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (body.action === "make_default") {
    if (!body.id) return NextResponse.json({ data: null, error: "Portal is required." }, { status: 400 });
    await d1Query("UPDATE tenant_portals SET is_default = 0, updated_at = datetime('now') WHERE tenant_id = ?", [context.tenant.id]);
    await d1Query("UPDATE tenant_portals SET is_default = 1, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
      context.tenant.id,
      body.id,
    ]);
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  if (body.action === "toggle_public") {
    if (!body.id) return NextResponse.json({ data: null, error: "Portal is required." }, { status: 400 });
    const [portal] = await d1Query<{ audience: string }>(
      "SELECT audience FROM tenant_portals WHERE id = ? AND tenant_id = ? LIMIT 1",
      [body.id, context.tenant.id],
    );
    if (!portal) return NextResponse.json({ data: null, error: "Portal not found." }, { status: 404 });
    const nextAudience = portal.audience === "public" ? "internal" : "public";
    await d1Query("UPDATE tenant_portals SET audience = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
      nextAudience,
      context.tenant.id,
      body.id,
    ]);
    return NextResponse.json({ data: { id: body.id, audience: nextAudience }, error: null });
  }

  if (body.action === "update") {
    if (!body.id || !body.name?.trim()) {
      return NextResponse.json({ data: null, error: "Portal name is required." }, { status: 400 });
    }
    const slug = normalizeSlug(body.slug || body.name);
    if (!slug) return NextResponse.json({ data: null, error: "Portal slug is required." }, { status: 400 });
    const catalogSettings = {
      enabled: body.catalogEnabled !== false,
      featuredOnly: Boolean(body.featuredOnly),
    };
    await d1Query(
      `UPDATE tenant_portals
       SET slug = ?, name = ?, audience = ?, domain = ?, catalog_settings = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        slug,
        body.name.trim(),
        normalizeAudience(body.audience),
        body.domain || null,
        catalogSettings,
        context.tenant.id,
        body.id,
      ],
    );
    await d1Query("DELETE FROM tenant_domains WHERE tenant_id = ? AND portal_id = ?", [context.tenant.id, body.id]);
    if (body.domain) {
      await d1Query(
        `INSERT INTO tenant_domains (id, tenant_id, portal_id, hostname, status, verification_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
        [crypto.randomUUID(), context.tenant.id, body.id, body.domain.toLowerCase(), crypto.randomUUID()],
      );
    }
    return NextResponse.json({ data: { id: body.id }, error: null });
  }

  const slug = normalizeSlug(body.slug || body.name || "");
  if (!body.name || !slug) return NextResponse.json({ data: null, error: "Portal name is required." }, { status: 400 });
  const portalId = crypto.randomUUID();
  const catalogSettings = {
    enabled: body.catalogEnabled !== false,
    featuredOnly: Boolean(body.featuredOnly),
  };
  await d1Query(
    `INSERT INTO tenant_portals (id, tenant_id, slug, name, audience, domain, theme, catalog_settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{"theme":"light"}', ?, datetime('now'), datetime('now'))`,
    [
      portalId,
      context.tenant.id,
      slug,
      body.name.trim(),
      normalizeAudience(body.audience),
      body.domain ?? null,
      catalogSettings,
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
