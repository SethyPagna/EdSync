import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { getPermissionSet } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const [catalog, roleProfiles, granted] = await Promise.all([
    d1Query("SELECT * FROM permission_catalog ORDER BY category, label"),
    d1Query("SELECT * FROM role_profiles WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY is_system DESC, label", [context.tenant.id]),
    getPermissionSet(user, context),
  ]);
  return NextResponse.json({
    data: { catalog, roleProfiles, granted: Array.from(granted), context },
    error: null,
  });
}
