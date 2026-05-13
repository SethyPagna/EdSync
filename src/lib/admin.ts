import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";

export async function requireAdmin(): Promise<
  | { user: SessionUser; response?: never }
  | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ data: null, error: "Authentication required." }, { status: 401 }) };
  }

  if (user.user_metadata.role !== "admin") {
    return { response: NextResponse.json({ data: null, error: "Admin access required." }, { status: 403 }) };
  }

  return { user };
}

export async function auditAdminAction(input: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await d1Query(
    `INSERT INTO admin_audit_logs (id, admin_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      input.adminId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function isAdminUser(userId: string) {
  const [row] = await d1Query<{ user_id: string }>("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1", [
    userId,
  ]);
  return Boolean(row);
}
