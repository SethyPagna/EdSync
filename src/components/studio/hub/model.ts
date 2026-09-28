import { readStudioDocument, studioPlainText, writeStudioDocument } from "@/lib/studio/document";
import { findFormat } from "@/lib/studio/library";
import type { StudioServerItem } from "@/lib/studio/api";

export type HubFilter = "all" | "slides" | "docs" | "social" | "print";

function dateMs(value: string): number {
  const sqlite = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  return Date.parse(sqlite.test(value) ? `${value.replace(" ", "T")}Z` : value) || 0;
}

export function recentLabel(value: string, now = Date.now()): string {
  const updated = dateMs(value);
  if (!updated) return "Unknown date";
  const seconds = Math.max(0, Math.floor((now - updated) / 1000));
  if (seconds < 60) return "Just now";
  const intervals: [number, Intl.RelativeTimeFormatUnit][] = [[31_536_000, "year"], [2_592_000, "month"], [86_400, "day"], [3_600, "hour"], [60, "minute"]];
  const [size, unit] = intervals.find(([threshold]) => seconds >= threshold) ?? intervals[intervals.length - 1];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" }).format(-Math.floor(seconds / size), unit);
}

export function itemGroup(item: StudioServerItem): HubFilter {
  const loaded = item.content.version === 2 ? readStudioDocument(item.content) : null;
  if (loaded) {
    const format = findFormat(loaded.deck.formatId);
    if (format?.group === "social" || loaded.deck.kind === "social") return "social";
    if (format?.group === "print") return "print";
    if (loaded.deck.kind === "slides") return "slides";
    if (loaded.deck.kind === "doc" || loaded.deck.kind === "worksheet") return "docs";
  }
  return item.kind === "slide" ? "slides" : item.kind === "doc" ? "docs" : "print";
}

export function filterStudioItems(items: readonly StudioServerItem[], filter: HubFilter, search: string): StudioServerItem[] {
  const query = search.trim().toLocaleLowerCase();
  return items
    .filter((item) => filter === "all" || itemGroup(item) === filter)
    .filter((item) => !query || `${item.title} ${item.plainText}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => dateMs(b.updatedAt) - dateMs(a.updatedAt));
}

export function duplicateInput(item: StudioServerItem, newId: string): Omit<StudioServerItem, "createdAt" | "updatedAt" | "status"> & { status: "draft" } {
  const title = `${item.title} copy`;
  const loaded = item.content.version === 2 ? readStudioDocument(item.content) : null;
  const content = loaded ? writeStudioDocument({ ...loaded.deck, id: newId, title }, loaded.outline) : { ...item.content };
  return {
    id: newId,
    kind: item.kind,
    title,
    content,
    plainText: loaded ? studioPlainText({ ...loaded.deck, id: newId, title }) : item.plainText,
    status: "draft" as const,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    metadata: { ...item.metadata, duplicatedFrom: item.id },
  };
}

export function renameInput(item: StudioServerItem, title: string) {
  const loaded = item.content.version === 2 ? readStudioDocument(item.content) : null;
  return {
    id: item.id,
    title,
    content: loaded ? writeStudioDocument({ ...loaded.deck, title }, loaded.outline) : undefined,
  };
}
