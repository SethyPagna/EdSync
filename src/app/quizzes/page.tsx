import { redirect } from "next/navigation";
import { normalizeAdminViewMode } from "@/lib/admin-view";

export const metadata = {
  title: "Quizzes",
  description: "Quiz mode in EdSync Practice.",
};

type QuizzesPageProps = {
  searchParams?: Promise<{
    adminView?: string;
  }>;
};

export default async function QuizzesPage({ searchParams }: QuizzesPageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams({ mode: "quiz" });
  const adminView = normalizeAdminViewMode(resolvedSearchParams?.adminView);
  if (adminView) {
    params.set("adminView", adminView);
  }
  redirect(`/practice?${params.toString()}`);
}
