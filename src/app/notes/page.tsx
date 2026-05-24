import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Notes",
  description: "Create and organize personal EdSync notes, drafts, and learning materials.",
};

export default async function NotesPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/notes");
  return <StudioWorkspace initialKind="note" />;
}
