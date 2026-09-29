import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { ensureDefaultTenant, resolveTenantContext } from "@/lib/tenancy";
import { toClientTenantContext, toClientTenantSummary, type ClientTenantSummary } from "@/lib/tenancy/client-context";
import { isTenantOutsider } from "@/lib/tenancy/ownership";
import { normalizeTenantInput } from "@/lib/validation/tenant";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  if (isTenantOutsider(user, context)) {
    return NextResponse.json({ data: null, error: "Organization membership required." }, { status: 403 });
  }
  const tenants = user.user_metadata.role === "admin"
    ? await d1Query<ClientTenantSummary>("SELECT id, slug, name, plan_tier FROM tenants ORDER BY updated_at DESC")
    : await d1Query<ClientTenantSummary>(
        `SELECT t.id, t.slug, t.name, t.plan_tier
           FROM tenants t
           JOIN tenant_memberships tm ON tm.tenant_id = t.id
          WHERE tm.user_id = ? AND tm.status = 'active'
          ORDER BY t.updated_at DESC`,
        [user.id],
      );
  return NextResponse.json({ data: { current: toClientTenantContext(context), tenants: tenants.map(toClientTenantSummary) }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.portalsManage);
  } catch {
    return NextResponse.json({ data: null, error: "Missing portal management permission." }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; slug?: string; planTier?: string; isolationMode?: string };
  let tenantInput;
  try {
    tenantInput = normalizeTenantInput(body);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid tenant." },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const inviteCode = `join-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await ensureDefaultTenant(user.id);
  await d1Query(
    `INSERT INTO tenants (id, slug, name, owner_id, plan_tier, isolation_mode, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      tenantInput.slug,
      tenantInput.name,
      user.id,
      tenantInput.planTier,
      tenantInput.isolationMode,
      JSON.stringify({ invite_code: inviteCode, invites_enabled: true }),
    ],
  );
  await d1Query(
    `INSERT INTO tenant_portals (id, tenant_id, slug, name, audience, is_default, theme, created_at, updated_at)
     VALUES (?, ?, 'main', ?, 'internal', 1, '{"theme":"light"}', datetime('now'), datetime('now'))`,
    [crypto.randomUUID(), id, `${tenantInput.name} Portal`],
  );
  await d1Query(
    `INSERT INTO tenant_memberships (id, tenant_id, user_id, role_profile_id, status, permissions, created_at, updated_at)
     VALUES (?, ?, ?, 'role_master_admin', 'active', '[]', datetime('now'), datetime('now'))`,
    [crypto.randomUUID(), id, user.id],
  );
  return NextResponse.json({ data: { id, inviteCode }, error: null });
}
