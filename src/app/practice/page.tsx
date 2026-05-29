import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import PracticeWorkspace from "@/components/practice/PracticeWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";
import { normalizePracticeMode, type PracticeSearchParams } from "@/lib/practice/modes";
import { normalizeAiPromptContractId } from "@/lib/studio/catalog";

export const metadata = {
  title: "Practice",
  description: "Practice, review, and AI help.",
};

type PracticePageSearchParams = PracticeSearchParams & {
  adminView?: string;
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: Promise<PracticePageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const currentParams = new URLSearchParams();
  if (resolvedSearchParams?.mode) currentParams.set("mode", resolvedSearchParams.mode);
  if (resolvedSearchParams?.ai) currentParams.set("ai", resolvedSearchParams.ai);
  if (resolvedSearchParams?.task) currentParams.set("task", resolvedSearchParams.task);
  if (resolvedSearchParams?.adminView) currentParams.set("adminView", resolvedSearchParams.adminView);
  const currentPath = `/practice${currentParams.size ? `?${currentParams.toString()}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);

  const requestedAdminView =
    user.user_metadata.role === "admin"
      ? normalizeAdminViewMode(resolvedSearchParams?.adminView)
      : null;
  const adminWorkspaceRole = requestedAdminView ? workspaceRoleForAdminViewMode(requestedAdminView) : null;
  const shellRole = adminWorkspaceRole ?? user.user_metadata.role;
  const shellNavItems =
    shellRole === "admin" ? adminNavItems : shellRole === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <AppShell role={shellRole} navItems={shellNavItems}>
      <PracticeWorkspace
        initialAiOpen={resolvedSearchParams?.ai === "1"}
        initialAiTask={normalizeAiPromptContractId(resolvedSearchParams?.task)}
        initialMode={normalizePracticeMode(resolvedSearchParams?.mode)}
      />
    </AppShell>
  );
}
