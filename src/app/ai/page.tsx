import { redirect } from "next/navigation";
import { normalizeAiPromptContractId, type AiPromptSearchParams } from "@/lib/studio/catalog";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Practice + AI Tutor",
  description: "Guided AI prompt builder for lessons, notes, slides, and practice.",
};

type AiPageProps = {
  searchParams?: AiPromptSearchParams;
};

export default async function AiPage({ searchParams }: AiPageProps) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/ai");

  const task = normalizeAiPromptContractId(searchParams?.task);
  redirect(`/practice?ai=1${task ? `&task=${encodeURIComponent(task)}` : ""}`);
}
