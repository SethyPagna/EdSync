import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Brain, FileText, Presentation, Sparkles, Timer } from "lucide-react";
import { AI_PROMPT_CONTRACTS } from "@/lib/studio/catalog";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "AI Tutor",
  description: "Guided AI prompt builder for Studio content, lessons, slides, and practice.",
};

const featureIcons = {
  clean_notes: FileText,
  organize_outline: FileText,
  lesson_sections: FileText,
  slide_deck: Presentation,
  worksheet: FileText,
  quiz: Timer,
  flashcards: Timer,
  rubric: FileText,
  discussion: FileText,
  rewrite: Sparkles,
  zero_to_expert: Brain,
};

export default async function AiPage() {
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

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AI_PROMPT_CONTRACTS.map((contract) => {
            const Icon = featureIcons[contract.feature] ?? Sparkles;
            return (
              <article key={contract.id} className="rounded-lg border border-edsync-border bg-edsync-card p-5">
                <Icon className="mb-4 h-7 w-7 text-edsync-blue" />
                <h2 className="font-display text-xl font-bold">{contract.title}</h2>
                <p className="mt-2 text-sm leading-6 text-edsync-subtle">{contract.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {contract.insertTargets.map((target) => (
                    <span key={target} className="badge bg-edsync-blue/10 text-edsync-blue">
                      {target.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                <Link href="/studio" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                  Open in Studio <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
