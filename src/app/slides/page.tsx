import { redirect } from "next/navigation";
import AppShell, { adminNavItems, studentNavItems, teacherNavItems } from "@/components/AppShell";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Slides",
  description: "Design slide decks, transitions, animations, and presentations in EdSync.",
};

type SlidesPageProps = {
  searchParams?: {
    adminView?: string;
  };
};

export default async function SlidesPage({ searchParams }: SlidesPageProps) {
  const user = await getSessionUser().catch(() => null);
  const requestedAdminView =
    searchParams?.adminView === "teacher" || searchParams?.adminView === "student"
      ? searchParams.adminView
      : null;
  const adminView =
    user?.user_metadata.role === "admin" ? requestedAdminView : null;
  const nextPath = `/slides${requestedAdminView ? `?adminView=${requestedAdminView}` : ""}`;

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);

  const shellRole = adminView ?? user.user_metadata.role;
  const shellNavItems =
    shellRole === "admin" ? adminNavItems : shellRole === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <AppShell role={shellRole} navItems={shellNavItems}>
      <StudioWorkspace initialKind="slide" />
    </AppShell>
  );
}
