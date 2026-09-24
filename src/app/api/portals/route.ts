import { portalAddress, portalBaseDomain } from "@/lib/tenancy/domains";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Batch, d1Query } from "@/lib/db/d1";
import type { D1Statement } from "@/lib/db/d1-adapter";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import {
  normalizePortalInput,
  validatePortalId,
} from "@/lib/validation/portal";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.portalsManage);
  } catch {
    return NextResponse.json(
      { data: null, error: "Missing portal management permission." },
      { status: 403 },
    );
  }
  const portalRows = await d1Query(
    "SELECT * FROM tenant_portals WHERE tenant_id = ? ORDER BY is_default DESC, name",
    [context.tenant.id],
  );
  const domains = await d1Query(
    "SELECT * FROM tenant_domains WHERE tenant_id = ? ORDER BY hostname",
    [context.tenant.id],
  );
  const baseDomain = portalBaseDomain();
  const portals = portalRows.map((row) => ({
    ...deserializeRow("tenant_portals", row),
    address: portalAddress(context.tenant.slug, String(row.slug), baseDomain),
  }));
  return NextResponse.json({
    data: { portals, domains, context, baseDomain },
    error: null,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.portalsManage);
  } catch {
    return NextResponse.json(
      { data: null, error: "Missing portal management permission." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    action?: "create" | "update" | "delete" | "toggle_public" | "make_default";
    id?: string;
    name?: string;
    slug?: string;
    audience?: string;
    domain?: string | null;
    catalogEnabled?: boolean;
    featuredOnly?: boolean;
  } | null;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { data: null, error: "Invalid portal request." },
      { status: 400 },
    );
  if (
    body.action &&
    !["create", "update", "delete", "toggle_public", "make_default"].includes(
      body.action,
    )
  )
    return NextResponse.json(
      { data: null, error: "Unknown portal action." },
      { status: 400 },
    );

  if (body.action === "delete") {
    let id: string;
    try {
      id = validatePortalId(body.id);
    } catch (error) {
      return NextResponse.json(
        {
          data: null,
          error: error instanceof Error ? error.message : "Portal is required.",
        },
        { status: 400 },
      );
    }
    const [portal] = await d1Query<{ is_default: number }>(
      "SELECT is_default FROM tenant_portals WHERE id = ? AND tenant_id = ? LIMIT 1",
      [id, context.tenant.id],
    );
    if (!portal)
      return NextResponse.json(
        { data: null, error: "Portal not found." },
        { status: 404 },
      );
    if (portal.is_default)
      return NextResponse.json(
        { data: null, error: "Default portal cannot be deleted." },
        { status: 400 },
      );
    await d1Batch([
      {
        sql: "UPDATE tenant_object_links SET portal_id = NULL WHERE tenant_id = ? AND portal_id = ?",
        params: [context.tenant.id, id],
      },
      {
        sql: "DELETE FROM tenant_domains WHERE tenant_id = ? AND portal_id = ?",
        params: [context.tenant.id, id],
      },
      {
        sql: "DELETE FROM tenant_portals WHERE tenant_id = ? AND id = ?",
        params: [context.tenant.id, id],
      },
    ]);
    return NextResponse.json({ data: { id }, error: null });
  }

  if (body.action === "make_default") {
    let id: string;
    try {
      id = validatePortalId(body.id);
    } catch (error) {
      return NextResponse.json(
        {
          data: null,
          error: error instanceof Error ? error.message : "Portal is required.",
        },
        { status: 400 },
      );
    }
    const [target] = await d1Query(
      "SELECT id FROM tenant_portals WHERE tenant_id = ? AND id = ? LIMIT 1",
      [context.tenant.id, id],
    );
    if (!target)
      return NextResponse.json(
        { data: null, error: "Portal not found." },
        { status: 404 },
      );
    // One statement: readers cannot observe a tenant with no default between two updates.
    await d1Query(
      "UPDATE tenant_portals SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE tenant_id = ? AND EXISTS (SELECT 1 FROM tenant_portals WHERE tenant_id = ? AND id = ?)",
      [id, context.tenant.id, context.tenant.id, id],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  if (body.action === "toggle_public") {
    let id: string;
    try {
      id = validatePortalId(body.id);
    } catch (error) {
      return NextResponse.json(
        {
          data: null,
          error: error instanceof Error ? error.message : "Portal is required.",
        },
        { status: 400 },
      );
    }
    const [portal] = await d1Query<{ audience: string }>(
      "SELECT audience FROM tenant_portals WHERE id = ? AND tenant_id = ? LIMIT 1",
      [id, context.tenant.id],
    );
    if (!portal)
      return NextResponse.json(
        { data: null, error: "Portal not found." },
        { status: 404 },
      );
    const nextAudience = portal.audience === "public" ? "internal" : "public";
    await d1Query(
      "UPDATE tenant_portals SET audience = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [nextAudience, context.tenant.id, id],
    );
    return NextResponse.json({
      data: { id, audience: nextAudience },
      error: null,
    });
  }

  if (body.action === "update") {
    let id: string;
    let portal: ReturnType<typeof normalizePortalInput>;
    try {
      id = validatePortalId(body.id);
      portal = normalizePortalInput(body);
    } catch (error) {
      return NextResponse.json(
        {
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Portal payload is invalid.",
        },
        { status: 400 },
      );
    }
    const [existing] = await d1Query<{ domain: string | null }>(
      "SELECT domain FROM tenant_portals WHERE tenant_id = ? AND id = ? LIMIT 1",
      [context.tenant.id, id],
    );
    if (!existing)
      return NextResponse.json(
        { data: null, error: "Portal not found." },
        { status: 404 },
      );
    const conflict = await portalConflict(
      context.tenant.id,
      portal.slug,
      portal.domain,
      id,
    );
    if (conflict)
      return NextResponse.json(
        { data: null, error: conflict },
        { status: 409 },
      );
    const changes: D1Statement[] = [
      {
        sql: `UPDATE tenant_portals
       SET slug = ?, name = ?, audience = ?, domain = ?, catalog_settings = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
        params: [
          portal.slug,
          portal.name,
          portal.audience,
          portal.domain,
          JSON.stringify(portal.catalogSettings),
          context.tenant.id,
          id,
        ],
      },
    ];
    // Preserve verification when only the name, audience, or catalog settings change.
    if (existing.domain !== portal.domain) {
      changes.push({
        sql: "DELETE FROM tenant_domains WHERE tenant_id = ? AND portal_id = ?",
        params: [context.tenant.id, id],
      });
      if (portal.domain)
        changes.push(domainInsert(context.tenant.id, id, portal.domain));
    }
    await d1Batch(changes);
    return NextResponse.json({ data: { id }, error: null });
  }

  let portal: ReturnType<typeof normalizePortalInput>;
  try {
    portal = normalizePortalInput(body);
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error:
          error instanceof Error ? error.message : "Portal payload is invalid.",
      },
      { status: 400 },
    );
  }
  const conflict = await portalConflict(
    context.tenant.id,
    portal.slug,
    portal.domain,
  );
  if (conflict)
    return NextResponse.json({ data: null, error: conflict }, { status: 409 });
  const portalId = crypto.randomUUID();
  const changes: D1Statement[] = [
    {
      sql: `INSERT INTO tenant_portals (id, tenant_id, slug, name, audience, domain, theme, catalog_settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{"theme":"light"}', ?, datetime('now'), datetime('now'))`,
      params: [
        portalId,
        context.tenant.id,
        portal.slug,
        portal.name,
        portal.audience,
        portal.domain,
        JSON.stringify(portal.catalogSettings),
      ],
    },
  ];
  if (portal.domain)
    changes.push(domainInsert(context.tenant.id, portalId, portal.domain));
  await d1Batch(changes);
  return NextResponse.json({ data: { id: portalId }, error: null });
}

function domainInsert(
  tenantId: string,
  portalId: string,
  hostname: string,
): D1Statement {
  return {
    sql: `INSERT INTO tenant_domains (id, tenant_id, portal_id, hostname, status, verification_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
    params: [
      crypto.randomUUID(),
      tenantId,
      portalId,
      hostname,
      crypto.randomUUID(),
    ],
  };
}

async function portalConflict(
  tenantId: string,
  slug: string,
  domain: string | null,
  exceptId = "",
) {
  const [existing] = await d1Query(
    "SELECT id FROM tenant_portals WHERE tenant_id = ? AND slug = ? AND id != ? LIMIT 1",
    [tenantId, slug, exceptId],
  );
  if (existing)
    return "This portal address is already in use. Choose another slug.";
  if (domain) {
    const [claimed] = await d1Query(
      "SELECT id FROM tenant_domains WHERE lower(hostname) = lower(?) AND (tenant_id != ? OR portal_id IS NULL OR portal_id != ?) LIMIT 1",
      [domain, tenantId, exceptId],
    );
    if (claimed) return "This domain is already attached to another portal.";
  }
  return null;
}
