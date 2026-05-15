import type { StudioDraftStatus, StudioItemKind } from "@/types";

const DRAFT_PREFIX = "edsync.studio.draft.v1";
const LAYOUT_KEY = "edsync.studio.layout.v1";
const AUTOSAVE_DELAY_MS = 700;

export type StudioDraftRecord<T = unknown> = {
  key: string;
  kind: StudioItemKind;
  itemId: string;
  title: string;
  value: T;
  status: StudioDraftStatus;
  updatedAt: string;
};

export function studioDraftKey(kind: StudioItemKind, itemId: string) {
  return `${DRAFT_PREFIX}.${kind}.${itemId}`;
}

export function readStudioDraft<T>(kind: StudioItemKind, itemId: string): StudioDraftRecord<T> | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(studioDraftKey(kind, itemId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StudioDraftRecord<T>;
  } catch {
    window.localStorage.removeItem(studioDraftKey(kind, itemId));
    return null;
  }
}

export function writeStudioDraft<T>(draft: Omit<StudioDraftRecord<T>, "key" | "updatedAt">) {
  if (typeof window === "undefined") return null;
  const key = studioDraftKey(draft.kind, draft.itemId);
  const record: StudioDraftRecord<T> = {
    ...draft,
    key,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(record));
  return record;
}

export function clearStudioDraft(kind: StudioItemKind, itemId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(studioDraftKey(kind, itemId));
}

export function listStudioDrafts() {
  if (typeof window === "undefined") return [] as StudioDraftRecord[];
  const drafts: StudioDraftRecord[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(DRAFT_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      drafts.push(JSON.parse(raw) as StudioDraftRecord);
    } catch {
      window.localStorage.removeItem(key);
    }
  }
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readStudioLayout<T>(fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(LAYOUT_KEY);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(LAYOUT_KEY);
    return fallback;
  }
}

export function writeStudioLayout<T>(layout: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function createDebouncedDraftWriter<T>(
  callback: (value: T) => void,
  delayMs = AUTOSAVE_DELAY_MS,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule(value: T) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        callback(value);
        timer = null;
      }, delayMs);
    },
    flush(value: T) {
      if (timer) clearTimeout(timer);
      timer = null;
      callback(value);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
