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

export type StudioHistoryEvent = {
  id: string;
  actorId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type StudioApiResponse<T> = {
  data: T | null;
  error: string | null;
};

async function parseStudioResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as StudioApiResponse<T> | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Workspace request failed (${response.status})`);
  }
  if (!payload?.data) throw new Error("Workspace response was empty.");
  return payload.data;
}

export async function listStudioItems(kind?: StudioItemKind, includeArchived = false) {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  const data = await fetch(`/api/studio${query ? `?${query}` : ""}`, { credentials: "include" }).then(
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

export async function updateStudioItem(input: {
  id: string;
  title?: string;
  content?: Record<string, unknown>;
  plainText?: string;
  status?: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
}) {
  const data = await fetch("/api/studio", {
    method: "PATCH",
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

export async function hardDeleteStudioItem(id: string) {
  const data = await fetch(`/api/studio?id=${encodeURIComponent(id)}&hard=true`, {
    method: "DELETE",
    credentials: "include",
  }).then(parseStudioResponse<{ id: string; deleted: true }>);
  return data;
}

export async function listStudioHistory(id: string) {
  const params = new URLSearchParams({ historyId: id });
  const data = await fetch(`/api/studio?${params.toString()}`, {
    credentials: "include",
  }).then(parseStudioResponse<{ events: StudioHistoryEvent[] }>);
  return data.events;
}
