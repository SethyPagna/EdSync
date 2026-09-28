const KEY = "edsync-studio-recent-fonts";

export function recentFontPairs(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function rememberFontPair(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...recentFontPairs().filter((entry) => entry !== id)].slice(0, 5)));
    window.dispatchEvent(new Event("edsync-studio-fonts-change"));
  } catch {}
}
