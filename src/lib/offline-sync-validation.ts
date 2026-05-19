import type { OfflineSyncItem } from "@/lib/offline-sync";

export const OFFLINE_SYNC_MAX_ITEMS = 100;
export const OFFLINE_SYNC_MAX_PAYLOAD_BYTES = 100_000;
export const OFFLINE_SYNC_CLIENT_ID_MAX_LENGTH = 120;
export const OFFLINE_SYNC_ITEM_ID_MAX_LENGTH = 160;

const OFFLINE_SYNC_ITEM_TYPES = new Set(["progress", "quiz_attempt", "note", "learning_event"]);
const OFFLINE_SYNC_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

export function validateOfflineSyncId(value: unknown, label: string, maxLength: number) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} is required.`);
  if (id.length > maxLength || !OFFLINE_SYNC_ID_PATTERN.test(id)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return id;
}

export function validateOfflineSyncItemType(value: unknown): OfflineSyncItem["itemType"] {
  const itemType = String(value ?? "").trim();
  if (!OFFLINE_SYNC_ITEM_TYPES.has(itemType)) {
    throw new Error("Choose a supported offline item type.");
  }
  return itemType as OfflineSyncItem["itemType"];
}

export function validateOfflineSyncPayload(value: unknown) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Offline payload must be an object.");
  }

  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > OFFLINE_SYNC_MAX_PAYLOAD_BYTES) {
    throw new Error("Offline payload is too large. Sync a smaller draft or split the work.");
  }
  return value as Record<string, unknown>;
}

export function normalizeOfflineSyncItems(value: unknown): OfflineSyncItem[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, OFFLINE_SYNC_MAX_ITEMS).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Offline sync item must be an object.");
    }
    const record = item as Record<string, unknown>;
    const rawItemId = String(record.itemId ?? "").trim();
    return {
      clientId: validateOfflineSyncId(record.clientId, "Client id", OFFLINE_SYNC_CLIENT_ID_MAX_LENGTH),
      itemType: validateOfflineSyncItemType(record.itemType),
      itemId: rawItemId ? validateOfflineSyncId(rawItemId, "Item id", OFFLINE_SYNC_ITEM_ID_MAX_LENGTH) : null,
      payload: validateOfflineSyncPayload(record.payload),
    };
  });
}
