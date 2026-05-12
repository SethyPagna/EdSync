import AppShell, { teacherNavItems } from "@/components/AppShell";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell role="teacher" navItems={teacherNavItems}>
      {children}
    </AppShell>
  );
}
