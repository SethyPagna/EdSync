import { redirect } from "next/navigation";

export default function AdminStudentViewPage() {
  redirect("/student/dashboard?adminView=student");
}
