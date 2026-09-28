import { Suspense } from "react";
import StudioWorkspace from "@/components/studio/StudioWorkspace";

export const metadata = {
  title: "Course Studio",
  description: "Create EdSync documents, slide decks, and course visuals in one studio.",
};

export default function StudioPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-fg-muted">Opening Studio…</div>}><StudioWorkspace /></Suspense>;
}
