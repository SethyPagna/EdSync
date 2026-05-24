import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

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
  const adminView = searchParams?.adminView === "teacher" || searchParams?.adminView === "student" ? searchParams.adminView : null;
  const nextPath = `/studio${adminView ? `?adminView=${adminView}` : ""}`;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const role = user.user_metadata.role;
  if (role === "teacher" || adminView === "teacher") redirect(`/teacher/lessons/create${adminView ? `?adminView=${adminView}` : ""}`);
  if (adminView === "student") redirect("/student/notes?adminView=student");
  if (role === "admin") redirect("/admin/dashboard");
  redirect("/student/notes");
}
