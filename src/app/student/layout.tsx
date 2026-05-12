import AppShell, { studentNavItems } from "@/components/AppShell";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell role="student" navItems={studentNavItems}>
      {children}
    </AppShell>
  );
}
