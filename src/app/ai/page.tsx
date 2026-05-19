import { redirect } from "next/navigation";
import AiPromptBuilder from "@/components/ai/AiPromptBuilder";
import { AI_PROMPT_CONTRACTS, normalizeAiPromptContractId, type AiPromptSearchParams } from "@/lib/studio/catalog";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "AI Tutor",
  description: "Guided AI prompt builder for Studio content, lessons, slides, and practice.",
};

type AiPageProps = {
  searchParams?: AiPromptSearchParams;
};

export default async function AiPage({ searchParams }: AiPageProps) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/ai");

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-edsync-border bg-edsync-card p-6">
          <p className="text-sm font-semibold text-edsync-blue">AI insert-back workspace</p>
          <h1 className="mt-2 font-display text-4xl font-bold">AI Tutor and Prompt Builder</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Choose a guided AI workflow, preview the contract, then insert editable output back into Studio,
            slides, documents, or Practice.
          </p>
        </div>
        <AiPromptBuilder contracts={AI_PROMPT_CONTRACTS} initialTask={normalizeAiPromptContractId(searchParams?.task)} />
      </section>
    </main>
  );
}
