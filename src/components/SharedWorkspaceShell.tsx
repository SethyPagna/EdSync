import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth/session";

type SharedWorkspaceShellProps = {
  children: React.ReactNode;
};

export default async function SharedWorkspaceShell({ children }: SharedWorkspaceShellProps) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login");

  const role = user.user_metadata.role;

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
