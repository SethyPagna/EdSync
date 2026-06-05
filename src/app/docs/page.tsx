import StudioWorkspace from "@/components/studio/StudioWorkspace";

export const metadata = {
  title: "Docs",
  description: "Write Word-style EdSync documents with reusable learning blocks.",
};

export default function DocsPage() {
  return <StudioWorkspace initialKind="doc" />;
}
