import { d1Query } from "@/lib/db/d1";
import type { SessionUser } from "@/lib/auth/session";
import type { TenantContext } from "@/lib/tenancy";
import type { RoleProfile } from "@/types";

export const PERMISSIONS = {
  portalsManage: "portals.manage",
  usersManage: "users.manage",
  coursesAuthor: "courses.author",
  coursesPublish: "courses.publish",
  gradesManage: "grades.manage",
  reportsView: "reports.view",
  billingManage: "billing.manage",
  aiManage: "ai.manage",
  securityAudit: "security.audit",
  learn: "learn",
} as const;

export async function getPermissionSet(user: SessionUser, context: TenantContext) {
  if (user.user_metadata.role === "admin") {
    return new Set(Object.values(PERMISSIONS));
  }

  const membership = context.membership;
  const direct = new Set<string>(membership?.permissions ?? []);
  if (membership?.role_profile_id) {
    const [profile] = await d1Query<RoleProfile>("SELECT * FROM role_profiles WHERE id = ? LIMIT 1", [membership.role_profile_id]);
    for (const permission of profile?.permissions ?? []) direct.add(permission);
  }

  if (user.user_metadata.role === "teacher") {
    direct.add(PERMISSIONS.coursesAuthor);
    direct.add(PERMISSIONS.coursesPublish);
    direct.add(PERMISSIONS.gradesManage);
    direct.add(PERMISSIONS.reportsView);
  }
  if (user.user_metadata.role === "student") direct.add(PERMISSIONS.learn);
  return direct;
}

export async function requirePermission(user: SessionUser, context: TenantContext, permission: string) {
  const permissions = await getPermissionSet(user, context);
  if (!permissions.has(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
  return permissions;
}
