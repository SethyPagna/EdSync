import type { LucideIcon } from "lucide-react";

export type ShellCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
};

export function commandScore(command: Pick<ShellCommand, "label" | "keywords">, rawQuery: string): number {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return 0;
  const label = command.label.toLocaleLowerCase();
  if (label === query) return 100;
  if (label.startsWith(query)) return 50;
  if (label.includes(query)) return 30;
  if (command.keywords?.some((keyword) => keyword.toLocaleLowerCase().includes(query))) return 20;
  return -1;
}

export function rankCommands(commands: readonly ShellCommand[], query: string, recentIds: readonly string[] = []): ShellCommand[] {
  const trimmed = query.trim();
  return commands
    .map((command, index) => ({ command, index, score: commandScore(command, trimmed) }))
    .filter(({ score }) => !trimmed || score >= 0)
    .sort((left, right) => {
      if (trimmed) return right.score - left.score || left.index - right.index;
      const leftRecent = recentIds.indexOf(left.command.id);
      const rightRecent = recentIds.indexOf(right.command.id);
      if (leftRecent !== rightRecent) {
        if (leftRecent < 0) return 1;
        if (rightRecent < 0) return -1;
        return leftRecent - rightRecent;
      }
      return left.index - right.index;
    })
    .map(({ command }) => command);
}
