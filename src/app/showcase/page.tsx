import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WorkflowShowcase from "@/components/catalog/WorkflowShowcase";
import { publicLanguageQuerySuffix } from "@/lib/public/languages";

export const metadata: Metadata = {
  title: "Workflow",
  description: "Slide through the EdSync catalog, Studio, AI, teacher, student, and admin workflow.",
};

export default function ShowcasePage({
  searchParams,
}: {
  searchParams?: { language?: string };
}) {
  const languageQuery = publicLanguageQuerySuffix(searchParams?.language);

  return (
    <main className="edsync-catalog-reference edsync-public-launch min-h-screen text-edsync-text">
      <section className="mx-auto max-w-[90rem] px-4 pt-4">
        <div className="relative z-20 flex justify-start pb-3">
          <Link href={`/catalog${languageQuery}`} className="btn-secondary w-fit px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Intro
          </Link>
        </div>
        <WorkflowShowcase language={searchParams?.language} />
      </section>
    </main>
  );
}
