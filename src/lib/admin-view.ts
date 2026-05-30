export const ADMIN_VIEW_MODE_COOKIE = "edsync-admin-view-mode";

export type AdminViewMode =
  | "individual"
  | "organization"
  | "organization-teacher"
  | "organization-student";

export function normalizeAdminViewMode(value: unknown): AdminViewMode | null {
  if (value === "individual" || value === "organization") return value;
  if (value === "organization-teacher" || value === "teacher") return "organization-teacher";
  if (value === "organization-student" || value === "student") return "organization-student";
  return null;
}

export function adminViewModeForWorkspaceRole(role: "teacher" | "student"): AdminViewMode {
  return role === "teacher" ? "organization-teacher" : "organization-student";
}

export function workspaceRoleForAdminViewMode(mode: AdminViewMode): "teacher" | "student" | null {
  if (mode === "organization-teacher") return "teacher";
  if (mode === "organization-student" || mode === "individual") return "student";
  return null;
}

export function adminViewModeLabel(mode: AdminViewMode) {
  if (mode === "individual") return "individual account workspace";
  if (mode === "organization") return "organization owner workspace";
  if (mode === "organization-teacher") return "organization creator workspace";
  return "organization learner workspace";
}
