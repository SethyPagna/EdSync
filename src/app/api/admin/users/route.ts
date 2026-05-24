import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { normalizeAdminUserPatch, normalizeAdminUserSearch } from "@/lib/admin-users-validation";
import { d1Query } from "@/lib/db/d1";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let query: string;
  try {
    query = normalizeAdminUserSearch(new URL(request.url).searchParams.get("q"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }
  const params: unknown[] = [];
  const where = query
    ? "WHERE lower(p.email) LIKE ? OR lower(COALESCE(p.full_name, '')) LIKE ?"
    : "";
  if (query) params.push(`%${query}%`, `%${query}%`);

  const users = await d1Query(
    `SELECT p.id, p.email, p.full_name, p.role, p.school, p.grade_level,
            p.streak_days, p.last_active_at, p.created_at,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
       FROM profiles p
       LEFT JOIN admin_users au ON au.user_id = p.id
       ${where}
      ORDER BY p.created_at DESC
      LIMIT 100`,
    params,
  );

  return NextResponse.json({ data: users, error: null });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = (await request.json()) as { userId?: string; admin?: boolean };
  let patch: ReturnType<typeof normalizeAdminUserPatch>;
  try {
    patch = normalizeAdminUserPatch(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "User update is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  if (patch.admin) {
    await d1Query("INSERT OR IGNORE INTO admin_users (user_id, created_by, created_at) VALUES (?, ?, datetime('now'))", [
      patch.userId,
      auth.user.id,
    ]);
  } else {
    if (patch.userId === auth.user.id) {
      return NextResponse.json({ data: null, error: "You cannot remove your own admin access." }, { status: 400 });
    }
    await d1Query("DELETE FROM admin_users WHERE user_id = ?", [patch.userId]);
  }

  await auditAdminAction({
    adminId: auth.user.id,
    action: patch.admin ? "grant_admin" : "revoke_admin",
    entityType: "user",
    entityId: patch.userId,
  });

  return NextResponse.json({ data: { updated: true }, error: null });
}
