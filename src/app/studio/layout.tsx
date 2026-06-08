import SharedWorkspaceShell from "@/components/SharedWorkspaceShell";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  return <SharedWorkspaceShell>{children}</SharedWorkspaceShell>;
}
