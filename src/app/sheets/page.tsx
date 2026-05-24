import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Sheets",
  description: "Build structured sheets, rubrics, and question banks in EdSync.",
};

export default async function SheetsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/sheets");
  return <StudioWorkspace initialKind="sheet" />;
}
