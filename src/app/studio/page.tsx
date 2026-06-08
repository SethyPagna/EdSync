import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Course Studio",
  description: "Unified EdSync course studio entry point.",
};

type StudioPageProps = {
  searchParams?: Promise<{
    adminView?: string;
  }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const resolvedSearchParams = await searchParams;
  const adminView = normalizeAdminViewMode(resolvedSearchParams?.adminView);
  const nextPath = `/studio${adminView ? `?adminView=${adminView}` : ""}`;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const role = user.user_metadata.role;
  const adminWorkspaceRole = adminView ? workspaceRoleForAdminViewMode(adminView) : null;
  if (role === "teacher" || adminWorkspaceRole === "teacher") redirect(`/teacher/lessons/create${adminView ? `?adminView=${adminView}` : ""}`);
  if (adminWorkspaceRole === "student") redirect(`/student/notes?adminView=${adminView}`);
  if (role === "admin") redirect("/admin/dashboard");
  redirect("/student/notes");
}
