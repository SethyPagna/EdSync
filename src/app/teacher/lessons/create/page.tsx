import { redirect } from "next/navigation";

export const metadata = {
  title: "Course Studio",
  description: "Redirects to the unified EdSync studio.",
};

export default function CreateLessonPage() {
  redirect("/studio");
}
