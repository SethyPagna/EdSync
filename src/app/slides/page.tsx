import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Slides",
  description: "Design slide decks, transitions, animations, and presentations in EdSync.",
};

export default async function SlidesPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/auth/login?next=/slides");
  return <StudioWorkspace initialKind="slide" />;
}
