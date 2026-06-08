import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";
import { getSessionUser } from "@/lib/auth/session";

type SharedWorkspaceShellProps = {
  children: React.ReactNode;
};

export default async function SharedWorkspaceShell({ children }: SharedWorkspaceShellProps) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login");

  const role = user.user_metadata.role;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const adminViewMode =
    normalizeAdminViewMode(headerStore.get("x-edsync-admin-view-mode")) ??
    normalizeAdminViewMode(cookieStore.get("edsync-admin-view-mode")?.value);
  const adminWorkspaceRole = adminViewMode ? workspaceRoleForAdminViewMode(adminViewMode) : null;

  if (role === "admin" && adminWorkspaceRole === "teacher") {
    return (
      <AppShell role="teacher" navItems={teacherNavItems}>
        {children}
      </AppShell>
    );
  }

  if (role === "admin" && adminWorkspaceRole === "student") {
    return (
      <AppShell role="student" navItems={studentNavItems}>
        {children}
      </AppShell>
    );
  }

  if (role === "admin") {
    return (
      <AppShell role="admin" navItems={adminNavItems}>
        {children}
      </AppShell>
    );
  }

  if (role === "teacher") {
    return (
      <AppShell role="teacher" navItems={teacherNavItems}>
        {children}
      </AppShell>
    );
  }

  return (
    <AppShell role="student" navItems={studentNavItems}>
      {children}
    </AppShell>
  );
}
