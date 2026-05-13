import AppShell, { adminNavItems } from "@/components/AppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell role="admin" navItems={adminNavItems}>
      {children}
    </AppShell>
  );
}
