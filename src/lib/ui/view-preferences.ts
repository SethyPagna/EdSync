export type ViewMode = "grid" | "list";

export function readViewMode(storageKey: string, fallback: ViewMode = "grid"): ViewMode {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(storageKey);
  return stored === "grid" || stored === "list" ? stored : fallback;
}

export function writeViewMode(storageKey: string, mode: ViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, mode);
}
