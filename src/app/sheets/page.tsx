import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Sheets",
  description: "Build structured sheets, rubrics, and question banks in EdSync.",
};

type SheetsPageProps = {
  searchParams?: Promise<{
    adminView?: string;
  }>;
};

export default async function SheetsPage({ searchParams }: SheetsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const requestedAdminView = normalizeAdminViewMode(resolvedSearchParams?.adminView);
  const adminView =
    user?.user_metadata.role === "admin" && requestedAdminView
      ? workspaceRoleForAdminViewMode(requestedAdminView)
      : null;
  const nextPath = `/sheets${requestedAdminView ? `?adminView=${requestedAdminView}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const shellRole = adminView ?? user.user_metadata.role;
  const shellNavItems =
    shellRole === "admin" ? adminNavItems : shellRole === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <AppShell role={shellRole} navItems={shellNavItems}>
      <StudioWorkspace initialKind="sheet" />
    </AppShell>
  );
}
