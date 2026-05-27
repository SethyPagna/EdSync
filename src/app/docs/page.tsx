import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Docs",
  description: "Write Word-style EdSync documents with reusable learning blocks.",
};

type DocsPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const user = await getSessionUser().catch(() => null);
  const requestedAdminView = normalizeAdminViewMode(searchParams?.adminView);
  const adminView =
    user?.user_metadata.role === "admin" && requestedAdminView
      ? workspaceRoleForAdminViewMode(requestedAdminView)
      : null;
  const nextPath = `/docs${requestedAdminView ? `?adminView=${requestedAdminView}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const shellRole = adminView ?? user.user_metadata.role;
  const shellNavItems =
    shellRole === "admin" ? adminNavItems : shellRole === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <AppShell role={shellRole} navItems={shellNavItems}>
      <StudioWorkspace initialKind="doc" />
    </AppShell>
  );
}
