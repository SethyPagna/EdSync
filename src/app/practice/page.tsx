import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import PracticeWorkspace from "@/components/practice/PracticeWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";
import { normalizePracticeMode, type PracticeSearchParams } from "@/lib/practice/modes";
import { normalizeAiPromptContractId } from "@/lib/studio/catalog";

export const metadata = {
  title: "Practice & AI Tutor",
  description: "Merged AI tutoring, practice quizzes, games, review loops, and explanations.",
};

type PracticePageSearchParams = PracticeSearchParams & {
  adminView?: string;
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: PracticePageSearchParams;
}) {
  const user = await getSessionUser().catch(() => null);
  const currentParams = new URLSearchParams();
  if (searchParams?.mode) currentParams.set("mode", searchParams.mode);
  if (searchParams?.ai) currentParams.set("ai", searchParams.ai);
  if (searchParams?.task) currentParams.set("task", searchParams.task);
  if (searchParams?.adminView) currentParams.set("adminView", searchParams.adminView);
  const currentPath = `/practice${currentParams.size ? `?${currentParams.toString()}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(currentPath)}`);

  const requestedAdminView =
    user.user_metadata.role === "admin"
      ? normalizeAdminViewMode(searchParams?.adminView)
      : null;
  const adminWorkspaceRole = requestedAdminView ? workspaceRoleForAdminViewMode(requestedAdminView) : null;
  const shellRole = adminWorkspaceRole ?? user.user_metadata.role;
  const shellNavItems =
    shellRole === "admin" ? adminNavItems : shellRole === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <AppShell role={shellRole} navItems={shellNavItems}>
      <PracticeWorkspace
        initialAiOpen={searchParams?.ai === "1"}
        initialAiTask={normalizeAiPromptContractId(searchParams?.task)}
        initialMode={normalizePracticeMode(searchParams?.mode)}
      />
    </AppShell>
  );
}
