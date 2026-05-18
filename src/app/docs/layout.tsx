import SharedWorkspaceShell from "@/components/SharedWorkspaceShell";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <SharedWorkspaceShell>{children}</SharedWorkspaceShell>;
}
