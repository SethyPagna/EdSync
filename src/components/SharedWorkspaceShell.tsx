import { cookies } from "next/headers";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import { ROLE_COOKIE } from "@/lib/auth/constants";

type SharedWorkspaceShellProps = {
  children: React.ReactNode;
};

export default async function SharedWorkspaceShell({ children }: SharedWorkspaceShellProps) {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;

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
