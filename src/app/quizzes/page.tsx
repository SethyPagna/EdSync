import { redirect } from "next/navigation";

export const metadata = {
  title: "Quizzes",
  description: "Quiz mode in EdSync Practice.",
};

type QuizzesPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default function QuizzesPage({ searchParams }: QuizzesPageProps) {
  const params = new URLSearchParams({ mode: "quiz" });
  if (searchParams?.adminView === "teacher" || searchParams?.adminView === "student") {
    params.set("adminView", searchParams.adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
