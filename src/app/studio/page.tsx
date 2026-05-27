import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeAdminViewMode, workspaceRoleForAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Lesson editor",
  description: "Compatibility route for EdSync lesson creation and personal notes.",
};

type StudioPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const adminView = normalizeAdminViewMode(searchParams?.adminView);
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
