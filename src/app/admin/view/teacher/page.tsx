import { redirect } from "next/navigation";

export default function AdminTeacherViewPage() {
  redirect("/teacher/dashboard?adminView=organization-teacher");
}
