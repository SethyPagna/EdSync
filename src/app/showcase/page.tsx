import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WorkflowShowcase from "@/components/catalog/WorkflowShowcase";
import PublicLaunchChrome from "@/components/public/PublicLaunchChrome";

export const metadata: Metadata = {
  title: "Workflow",
  description: "Slide through the EdSync catalog, Studio, AI, teacher, student, and admin workflow.",
};

export default function ShowcasePage() {
  return (
    <main className="edsync-catalog-reference edsync-public-launch min-h-screen text-edsync-text">
      <PublicLaunchChrome />
      <section className="mx-auto max-w-7xl px-4 pt-24">
        <div className="relative z-20 pb-4">
          <Link href="/" className="btn-secondary w-fit px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Intro
          </Link>
        </div>
        <WorkflowShowcase includeBridge={false} />
      </section>
    </main>
  );
}
