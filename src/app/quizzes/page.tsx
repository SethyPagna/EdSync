import { redirect } from "next/navigation";
import { normalizeAdminViewMode } from "@/lib/admin-view";

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
  const adminView = normalizeAdminViewMode(searchParams?.adminView);
  if (adminView) {
    params.set("adminView", adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
