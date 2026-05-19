import { redirect } from "next/navigation";
import PracticeWorkspace from "@/components/practice/PracticeWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizePracticeMode, type PracticeSearchParams } from "@/lib/practice/modes";

export const metadata = {
  title: "Practice",
  description: "Practice quizzes, exams, flashcards, matching, sprints, games, and review loops.",
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: PracticeSearchParams;
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/practice");
  return <PracticeWorkspace initialMode={normalizePracticeMode(searchParams?.mode)} />;
}
