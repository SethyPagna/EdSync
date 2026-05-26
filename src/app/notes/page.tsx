import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Notes",
  description: "Create and organize personal EdSync notes, drafts, and learning materials.",
};

type NotesPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await getSessionUser().catch(() => null);
  const requestedAdminView =
    searchParams?.adminView === "teacher" || searchParams?.adminView === "student"
      ? searchParams.adminView
      : null;
  const adminView =
    user?.user_metadata.role === "admin" ? requestedAdminView : null;
  const nextPath = `/notes${requestedAdminView ? `?adminView=${requestedAdminView}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  if (adminView === "teacher" || user.user_metadata.role === "teacher") {
    redirect(`/teacher/notes${adminView ? `?adminView=${adminView}` : ""}`);
  }
  if (adminView === "student" || user.user_metadata.role === "student") {
    redirect(`/student/notes${adminView ? `?adminView=${adminView}` : ""}`);
  }
  redirect("/admin/dashboard");
}
