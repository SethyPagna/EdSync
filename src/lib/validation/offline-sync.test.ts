import { describe, expect, it } from "vitest";
import {
  OFFLINE_SYNC_CLIENT_ID_MAX_LENGTH,
  OFFLINE_SYNC_MAX_ITEMS,
  OFFLINE_SYNC_MAX_PAYLOAD_BYTES,
  normalizeOfflineSyncItems,
  validateOfflineSyncId,
  validateOfflineSyncPayload,
} from "@/lib/validation/offline-sync";

describe("offline sync validation", () => {
  it("normalizes valid offline sync items", () => {
    expect(
      normalizeOfflineSyncItems([
        {
          clientId: " local-1 ",
          itemType: "quiz_attempt",
          itemId: "attempt-1",
          payload: { score: 90 },
        },
      ]),
    ).toEqual([
      {
        clientId: "local-1",
        itemType: "quiz_attempt",
        itemId: "attempt-1",
        payload: { score: 90 },
      },
    ]);
  });

  it("bounds sync batches", () => {
    const items = Array.from({ length: OFFLINE_SYNC_MAX_ITEMS + 5 }, (_, index) => ({
      clientId: `local-${index}`,
      itemType: "progress",
    }));
    expect(normalizeOfflineSyncItems(items)).toHaveLength(OFFLINE_SYNC_MAX_ITEMS);
  });

  it("rejects unsafe identifiers and item types", () => {
    expect(() => validateOfflineSyncId("", "Client id", OFFLINE_SYNC_CLIENT_ID_MAX_LENGTH)).toThrow("required");
    expect(() => validateOfflineSyncId("bad id", "Client id", OFFLINE_SYNC_CLIENT_ID_MAX_LENGTH)).toThrow("short identifier");
    expect(() => normalizeOfflineSyncItems([{ clientId: "local-1", itemType: "upload" }])).toThrow("supported offline item type");
  });

  it("validates payload shape and size", () => {
    expect(validateOfflineSyncPayload(undefined)).toEqual({});
    expect(validateOfflineSyncPayload({ answer: "Saved offline" })).toEqual({ answer: "Saved offline" });
    expect(() => validateOfflineSyncPayload("answer")).toThrow("must be an object");
    expect(() => validateOfflineSyncPayload({ answer: "x".repeat(OFFLINE_SYNC_MAX_PAYLOAD_BYTES) })).toThrow("too large");
  });
});
