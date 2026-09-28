import { openDB } from "idb";
import type { SceneDeck } from "../scene";

export type StudioDraft = { deck: SceneDeck; savedAt: number };

async function database() {
  return openDB("edsync-studio-drafts", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("decks")) db.createObjectStore("decks");
    },
  });
}

export async function readStudioDraft(documentId: string): Promise<StudioDraft | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await database();
  return db.get("decks", documentId) as Promise<StudioDraft | undefined>;
}

export async function writeStudioDraft(documentId: string, deck: SceneDeck): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await database();
  await db.put("decks", { deck, savedAt: Date.now() } satisfies StudioDraft, documentId);
}

export async function deleteStudioDraft(documentId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await database();
  await db.delete("decks", documentId);
}
