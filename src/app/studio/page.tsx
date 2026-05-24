import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Lesson editor",
  description: "Compatibility route for EdSync lesson creation and personal notes.",
};

export default async function StudioPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/studio");

  const role = user.user_metadata.role;
  if (role === "teacher") redirect("/teacher/lessons/create");
  if (role === "admin") redirect("/admin/dashboard");
  redirect("/student/notes");
}
