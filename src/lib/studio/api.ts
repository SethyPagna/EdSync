import type { StudioItemKind } from "@/types";

export type StudioServerItem = {
  id: string;
  kind: Exclude<StudioItemKind, "lesson">;
  title: string;
  content: Record<string, unknown>;
  plainText: string;
  status: "draft" | "published" | "archived";
  sourceType: string | null;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type StudioApiResponse<T> = {
  data: T | null;
  error: string | null;
};

async function parseStudioResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as StudioApiResponse<T> | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Studio request failed (${response.status})`);
  }
  if (!payload?.data) throw new Error("Studio response was empty.");
  return payload.data;
}

export async function listStudioItems(kind?: StudioItemKind) {
  const params = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  const data = await fetch(`/api/studio${params}`, { credentials: "include" }).then(
    parseStudioResponse<{ items: StudioServerItem[] }>,
  );
  return data.items;
}

export async function saveStudioItem(input: {
  id?: string;
  kind: StudioItemKind;
  title: string;
  content: Record<string, unknown>;
  plainText?: string;
  status?: "draft" | "published";
  metadata?: Record<string, unknown>;
}) {
  const data = await fetch("/api/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  }).then(parseStudioResponse<{ item: StudioServerItem }>);
  return data.item;
}

export async function archiveStudioItem(id: string) {
  const data = await fetch(`/api/studio?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  }).then(parseStudioResponse<{ id: string; archived: true }>);
  return data;
}
