import { redirect } from "next/navigation";

export const metadata = {
  title: "Create course",
  description: "Redirects to the course creation workspace.",
};

export default function CreateLessonPage() {
  redirect("/teacher/lessons?new=1");
}
