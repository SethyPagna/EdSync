import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Studio",
  description: "Create lessons, documents, sheets, slides, designs, and practice in EdSync Studio.",
};

export default async function StudioPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/studio");
  return <StudioWorkspace initialKind="lesson" />;
}
