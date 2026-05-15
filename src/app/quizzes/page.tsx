import { redirect } from "next/navigation";

export const metadata = {
  title: "Quizzes",
  description: "Quiz mode in EdSync Practice.",
};

export default function QuizzesPage() {
  redirect("/practice?mode=quiz");
}
