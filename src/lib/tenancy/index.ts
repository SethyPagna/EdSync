import { cookies, headers } from "next/headers";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth/constants";
import { d1Query } from "@/lib/db/d1";
import type { SessionUser } from "@/lib/auth/session";
import type { Tenant, TenantMembership, TenantPortal } from "@/types";

export const DEFAULT_TENANT_ID = "tenant_edsync_default";
export const DEFAULT_PORTAL_ID = "portal_edsync_default";

export type TenantContext = {
  tenant: Tenant;
  portal: TenantPortal | null;
  membership: TenantMembership | null;
};

function defaultTenantSlug() {
  return process.env.DEFAULT_TENANT_SLUG?.trim() || "edsync";
}

async function requestHostname() {
  const headerStore = await headers();
  return (headerStore.get("x-forwarded-host") || headerStore.get("host") || "").split(":")[0].toLowerCase();
}

async function activeTenantIdFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
}

export async function ensureDefaultTenant(ownerId?: string | null) {
  await d1Query(
    `INSERT OR IGNORE INTO tenants (id, slug, name, owner_id, plan_tier, isolation_mode, settings, created_at, updated_at)
     VALUES (?, ?, 'EdSync Academy', ?, 'enterprise', 'shared_d1', ?, datetime('now'), datetime('now'))`,
    [DEFAULT_TENANT_ID, defaultTenantSlug(), ownerId ?? null, JSON.stringify({ adaptiveComplexity: true, aiReviewRequired: true })],
  );
  await d1Query(
    `INSERT OR IGNORE INTO tenant_portals (id, tenant_id, slug, name, audience, is_default, theme, created_at, updated_at)
     VALUES (?, ?, 'main', 'EdSync Main Portal', 'internal', 1, ?, datetime('now'), datetime('now'))`,
    [DEFAULT_PORTAL_ID, DEFAULT_TENANT_ID, JSON.stringify({ theme: "light" })],
  );
}

export async function resolveTenantContext(user?: SessionUser | null): Promise<TenantContext> {
  await ensureDefaultTenant(user?.id);
  const host = await requestHostname();
  const domainRows = host
    ? await d1Query<Tenant & { portal_id: string | null }>(
        `SELECT t.*, td.portal_id
           FROM tenant_domains td
           JOIN tenants t ON t.id = td.tenant_id
          WHERE lower(td.hostname) = lower(?) AND td.status = 'active'
          LIMIT 1`,
        [host],
      )
    : [];

  let activeTenantRows: Tenant[] = [];
  if (!domainRows[0] && user) {
    const activeTenantId = await activeTenantIdFromCookie();
    activeTenantRows = activeTenantId
      ? await d1Query<Tenant>(
          `SELECT t.*
             FROM tenants t
             JOIN tenant_memberships tm ON tm.tenant_id = t.id
            WHERE t.id = ?
              AND t.status = 'active'
              AND tm.user_id = ?
              AND tm.status = 'active'
            LIMIT 1`,
          [activeTenantId, user.id],
        )
      : [];
  }

  const tenantId = domainRows[0]?.id ?? activeTenantRows[0]?.id ?? DEFAULT_TENANT_ID;
  const [tenant] = domainRows[0]
    ? domainRows
    : activeTenantRows[0]
      ? activeTenantRows
    : await d1Query<Tenant>("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tenantId]);

  const portalRows = await d1Query<TenantPortal>(
    `SELECT *
       FROM tenant_portals
      WHERE tenant_id = ? AND (? IS NULL OR id = ?)
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1`,
    [tenantId, domainRows[0]?.portal_id ?? null, domainRows[0]?.portal_id ?? null],
  );

  const membershipRows = user
    ? await d1Query<TenantMembership>(
        "SELECT * FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? AND status = 'active' LIMIT 1",
        [tenantId, user.id],
      )
    : [];

  if (user && membershipRows.length === 0) {
    const roleProfile =
      user.user_metadata.role === "admin"
        ? "role_master_admin"
        : user.user_metadata.role === "teacher"
          ? "role_solo_teacher"
          : "role_learner";
    await d1Query(
      `INSERT OR IGNORE INTO tenant_memberships (
         id, tenant_id, user_id, role_profile_id, status, permissions, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'active', '[]', datetime('now'), datetime('now'))`,
      [crypto.randomUUID(), tenantId, user.id, roleProfile],
    );
    const [membership] = await d1Query<TenantMembership>(
      "SELECT * FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1",
      [tenantId, user.id],
    );
    return { tenant, portal: portalRows[0] ?? null, membership: membership ?? null };
  }

  return { tenant, portal: portalRows[0] ?? null, membership: membershipRows[0] ?? null };
}

export async function linkTenantObject(input: {
  tenantId: string;
  portalId?: string | null;
  table: string;
  objectId: string;
}) {
  await d1Query(
    `INSERT OR IGNORE INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [crypto.randomUUID(), input.tenantId, input.portalId ?? null, input.table, input.objectId],
  );
}

export async function assertTenantObject(input: {
  tenantId: string;
  table: string;
  objectId: string;
}) {
  const [row] = await d1Query<{ id: string }>(
    "SELECT id FROM tenant_object_links WHERE tenant_id = ? AND object_table = ? AND object_id = ? LIMIT 1",
    [input.tenantId, input.table, input.objectId],
  );
  return Boolean(row) || input.tenantId === DEFAULT_TENANT_ID;
}
