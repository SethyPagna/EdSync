import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WorkflowShowcase from "@/components/catalog/WorkflowShowcase";
import { publicLanguageHref, type PublicLanguageSearchParams } from "@/lib/public/languages";

export const metadata: Metadata = {
  title: "Workflow",
  description: "Slide through the EdSync catalog, studio, AI, practice, progress, and owner workflow.",
};

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams?: Promise<PublicLanguageSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const catalogHref = publicLanguageHref("/catalog", resolvedSearchParams?.language);

  return (
    <main className="edsync-catalog-reference edsync-public-launch min-h-screen text-edsync-text">
      <section className="mx-auto max-w-[90rem] px-4 pt-4">
        <div className="relative z-20 flex justify-start pb-3">
          <Link href={catalogHref} className="btn-secondary w-fit px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Intro
          </Link>
        </div>
        <WorkflowShowcase language={resolvedSearchParams?.language} />
      </section>
    </main>
  );
}
