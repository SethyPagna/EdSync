"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { composeTemplate } from "@/lib/studio/auto-layout";
import { getTemplate } from "@/lib/studio/library";
import type { LessonOutline } from "@/lib/compose";
import { getStudioItem, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import { deleteStudioDraft, readStudioDraft, writeStudioDraft, type StudioDraft } from "@/lib/studio/editor/draft";
import { readStudioDocument, studioPlainText, writeStudioDocument } from "@/lib/studio/document";
import type { SceneDeck } from "@/lib/studio/scene";
import type { StudioItemKind } from "@/types";
import StudioEditor from "./StudioEditor";
import StudioHub from "./hub/StudioHub";
import { createBlankDeck, studioId, useStudio, type CreateDesignInput } from "./store";

function itemKind(deck: SceneDeck): StudioItemKind {
  if (deck.kind === "slides") return "slide";
  if (deck.kind === "doc" || deck.kind === "worksheet") return "doc";
  return "design";
}

function initialDeck(input: CreateDesignInput): SceneDeck {
  const template = getTemplate(input.templateId);
  if (template) return composeTemplate(template, { title: input.title, id: studioId("deck"), newId: () => studioId("scene") });
  return createBlankDeck(input);
}

function serverUpdatedAtMs(value: string): number {
  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  return Date.parse(sqliteUtc.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

export default function StudioWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const deck = useStudio((state) => state.deck);
  const [view, setView] = useState<"hub" | "loading" | "editor">("loading");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [item, setItem] = useState<StudioServerItem | null>(null);
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [suspendAutoSave, setSuspendAutoSave] = useState(false);
  const startedQuery = useRef<string | null>(null);
  const savedDeck = useRef<SceneDeck | null>(null);
  const activeDocumentId = useRef<string | null>(null);
  const loadedDocumentId = useRef<string | null>(null);
  const inFlight = useRef(new Map<string, Promise<boolean>>());
  const saveLatest = useRef<() => Promise<boolean>>(async () => false);
  const saveLatestId = useRef<string | null>(null);
  const outline = useRef<LessonOutline | undefined>(undefined);

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    const current = useStudio.getState().deck;
    const targetId = documentId;
    if (!current || !targetId || activeDocumentId.current !== targetId) return false;
    const pending = inFlight.current.get(targetId);
    if (pending) {
      if (!await pending || activeDocumentId.current !== targetId) return false;
      return useStudio.getState().deck === savedDeck.current ? true : saveLatest.current();
    }
    if (!legacy && current === savedDeck.current) return true;
    useStudio.getState().setSavingState("saving");
    setError("");
    const operation = (async (): Promise<boolean> => {
      try {
      if (legacy) {
        const copy = { ...current, id: studioId("deck") };
        const created = await saveStudioItem({
          id: copy.id,
          kind: itemKind(copy),
          title: copy.title,
          content: writeStudioDocument(copy, outline.current),
          plainText: studioPlainText(copy),
          metadata: { ...item?.metadata, editor: "scene", canvasWidth: copy.width, canvasHeight: copy.height, pageCount: copy.pages.length, convertedFrom: targetId },
        });
        if (activeDocumentId.current !== targetId) return true;
        activeDocumentId.current = created.id;
        loadedDocumentId.current = created.id;
        setDocumentId(created.id);
        setItem(created);
        savedDeck.current = copy;
        const latest = useStudio.getState().deck;
        const visible = latest && latest !== current ? { ...latest, id: created.id } : copy;
        useStudio.getState().replaceDeck(visible);
        if (visible !== copy) void writeStudioDraft(created.id, visible).catch(() => undefined);
        useStudio.getState().setSavingState(visible === copy ? "saved" : "saving");
        setLegacy(false);
        setSuspendAutoSave(false);
        router.replace(`/studio?doc=${encodeURIComponent(created.id)}`);
        return true;
      }
      const updated = await updateStudioItem({
        id: targetId,
        title: current.title,
        content: writeStudioDocument(current, outline.current),
        plainText: studioPlainText(current),
        metadata: { ...item?.metadata, editor: "scene", canvasWidth: current.width, canvasHeight: current.height, pageCount: current.pages.length },
      });
      if (activeDocumentId.current !== targetId) return true;
      setItem(updated);
      if (useStudio.getState().deck === current) {
        savedDeck.current = current;
        await deleteStudioDraft(targetId).catch(() => undefined);
        useStudio.getState().setSavingState("saved");
      }
      setLegacy(false);
      return true;
    } catch (cause) {
      if (activeDocumentId.current === targetId) {
        useStudio.getState().setSavingState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        setError(cause instanceof Error ? cause.message : "Design could not be saved.");
      }
      return false;
    }
    })();
    inFlight.current.set(targetId, operation);
    try {
      const succeeded = await operation;
      if (succeeded && activeDocumentId.current === targetId && useStudio.getState().deck !== savedDeck.current && !legacy) {
        window.setTimeout(() => void saveLatest.current(), 0);
      }
      return succeeded;
    } finally {
      inFlight.current.delete(targetId);
    }
  }, [documentId, item, legacy, router]);

  useEffect(() => {
    saveLatest.current = saveCurrent;
    saveLatestId.current = documentId;
  }, [documentId, saveCurrent]);

  const closeEditor = async () => {
    while (activeDocumentId.current) {
      if (useStudio.getState().deck === savedDeck.current) { router.push("/studio"); return; }
      if (saveLatestId.current !== activeDocumentId.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
        continue;
      }
      if (!await saveLatest.current()) return;
    }
  };

  const createDesign = useCallback(async (input: CreateDesignInput, importOutline?: LessonOutline) => {
    activeDocumentId.current = null;
    setView("loading");
    setError("");
    try {
      let next = initialDeck(input);
      if (importOutline) {
        useStudio.getState().replaceDeck(next);
        useStudio.getState().composeFromOutline(importOutline);
        next = useStudio.getState().deck!;
        if (input.title) next = { ...next, title: input.title };
      }
      const created = await saveStudioItem({
        id: next.id,
        kind: itemKind(next),
        title: next.title,
        content: writeStudioDocument(next, importOutline),
        plainText: studioPlainText(next),
        metadata: { editor: "scene", canvasWidth: next.width, canvasHeight: next.height, pageCount: next.pages.length, templateId: input.templateId ?? null },
      });
      setItem(created);
      outline.current = importOutline;
      activeDocumentId.current = created.id;
      loadedDocumentId.current = created.id;
      setDocumentId(created.id);
      savedDeck.current = next;
      useStudio.getState().replaceDeck(next);
      useStudio.getState().setPanel(input.magic ? "magic" : "design");
      setView("editor");
      router.replace(`/studio?doc=${encodeURIComponent(created.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Design could not be created.");
      setView("hub");
    }
  }, [router]);

  useEffect(() => {
    if (startedQuery.current === query) return;
    startedQuery.current = query;
    const params = new URLSearchParams(query);
    const requestedId = params.get("doc") ?? params.get("item");
    if (requestedId) {
      if (loadedDocumentId.current === requestedId) { setView("editor"); return; }
      activeDocumentId.current = requestedId;
      let cancelled = false;
      setView("loading");
      setError("");
      void getStudioItem(requestedId).then(async (loadedItem) => {
        if (cancelled) return;
        const loaded = readStudioDocument(loadedItem.content);
        if (!loaded) throw new Error("This item is not a Studio design.");
        const draft = await readStudioDraft(requestedId).catch(() => undefined);
        if (cancelled) return;
        setItem(loadedItem);
        outline.current = loaded.outline;
        setDocumentId(requestedId);
        loadedDocumentId.current = requestedId;
        setLegacy(loaded.convertedFromLegacy);
        savedDeck.current = loaded.deck;
        useStudio.getState().replaceDeck(loaded.deck);
        if (draft && draft.savedAt > serverUpdatedAtMs(loadedItem.updatedAt) + 1000) {
          setPendingDraft(draft);
          setSuspendAutoSave(true);
        } else {
          setPendingDraft(null);
          setSuspendAutoSave(loaded.convertedFromLegacy);
        }
        setView("editor");
      }).catch((cause) => { if (!cancelled) { activeDocumentId.current = null; setError(cause instanceof Error ? cause.message : "Design could not be loaded."); setView("hub"); } });
      return () => { cancelled = true; };
    }

    if (params.has("import")) {
      const raw = sessionStorage.getItem("edsync-studio-import");
      sessionStorage.removeItem("edsync-studio-import");
      if (raw) {
        try {
          const importData = JSON.parse(raw) as { outline?: LessonOutline; title?: string };
          const importedOutline = importData.outline;
          if (importedOutline) {
            void Promise.resolve().then(() => createDesign({ formatId: "slides-16x9", title: importData.title ?? importedOutline.title }, importedOutline));
            return;
          }
        } catch { queueMicrotask(() => setError("The lesson could not be imported.")); }
      }
    }
    if (params.has("new") || params.has("template") || params.has("magic")) {
      void Promise.resolve().then(() => createDesign({ formatId: params.get("new") || getTemplate(params.get("template"))?.formatId || "slides-16x9", templateId: params.get("template") ?? undefined, magic: params.has("magic") }));
      return;
    }
    queueMicrotask(() => {
      if (startedQuery.current !== query) return;
      setDocumentId(null);
      activeDocumentId.current = null;
      loadedDocumentId.current = null;
      setItem(null);
      outline.current = undefined;
      setView("hub");
    });
  }, [query, createDesign]);

  useEffect(() => {
    if (!documentId || !deck || view !== "editor" || deck === savedDeck.current) return;
    void writeStudioDraft(documentId, deck).catch(() => undefined);
    if (suspendAutoSave) return;
    const timer = window.setTimeout(() => void saveCurrent(), 1500);
    return () => window.clearTimeout(timer);
  }, [deck, documentId, saveCurrent, suspendAutoSave, view]);

  useEffect(() => {
    if (!documentId) return;
    const onPageHide = () => {
      const current = useStudio.getState().deck;
      if (current && current !== savedDeck.current) void writeStudioDraft(documentId, current).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [documentId]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    useStudio.getState().replaceDeck(pendingDraft.deck);
    setPendingDraft(null);
    setSuspendAutoSave(legacy);
  };

  const dismissDraft = () => {
    if (documentId) void deleteStudioDraft(documentId);
    setPendingDraft(null);
    setSuspendAutoSave(legacy);
  };

  if (view === "loading") return <div className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">Opening Studio…</div>;
  if (view === "hub") return <><StudioHub onOpen={(id) => router.push(`/studio?doc=${encodeURIComponent(id)}`)} onCreate={(input) => void createDesign(input)} />{error && <div role="alert" className="mx-auto max-w-5xl px-4 text-sm text-danger">{error}</div>}</>;
  return <>
    <StudioEditor onBack={() => void closeEditor()} onSave={async () => { await saveCurrent(); }} />
    {(pendingDraft || legacy) && <div className="fixed bottom-32 left-1/2 z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-fg shadow-lg">
      {pendingDraft ? <><span>Unsaved design found</span><button type="button" onClick={restoreDraft} className="btn btn-primary btn-sm">Restore</button><button type="button" onClick={dismissDraft} className="btn btn-ghost btn-sm">Dismiss</button></> : <span>Legacy design preview. Saving creates a separate copy.</span>}
    </div>}
    {error && <div role="alert" className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-lg border border-danger bg-surface p-3 text-sm text-danger shadow-lg">{error}</div>}
  </>;
}
