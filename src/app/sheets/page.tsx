import StudioWorkspace from "@/components/studio/StudioWorkspace";

export const metadata = {
  title: "Sheets",
  description: "Build structured sheets, rubrics, and question banks in EdSync.",
};

export default function SheetsPage() {
  return <StudioWorkspace initialKind="sheet" />;
}
