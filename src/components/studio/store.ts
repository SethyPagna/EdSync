"use client";

import { create } from "zustand";
import { planSlides } from "@/lib/compose";
import type { LessonOutline } from "@/lib/compose";
import { composeDeck, createLayoutContext, reflowDeck, relayoutPage, shuffleLayout, syncContentFromElements } from "@/lib/studio/auto-layout";
import { DEFAULT_FORMAT_ID, DEFAULT_DECK_THEME_ID, getDeckTheme, getFontPair, getFormat } from "@/lib/studio/library";
import type { Background, ColorToken, SceneDeck, SceneElement, ScenePage } from "@/lib/studio/scene";
import { applyDeckTheme } from "@/lib/studio/theme-apply";

export type CreateDesignInput = {
  formatId: string;
  templateId?: string;
  magic?: boolean;
  title?: string;
  width?: number;
  height?: number;
};

export type StudioPanel = "design" | "templates" | "elements" | "text" | "uploads" | "magic" | "layers" | null;
export type SavingState = "saved" | "saving" | "offline" | "error";
export type ReorderDirection = "forward" | "back" | "front" | "back-most";
export type AlignDirection = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeDirection = "horizontal" | "vertical";

type History = {
  past: SceneDeck[];
  future: SceneDeck[];
  lastKey: string | null;
  lastAt: number;
};

export interface StudioState {
  deck: SceneDeck | null;
  activePageId: string | null;
  selectionIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  activePanel: StudioPanel;
  savingState: SavingState;
  history: History;
  clipboard: SceneElement[];
  replaceDeck(deck: SceneDeck, options?: { recordHistory?: boolean }): void;
  appendPages(pages: ScenePage[]): void;
  setActivePage(pageId: string): void;
  selectElements(ids: string[]): void;
  setZoom(zoom: number): void;
  setPan(pan: { x: number; y: number }): void;
  setPanel(panel: StudioPanel): void;
  setSavingState(state: SavingState): void;
  renameDeck(title: string): void;
  addElement(element: SceneElement, pageId?: string): void;
  addElements(elements: SceneElement[], pageId?: string): void;
  updateElement(id: string, patch: Partial<SceneElement>, pageId?: string, coalesceKey?: string): void;
  removeElements(ids?: string[], pageId?: string): void;
  duplicateElements(ids?: string[], pageId?: string): void;
  reorderElements(direction: ReorderDirection, ids?: string[], pageId?: string): void;
  groupElements(ids?: string[], pageId?: string): void;
  ungroupElements(ids?: string[], pageId?: string): void;
  lockElements(locked: boolean, ids?: string[], pageId?: string): void;
  alignElements(direction: AlignDirection, ids?: string[], pageId?: string): void;
  distributeElements(direction: DistributeDirection, ids?: string[], pageId?: string): void;
  copySelection(): void;
  pasteClipboard(pageId?: string): void;
  setBackground(background: Background, pageId?: string): void;
  addPage(afterPageId?: string): void;
  duplicatePage(pageId?: string): void;
  deletePage(pageId?: string): void;
  movePage(pageId: string, toIndex: number): void;
  hidePage(pageId: string, hidden: boolean): void;
  renamePage(pageId: string, name: string): void;
  setPageNotes(pageId: string, notes: string): void;
  applyTheme(themeId: string): void;
  setFontPair(fontPairId: string): void;
  setColorOverrides(overrides: Partial<Record<ColorToken, string>>): void;
  setFormat(formatId: string, width?: number, height?: number): void;
  relayoutCurrentPage(layoutId?: string): void;
  shuffleCurrentPage(): void;
  setLayout(layoutId: string): void;
  composeFromOutline(outline: LessonOutline, mode?: "replace" | "append"): void;
  undo(): void;
  redo(): void;
}

const emptyHistory = (): History => ({ past: [], future: [], lastKey: null, lastAt: 0 });

export function studioId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createBlankDeck(input: CreateDesignInput = { formatId: DEFAULT_FORMAT_ID }): SceneDeck {
  const format = getFormat(input.formatId);
  const theme = getDeckTheme(DEFAULT_DECK_THEME_ID);
  return {
    v: 2,
    id: studioId("deck"),
    title: input.title?.trim() || "Untitled design",
    kind: format.kind,
    formatId: format.id,
    width: input.width ?? format.width,
    height: input.height ?? format.height,
    themeId: theme.id,
    fontPairId: theme.fontPairId,
    pages: [{ id: studioId("page"), name: "Page 1", background: theme.background, elements: [] }],
  };
}

function commitDeck(state: StudioState, deck: SceneDeck, coalesceKey?: string): Partial<StudioState> {
  if (!state.deck || deck === state.deck) return {};
  const now = Date.now();
  const coalescing = Boolean(coalesceKey && state.history.lastKey === coalesceKey && now - state.history.lastAt < 500);
  return {
    deck,
    history: {
      past: coalescing ? state.history.past : [...state.history.past, state.deck].slice(-100),
      future: [],
      lastKey: coalesceKey ?? null,
      lastAt: now,
    },
  };
}

function updatePage(deck: SceneDeck, pageId: string, update: (page: ScenePage) => ScenePage): SceneDeck {
  const pages = deck.pages.map((page) => page.id === pageId ? update(page) : page);
  return pages.every((page, index) => page === deck.pages[index]) ? deck : { ...deck, pages };
}

function selectedIds(state: StudioState, ids?: string[]): string[] {
  return ids ?? state.selectionIds;
}

function onPage(state: StudioState, pageId?: string): string | null {
  return pageId ?? state.activePageId ?? state.deck?.pages[0]?.id ?? null;
}

function editElements(state: StudioState, set: (elements: SceneElement[]) => SceneElement[], pageId?: string, key?: string): Partial<StudioState> {
  const id = onPage(state, pageId);
  if (!state.deck || !id) return {};
  const deck = updatePage(state.deck, id, (page) => {
    const elements = set(page.elements);
    return elements === page.elements || (elements.length === page.elements.length && elements.every((element, index) => element === page.elements[index])) ? page : { ...page, elements };
  });
  return commitDeck(state, deck, key);
}

function offsetElement(element: SceneElement): SceneElement {
  return { ...element, id: studioId("el"), x: Math.min(1 - element.w, element.x + 0.02), y: Math.min(1 - element.h, element.y + 0.02), group: undefined, edited: true };
}

function orderedElements(elements: SceneElement[], ids: Set<string>, direction: ReorderDirection): SceneElement[] {
  if (direction === "front") return [...elements.filter((element) => !ids.has(element.id)), ...elements.filter((element) => ids.has(element.id))];
  if (direction === "back-most") return [...elements.filter((element) => ids.has(element.id)), ...elements.filter((element) => !ids.has(element.id))];
  const result = [...elements];
  if (direction === "forward") {
    for (let index = result.length - 2; index >= 0; index--) {
      if (ids.has(result[index].id) && !ids.has(result[index + 1].id)) [result[index], result[index + 1]] = [result[index + 1], result[index]];
    }
  } else {
    for (let index = 1; index < result.length; index++) {
      if (ids.has(result[index].id) && !ids.has(result[index - 1].id)) [result[index], result[index - 1]] = [result[index - 1], result[index]];
    }
  }
  return result;
}

function align(elements: SceneElement[], ids: Set<string>, direction: AlignDirection): SceneElement[] {
  const chosen = elements.filter((element) => ids.has(element.id) && !element.locked);
  if (!chosen.length) return elements;
  const minX = chosen.length === 1 ? 0 : Math.min(...chosen.map((element) => element.x));
  const maxX = chosen.length === 1 ? 1 : Math.max(...chosen.map((element) => element.x + element.w));
  const minY = chosen.length === 1 ? 0 : Math.min(...chosen.map((element) => element.y));
  const maxY = chosen.length === 1 ? 1 : Math.max(...chosen.map((element) => element.y + element.h));
  return elements.map((element) => {
    if (!ids.has(element.id) || element.locked) return element;
    const next = { ...element, edited: true };
    if (direction === "left") next.x = minX;
    if (direction === "center") next.x = (minX + maxX - element.w) / 2;
    if (direction === "right") next.x = maxX - element.w;
    if (direction === "top") next.y = minY;
    if (direction === "middle") next.y = (minY + maxY - element.h) / 2;
    if (direction === "bottom") next.y = maxY - element.h;
    return next;
  });
}

function distribute(elements: SceneElement[], ids: Set<string>, direction: DistributeDirection): SceneElement[] {
  const axis = direction === "horizontal" ? "x" : "y";
  const size = direction === "horizontal" ? "w" : "h";
  const chosen = elements.filter((element) => ids.has(element.id) && !element.locked).sort((a, b) => a[axis] - b[axis]);
  if (chosen.length < 3) return elements;
  const first = chosen[0][axis];
  const last = chosen[chosen.length - 1][axis] + chosen[chosen.length - 1][size];
  const occupied = chosen.reduce((sum, element) => sum + element[size], 0);
  const gap = (last - first - occupied) / (chosen.length - 1);
  const positions = new Map<string, number>();
  let cursor = first;
  for (const element of chosen) {
    positions.set(element.id, cursor);
    cursor += element[size] + gap;
  }
  return elements.map((element) => positions.has(element.id) ? { ...element, [axis]: positions.get(element.id), edited: true } : element);
}

function layoutContext(deck: SceneDeck, pageIndex: number) {
  const theme = getDeckTheme(deck.themeId);
  return createLayoutContext({
    width: deck.width,
    height: deck.height,
    theme,
    fontPair: getFontPair(deck.fontPairId ?? theme.fontPairId),
    seed: deck.seed ?? Date.now(),
    recent: deck.pages.slice(0, pageIndex).map((page) => page.layoutId).filter((id): id is string => Boolean(id)),
    newId: () => studioId("el"),
    deckKind: deck.kind,
  });
}

export const useStudio = create<StudioState>((set, get) => ({
  deck: null,
  activePageId: null,
  selectionIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  activePanel: "design",
  savingState: "saved",
  history: emptyHistory(),
  clipboard: [],
  replaceDeck: (deck, options) => set((state) => options?.recordHistory && state.deck
    ? { ...commitDeck(state, deck), activePageId: deck.pages[0]?.id ?? null, selectionIds: [] }
    : { deck, activePageId: deck.pages[0]?.id ?? null, selectionIds: [], history: emptyHistory(), savingState: "saved" }),
  appendPages: (pages) => set((state) => state.deck && pages.length ? commitDeck(state, { ...state.deck, pages: [...state.deck.pages, ...pages] }) : {}),
  setActivePage: (pageId) => set((state) => state.deck?.pages.some((page) => page.id === pageId) ? { activePageId: pageId, selectionIds: [] } : {}),
  selectElements: (ids) => set((state) => ({ selectionIds: [...new Set(ids)].filter((id) => state.deck?.pages.find((page) => page.id === onPage(state))?.elements.some((element) => element.id === id)) })),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, zoom)) }),
  setPan: (pan) => set({ pan }),
  setPanel: (activePanel) => set({ activePanel }),
  setSavingState: (savingState) => set({ savingState }),
  renameDeck: (title) => set((state) => state.deck ? commitDeck(state, { ...state.deck, title }, "deck-title") : {}),
  addElement: (element, pageId) => set((state) => ({ ...editElements(state, (elements) => [...elements, element], pageId), selectionIds: [element.id] })),
  addElements: (elements, pageId) => set((state) => state.deck && elements.length
    ? { ...editElements(state, (current) => [...current, ...elements], pageId), selectionIds: elements.map((element) => element.id) }
    : {}),
  updateElement: (id, patch, pageId, coalesceKey) => set((state) => editElements(state, (elements) => elements.map((element) => element.id === id && !element.locked ? { ...element, ...patch, id: element.id, kind: element.kind, edited: true } as SceneElement : element), pageId, coalesceKey ?? `element-${id}`)),
  removeElements: (ids, pageId) => set((state) => {
    const targets = new Set(selectedIds(state, ids));
    return { ...editElements(state, (elements) => elements.filter((element) => !targets.has(element.id) || element.locked), pageId), selectionIds: state.selectionIds.filter((id) => !targets.has(id)) };
  }),
  duplicateElements: (ids, pageId) => set((state) => {
    const targets = new Set(selectedIds(state, ids));
    const copies = state.deck?.pages.find((page) => page.id === onPage(state, pageId))?.elements.filter((element) => targets.has(element.id)).map(offsetElement) ?? [];
    return copies.length ? { ...editElements(state, (elements) => [...elements, ...copies], pageId), selectionIds: copies.map((element) => element.id) } : {};
  }),
  reorderElements: (direction, ids, pageId) => set((state) => editElements(state, (elements) => orderedElements(elements, new Set(selectedIds(state, ids)), direction), pageId)),
  groupElements: (ids, pageId) => set((state) => {
    const targets = new Set(selectedIds(state, ids));
    if (targets.size < 2) return {};
    const group = studioId("group");
    return editElements(state, (elements) => elements.map((element) => targets.has(element.id) && !element.locked ? { ...element, group, edited: true } : element), pageId);
  }),
  ungroupElements: (ids, pageId) => set((state) => {
    const targets = new Set(selectedIds(state, ids));
    return editElements(state, (elements) => elements.map((element) => targets.has(element.id) && !element.locked ? { ...element, group: undefined, edited: true } : element), pageId);
  }),
  lockElements: (locked, ids, pageId) => set((state) => {
    const targets = new Set(selectedIds(state, ids));
    return editElements(state, (elements) => elements.map((element) => targets.has(element.id) ? { ...element, locked, edited: true } : element), pageId);
  }),
  alignElements: (direction, ids, pageId) => set((state) => editElements(state, (elements) => align(elements, new Set(selectedIds(state, ids)), direction), pageId)),
  distributeElements: (direction, ids, pageId) => set((state) => editElements(state, (elements) => distribute(elements, new Set(selectedIds(state, ids)), direction), pageId)),
  copySelection: () => set((state) => ({ clipboard: state.deck?.pages.find((page) => page.id === onPage(state))?.elements.filter((element) => state.selectionIds.includes(element.id)).map((element) => ({ ...element })) ?? [] })),
  pasteClipboard: (pageId) => set((state) => {
    const copies = state.clipboard.map(offsetElement);
    return copies.length ? { ...editElements(state, (elements) => [...elements, ...copies], pageId), selectionIds: copies.map((element) => element.id) } : {};
  }),
  setBackground: (background, pageId) => set((state) => {
    const id = onPage(state, pageId);
    return state.deck && id ? commitDeck(state, updatePage(state.deck, id, (page) => ({ ...page, background }))) : {};
  }),
  addPage: (afterPageId) => set((state) => {
    if (!state.deck) return {};
    const index = state.deck.pages.findIndex((page) => page.id === (afterPageId ?? state.activePageId));
    const page: ScenePage = { id: studioId("page"), name: `Page ${state.deck.pages.length + 1}`, background: getDeckTheme(state.deck.themeId).background, elements: [] };
    const pages = [...state.deck.pages];
    pages.splice(index < 0 ? pages.length : index + 1, 0, page);
    return { ...commitDeck(state, { ...state.deck, pages }), activePageId: page.id, selectionIds: [] };
  }),
  duplicatePage: (pageId) => set((state) => {
    if (!state.deck) return {};
    const index = state.deck.pages.findIndex((page) => page.id === (pageId ?? state.activePageId));
    if (index < 0) return {};
    const source = state.deck.pages[index];
    const copy: ScenePage = { ...source, id: studioId("page"), name: `${source.name ?? `Page ${index + 1}`} copy`, elements: source.elements.map((element) => ({ ...element, id: studioId("el") })) };
    const pages = [...state.deck.pages];
    pages.splice(index + 1, 0, copy);
    return { ...commitDeck(state, { ...state.deck, pages }), activePageId: copy.id, selectionIds: [] };
  }),
  deletePage: (pageId) => set((state) => {
    if (!state.deck || state.deck.pages.length <= 1) return {};
    const index = state.deck.pages.findIndex((page) => page.id === (pageId ?? state.activePageId));
    if (index < 0) return {};
    const pages = state.deck.pages.filter((_, candidate) => candidate !== index);
    return { ...commitDeck(state, { ...state.deck, pages }), activePageId: pages[Math.min(index, pages.length - 1)].id, selectionIds: [] };
  }),
  movePage: (pageId, toIndex) => set((state) => {
    if (!state.deck) return {};
    const index = state.deck.pages.findIndex((page) => page.id === pageId);
    if (index < 0) return {};
    const pages = [...state.deck.pages];
    const [page] = pages.splice(index, 1);
    pages.splice(Math.max(0, Math.min(toIndex, pages.length)), 0, page);
    return commitDeck(state, { ...state.deck, pages });
  }),
  hidePage: (pageId, hidden) => set((state) => state.deck ? commitDeck(state, updatePage(state.deck, pageId, (page) => ({ ...page, hidden }))) : {}),
  renamePage: (pageId, name) => set((state) => state.deck ? commitDeck(state, updatePage(state.deck, pageId, (page) => ({ ...page, name })), `page-name-${pageId}`) : {}),
  setPageNotes: (pageId, notes) => set((state) => state.deck ? commitDeck(state, updatePage(state.deck, pageId, (page) => ({ ...page, notes })), `page-notes-${pageId}`) : {}),
  applyTheme: (themeId) => set((state) => state.deck ? commitDeck(state, applyDeckTheme(state.deck, getDeckTheme(themeId))) : {}),
  setFontPair: (fontPairId) => set((state) => state.deck ? commitDeck(state, reflowDeck(state.deck, { fontPair: getFontPair(fontPairId), newId: () => studioId("el") })) : {}),
  setColorOverrides: (overrides) => set((state) => state.deck ? commitDeck(state, { ...state.deck, colorOverrides: overrides }) : {}),
  setFormat: (formatId, width, height) => set((state) => {
    if (!state.deck) return {};
    const format = getFormat(formatId);
    return commitDeck(state, reflowDeck(state.deck, { format: { id: format.id, kind: format.kind, width: width ?? format.width, height: height ?? format.height }, newId: () => studioId("el") }));
  }),
  relayoutCurrentPage: (layoutId) => set((state) => {
    if (!state.deck || !state.activePageId) return {};
    const index = state.deck.pages.findIndex((page) => page.id === state.activePageId);
    if (index < 0) return {};
    const source = state.deck.pages[index];
    const content = syncContentFromElements(source) ?? source.content;
    if (!content) return {};
    const pages = relayoutPage({ ...source, content }, layoutContext(state.deck, index), layoutId);
    return commitDeck(state, { ...state.deck, pages: [...state.deck.pages.slice(0, index), ...pages, ...state.deck.pages.slice(index + 1)] });
  }),
  shuffleCurrentPage: () => set((state) => {
    if (!state.deck || !state.activePageId) return {};
    const index = state.deck.pages.findIndex((page) => page.id === state.activePageId);
    if (index < 0) return {};
    const pages = shuffleLayout(state.deck.pages[index], layoutContext(state.deck, index));
    return commitDeck(state, { ...state.deck, pages: [...state.deck.pages.slice(0, index), ...pages, ...state.deck.pages.slice(index + 1)] });
  }),
  setLayout: (layoutId) => get().relayoutCurrentPage(layoutId),
  composeFromOutline: (outline, mode = "replace") => {
    const current = get().deck;
    const format = current ? { id: current.formatId, kind: current.kind, width: current.width, height: current.height } : getFormat(DEFAULT_FORMAT_ID);
    const theme = getDeckTheme(current?.themeId ?? DEFAULT_DECK_THEME_ID);
    const composed = composeDeck(planSlides(outline), { format, theme, fontPair: getFontPair(current?.fontPairId ?? theme.fontPairId), title: outline.title, newId: () => studioId("scene"), id: mode === "append" ? current?.id : studioId("deck") });
    if (mode === "append" && current) get().appendPages(composed.pages);
    else get().replaceDeck(composed);
  },
  undo: () => set((state) => {
    if (!state.deck || !state.history.past.length) return {};
    const past = [...state.history.past];
    const deck = past.pop()!;
    return { deck, activePageId: deck.pages.some((page) => page.id === state.activePageId) ? state.activePageId : deck.pages[0]?.id ?? null, selectionIds: [], history: { past, future: [state.deck, ...state.history.future].slice(0, 100), lastKey: null, lastAt: 0 } };
  }),
  redo: () => set((state) => {
    if (!state.deck || !state.history.future.length) return {};
    const [deck, ...future] = state.history.future;
    return { deck, activePageId: deck.pages.some((page) => page.id === state.activePageId) ? state.activePageId : deck.pages[0]?.id ?? null, selectionIds: [], history: { past: [...state.history.past, state.deck].slice(-100), future, lastKey: null, lastAt: 0 } };
  }),
}));
