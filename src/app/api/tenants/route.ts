import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { ensureDefaultTenant, resolveTenantContext } from "@/lib/tenancy";
import { normalizeTenantInput } from "@/lib/tenant-validation";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const tenants = user.user_metadata.role === "admin"
    ? await d1Query("SELECT * FROM tenants ORDER BY updated_at DESC")
    : await d1Query(
        `SELECT t.*
           FROM tenants t
           JOIN tenant_memberships tm ON tm.tenant_id = t.id
          WHERE tm.user_id = ? AND tm.status = 'active'
          ORDER BY t.updated_at DESC`,
        [user.id],
      );
  return NextResponse.json({ data: { current: context, tenants }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.portalsManage);

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
  await ensureDefaultTenant(user.id);
  await d1Query(
    `INSERT INTO tenants (id, slug, name, owner_id, plan_tier, isolation_mode, settings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '{}', datetime('now'), datetime('now'))`,
    [
      id,
      tenantInput.slug,
      tenantInput.name,
      user.id,
      tenantInput.planTier,
      tenantInput.isolationMode,
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
  return NextResponse.json({ data: { id }, error: null });
}
