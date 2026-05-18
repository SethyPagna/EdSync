import SharedWorkspaceShell from "@/components/SharedWorkspaceShell";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <SharedWorkspaceShell>{children}</SharedWorkspaceShell>;
}
