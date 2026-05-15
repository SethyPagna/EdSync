export type StudioContentBlock = {
  id: string;
  tenantId: string;
  ownerId: string | null;
  blockType: string;
  title: string;
  data: Record<string, unknown>;
  version: number;
  status: "draft" | "published" | "archived";
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type ContentBlockResponse<T> = {
  data: T | null;
  error: string | null;
};

async function parseContentBlockResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ContentBlockResponse<T> | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Content block request failed (${response.status})`);
  }
  if (!payload?.data) throw new Error("Content block response was empty.");
  return payload.data;
}

export async function listContentBlocks() {
  const data = await fetch("/api/content-blocks", { credentials: "include" }).then(
    parseContentBlockResponse<{ blocks: StudioContentBlock[] }>,
  );
  return data.blocks;
}

export async function createContentBlock(input: {
  title: string;
  blockType: string;
  data: Record<string, unknown>;
  tags?: string[];
  status?: "draft" | "published";
}) {
  const data = await fetch("/api/content-blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  }).then(parseContentBlockResponse<{ block: StudioContentBlock }>);
  return data.block;
}

export async function archiveContentBlock(id: string) {
  return fetch(`/api/content-blocks?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  }).then(parseContentBlockResponse<{ id: string; archived: true }>);
}
