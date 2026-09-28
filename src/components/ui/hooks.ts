"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import { detectMac, isEditableTarget, matchesHotkey, parseHotkey } from "./helpers";

export { isEditableTarget };

const PERSISTENT_STATE_EVENT = "edsync-persistent-state";
const memoryFallback = new Map<string, string | null>();

function readStored(key: string): string | null {
  if (memoryFallback.has(key)) return memoryFallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, raw: string | null) {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    memoryFallback.delete(key);
  } catch {
    memoryFallback.set(key, raw);
  }
  window.dispatchEvent(new CustomEvent<string>(PERSISTENT_STATE_EVENT, { detail: key }));
}

function decodeQuoted(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
}

function decode<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  if (typeof fallback === "string") return (raw.startsWith('"') ? decodeQuoted(raw) : raw) as T;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (fallback === null || fallback === undefined) return parsed as T;
  if (parsed === null || typeof parsed !== typeof fallback) return fallback;
  if (Array.isArray(parsed) !== Array.isArray(fallback)) return fallback;
  return parsed as T;
}

// String keys are stored raw so pre-paint scripts can compare them (edsync-sidebar === "expanded").
function encode<T>(value: T, fallback: T): string | null {
  if (value === undefined) return null;
  if (typeof value === "string" && typeof fallback === "string" && !value.startsWith('"')) return value;
  return JSON.stringify(value);
}

export type PersistentStateSetter<T> = (next: T | ((previous: T) => T)) => void;

export function usePersistentState<T>(key: string, initial: T): [T, PersistentStateSetter<T>] {
  const [fallback] = useState(initial);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        memoryFallback.delete(key);
        onChange();
      };
      const onLocal = (event: Event) => {
        if (event instanceof CustomEvent && event.detail === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(PERSISTENT_STATE_EVENT, onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(PERSISTENT_STATE_EVENT, onLocal);
      };
    },
    [key],
  );

  const raw = useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
  const value = useMemo(() => decode(raw, fallback), [raw, fallback]);

  const setValue = useCallback<PersistentStateSetter<T>>(
    (next) => {
      const previous = decode(readStored(key), fallback);
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
      writeStored(key, encode(resolved, fallback));
    },
    [key, fallback],
  );

  return [value, setValue];
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

const subscribeNever = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export function useIsMac(): boolean {
  return useSyncExternalStore(subscribeNever, detectMac, () => false);
}

export type HotkeyOptions = {
  enableInInputs?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
  allowRepeat?: boolean;
};

export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  { enableInInputs = false, enabled = true, preventDefault = true, allowRepeat = false }: HotkeyOptions = {},
) {
  const onHotkey = useEffectEvent(handler);

  useEffect(() => {
    const hotkeys = parseHotkey(combo);
    if (!enabled || hotkeys.length === 0) return;
    const isMac = detectMac();
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.repeat && !allowRepeat) return;
      if (!enableInInputs && isEditableTarget(event.target)) return;
      if (!matchesHotkey(event, hotkeys, isMac)) return;
      if (preventDefault) event.preventDefault();
      onHotkey(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [combo, enabled, enableInInputs, preventDefault, allowRepeat]);
}
