import { redirect } from "next/navigation";
import PracticeWorkspace from "@/components/practice/PracticeWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import type { PracticeMode } from "@/types";

export const metadata = {
  title: "Practice",
  description: "Practice quizzes, exams, flashcards, matching, sprints, games, and review loops.",
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: { mode?: PracticeMode };
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/practice");
  return <PracticeWorkspace initialMode={searchParams?.mode} />;
}
