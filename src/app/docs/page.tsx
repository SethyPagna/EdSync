import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Docs",
  description: "Write Word-style EdSync documents with reusable learning blocks.",
};

export default async function DocsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/docs");
  return <StudioWorkspace initialKind="doc" />;
}
