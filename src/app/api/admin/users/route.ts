import { NextResponse } from "next/server";
import { requireAdmin, auditAdminAction } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
  const params: unknown[] = [];
  const where = query
    ? "WHERE lower(p.email) LIKE ? OR lower(COALESCE(p.full_name, '')) LIKE ?"
    : "";
  if (query) params.push(`%${query}%`, `%${query}%`);

  const users = await d1Query(
    `SELECT p.id, p.email, p.full_name, p.role, p.school, p.grade_level, p.total_xp,
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
  if (!body.userId) return NextResponse.json({ data: null, error: "User id is required." }, { status: 400 });

  if (body.admin) {
    await d1Query("INSERT OR IGNORE INTO admin_users (user_id, created_by, created_at) VALUES (?, ?, datetime('now'))", [
      body.userId,
      auth.user.id,
    ]);
  } else {
    if (body.userId === auth.user.id) {
      return NextResponse.json({ data: null, error: "You cannot remove your own admin access." }, { status: 400 });
    }
    await d1Query("DELETE FROM admin_users WHERE user_id = ?", [body.userId]);
  }

  await auditAdminAction({
    adminId: auth.user.id,
    action: body.admin ? "grant_admin" : "revoke_admin",
    entityType: "user",
    entityId: body.userId,
  });

  return NextResponse.json({ data: { updated: true }, error: null });
}
