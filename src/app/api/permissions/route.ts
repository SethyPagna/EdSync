import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { normalizeRoleProfileInput, validateRoleProfileId } from "@/lib/permission-profile-validation";
import { getPermissionSet, PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const [catalogRows, roleRows, granted] = await Promise.all([
    d1Query("SELECT * FROM permission_catalog ORDER BY category, label"),
    d1Query("SELECT * FROM role_profiles WHERE tenant_id = ? OR tenant_id IS NULL OR is_system = 1 ORDER BY is_system DESC, label", [
      context.tenant.id,
    ]),
    getPermissionSet(user, context),
  ]);
  const catalog = catalogRows.map((row) => deserializeRow("permission_catalog", row));
  const roleProfiles = roleRows.map((row) => deserializeRow("role_profiles", row));
  return NextResponse.json({
    data: { catalog, roleProfiles, granted: Array.from(granted), context },
    error: null,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.usersManage);
  } catch {
    return NextResponse.json({ data: null, error: "Missing user management permission." }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: "create_profile" | "update_profile" | "delete_profile";
    id?: string;
    label?: string;
    description?: string | null;
    permissions?: string[];
  };

  if (body.action === "delete_profile") {
    let id: string;
    try {
      id = validateRoleProfileId(body.id);
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid role profile." },
        { status: 400 },
      );
    }
    const [profile] = await d1Query<{ id: string; is_system: number | boolean }>(
      "SELECT id, is_system FROM role_profiles WHERE id = ? AND tenant_id = ? LIMIT 1",
      [id, context.tenant.id],
    );
    if (!profile) return NextResponse.json({ data: null, error: "Tenant profile not found." }, { status: 404 });
    if (profile.is_system) return NextResponse.json({ data: null, error: "System profiles cannot be deleted." }, { status: 400 });
    await d1Query("UPDATE tenant_memberships SET role_profile_id = NULL, updated_at = datetime('now') WHERE tenant_id = ? AND role_profile_id = ?", [
      context.tenant.id,
      id,
    ]);
    await d1Query("DELETE FROM role_profiles WHERE tenant_id = ? AND id = ?", [context.tenant.id, id]);
    return NextResponse.json({ data: { id }, error: null });
  }

  if (body.action === "update_profile") {
    let id: string;
    let profileInput;
    try {
      id = validateRoleProfileId(body.id);
      profileInput = normalizeRoleProfileInput({ ...body, fallbackId: id });
    } catch (error) {
      return NextResponse.json(
        { data: null, error: error instanceof Error ? error.message : "Invalid role profile." },
        { status: 400 },
      );
    }
    const [profile] = await d1Query<{ id: string; is_system: number | boolean }>(
      "SELECT id, is_system FROM role_profiles WHERE id = ? AND tenant_id = ? LIMIT 1",
      [id, context.tenant.id],
    );
    if (!profile) return NextResponse.json({ data: null, error: "Tenant profile not found." }, { status: 404 });
    if (profile.is_system) return NextResponse.json({ data: null, error: "System profiles cannot be edited here." }, { status: 400 });
    await d1Query(
      "UPDATE role_profiles SET label = ?, description = ?, permissions = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [profileInput.label, profileInput.description, JSON.stringify(profileInput.permissions), context.tenant.id, id],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  const id = crypto.randomUUID();
  let profileInput;
  try {
    profileInput = normalizeRoleProfileInput({ ...body, fallbackId: id });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Invalid role profile." },
      { status: 400 },
    );
  }
  const [existingProfile] = await d1Query<{ id: string }>(
    "SELECT id FROM role_profiles WHERE tenant_id = ? AND profile_key = ? LIMIT 1",
    [context.tenant.id, profileInput.profileKey],
  );
  if (existingProfile) {
    return NextResponse.json({ data: null, error: "A role profile with this key already exists for this organization." }, { status: 409 });
  }
  await d1Query(
    `INSERT INTO role_profiles (id, tenant_id, profile_key, label, description, permissions, is_system, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
    [id, context.tenant.id, profileInput.profileKey, profileInput.label, profileInput.description, JSON.stringify(profileInput.permissions)],
  );
  return NextResponse.json({ data: { id }, error: null });
}
