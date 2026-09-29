import { redirect } from "next/navigation";
import PracticeWorkspace from "@/components/practice/PracticeWorkspace";
import { getSessionUser } from "@/lib/auth/session";
import { normalizePracticeMode, type PracticeSearchParams } from "@/lib/practice/modes";
import { normalizeAiPromptContractId } from "@/lib/studio/catalog";

export const metadata = { title: "Practice", description: "Quiz, flashcards, and sprint practice." };

export default async function PracticePage({ searchParams }: { searchParams?: Promise<PracticeSearchParams> }) {
  const params = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const query = new URLSearchParams();
  if (params?.mode) query.set("mode", params.mode);
  if (params?.ai) query.set("ai", params.ai);
  if (params?.task) query.set("task", params.task);
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/practice${query.size ? `?${query}` : ""}`)}`);
  return <PracticeWorkspace initialAiOpen={params?.ai === "1"} initialAiTask={params?.task ? normalizeAiPromptContractId(params.task) : undefined} initialMode={normalizePracticeMode(params?.mode)} />;
}
