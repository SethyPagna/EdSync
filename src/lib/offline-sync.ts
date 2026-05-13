import { d1Query } from "@/lib/db/d1";
import { appendLearningEvent } from "@/lib/learning-events";

export type OfflineSyncItem = {
  clientId: string;
  itemType: "progress" | "quiz_attempt" | "note" | "learning_event";
  itemId?: string | null;
  payload?: Record<string, unknown>;
};

export async function applyOfflineSync(input: {
  tenantId: string;
  userId: string;
  items: OfflineSyncItem[];
}) {
  const results: Array<{ clientId: string; status: string; serverEventId?: string }> = [];
  for (const item of input.items) {
    const existing = await d1Query<{ id: string; status: string; server_event_id: string | null }>(
      "SELECT id, status, server_event_id FROM offline_sync_items WHERE user_id = ? AND client_id = ? LIMIT 1",
      [input.userId, item.clientId],
    );
    if (existing[0]) {
      results.push({ clientId: item.clientId, status: existing[0].status, serverEventId: existing[0].server_event_id ?? undefined });
      continue;
    }

    const serverEventId = await appendLearningEvent({
      tenantId: input.tenantId,
      actorId: input.userId,
      studentId: input.userId,
      sourceType: item.itemType,
      sourceId: item.itemId ?? null,
      eventType: `offline.${item.itemType}.synced`,
      payload: item.payload ?? {},
    });
    await d1Query(
      `INSERT INTO offline_sync_items (
         id, tenant_id, user_id, client_id, item_type, item_id, payload, status,
         server_event_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?, datetime('now'), datetime('now'))`,
      [
        crypto.randomUUID(),
        input.tenantId,
        input.userId,
        item.clientId,
        item.itemType,
        item.itemId ?? null,
        JSON.stringify(item.payload ?? {}),
        serverEventId,
      ],
    );
    results.push({ clientId: item.clientId, status: "applied", serverEventId });
  }
  return results;
}
