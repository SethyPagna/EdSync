import SharedWorkspaceShell from "@/components/SharedWorkspaceShell";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <SharedWorkspaceShell>{children}</SharedWorkspaceShell>;
}
