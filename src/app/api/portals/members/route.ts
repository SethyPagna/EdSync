import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

type MemberRow = {
  id: string;
  user_id: string;
  status: string;
  role_profile_id: string | null;
  role_label: string | null;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
};

async function authorizedTenant() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 }) };
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.portalsManage);
  } catch {
    return { error: NextResponse.json({ data: null, error: "Missing portal management permission." }, { status: 403 }) };
  }
  return { tenantId: context.tenant.id, tenantSlug: context.tenant.slug };
}

export async function GET() {
  const access = await authorizedTenant();
  if (access.error) return access.error;
  const tenantId = access.tenantId;
  const [members, tenant] = await Promise.all([
    d1Query<MemberRow>(
      `SELECT tm.id, tm.user_id, tm.status, tm.role_profile_id,
              rp.label AS role_label, p.full_name, p.email, p.role, tm.created_at
         FROM tenant_memberships tm
         JOIN profiles p ON p.id = tm.user_id
         LEFT JOIN role_profiles rp ON rp.id = tm.role_profile_id
        WHERE tm.tenant_id = ?
        ORDER BY CASE tm.status WHEN 'active' THEN 0 ELSE 1 END, p.full_name, p.email
        LIMIT 200`,
      [tenantId],
    ),
    d1Query<{ invite_code: string | null; invites_enabled: number }>(
      `SELECT json_extract(settings, '$.invite_code') AS invite_code,
              COALESCE(json_extract(settings, '$.invites_enabled'), 1) AS invites_enabled
         FROM tenants WHERE id = ? LIMIT 1`,
      [tenantId],
    ),
  ]);
  return NextResponse.json({
    data: {
      members,
      inviteCode: tenant[0]?.invite_code || access.tenantSlug,
      invitesEnabled: tenant[0]?.invites_enabled !== 0,
    },
    error: null,
  });
}

export async function POST(request: Request) {
  const access = await authorizedTenant();
  if (access.error) return access.error;
  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body) || !["rotate", "enable", "disable"].includes(String(body.action))) {
    return NextResponse.json({ data: null, error: "Invalid invite action." }, { status: 400 });
  }
  if (body.action === "rotate") {
    const code = `join-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await d1Query(
      `UPDATE tenants
          SET settings = json_set(COALESCE(settings, '{}'), '$.invite_code', ?, '$.invites_enabled', 1), updated_at = datetime('now')
        WHERE id = ?`,
      [code, access.tenantId],
    );
    return NextResponse.json({ data: { inviteCode: code, invitesEnabled: true }, error: null });
  }
  const enabled = body.action === "enable";
  await d1Query(
    `UPDATE tenants
        SET settings = json_set(COALESCE(settings, '{}'), '$.invites_enabled', ?), updated_at = datetime('now')
      WHERE id = ?`,
    [enabled ? 1 : 0, access.tenantId],
  );
  return NextResponse.json({ data: { invitesEnabled: enabled }, error: null });
}
