import { d1Query } from "@/lib/db/d1";
import type { SessionUser } from "@/lib/auth/session";
import { DEFAULT_TENANT_ID, type TenantContext } from "@/lib/tenancy";

type ScopeUser = Pick<SessionUser, "id" | "user_metadata">;
type ScopeContext = Pick<TenantContext, "tenant"> & { membership?: TenantContext["membership"] };

// An organization host resolves its tenant for anyone signed in, so membership is checked separately.
export function isTenantOutsider(user: ScopeUser, context: ScopeContext) {
  return (
    user.user_metadata.role !== "admin" &&
    context.tenant.id !== DEFAULT_TENANT_ID &&
    context.membership?.status !== "active"
  );
}

// The shared default tenant holds unrelated individual accounts, so the owner is the boundary there.
export function isOwnerScoped(user: ScopeUser, context: ScopeContext) {
  return (
    user.user_metadata.role !== "admin" &&
    (context.tenant.id === DEFAULT_TENANT_ID || isTenantOutsider(user, context))
  );
}

export function ownerScope(user: ScopeUser, context: ScopeContext, ownerExpression: string) {
  if (!isOwnerScoped(user, context)) return { sql: "", params: [] as unknown[] };
  return { sql: ` AND ${ownerExpression} = ?`, params: [user.id] as unknown[] };
}

export async function canContactUser(input: {
  sender: ScopeUser;
  context: ScopeContext;
  recipientId: string;
}) {
  if (input.sender.id === input.recipientId || input.sender.user_metadata.role === "admin") return true;

  if (input.context.tenant.id !== DEFAULT_TENANT_ID) {
    const [member] = await d1Query<{ id: string }>(
      "SELECT id FROM tenant_memberships WHERE tenant_id = ? AND user_id = ? AND status = 'active' LIMIT 1",
      [input.context.tenant.id, input.recipientId],
    );
    return Boolean(member);
  }

  const [shared] = await d1Query<{ id: string }>(
    `SELECT c.id
       FROM classes c
       JOIN class_enrollments ce ON ce.class_id = c.id AND ce.is_active = 1
      WHERE c.is_active = 1
        AND ((c.teacher_id = ? AND ce.student_id = ?) OR (c.teacher_id = ? AND ce.student_id = ?))
      LIMIT 1`,
    [input.sender.id, input.recipientId, input.recipientId, input.sender.id],
  );
  return Boolean(shared);
}
