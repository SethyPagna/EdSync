import type { LessonOutline } from "@/lib/compose";
import { DEFAULT_DECK_THEME_ID, findFormat, formatForSize, getDeckTheme } from "@/lib/studio/library";
import type { Background, DeckKind, SceneDeck, SceneElement, ScenePage, ShapeKind } from "./scene";

export type StudioDocumentV2 = {
  app: "EdSync Studio";
  version: 2;
  deck: SceneDeck;
  outline?: LessonOutline;
};

export type LoadedStudioDocument = {
  deck: SceneDeck;
  outline?: LessonOutline;
  convertedFromLegacy: boolean;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalize(value: number, dimension: number): number {
  return Math.max(0, Math.min(1, value / dimension));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sceneBackground(value: unknown): boolean {
  const source = object(value);
  if (!source) return false;
  if (source.kind === "solid") return typeof source.color === "string";
  if (source.kind === "gradient") return typeof source.from === "string" && typeof source.to === "string" && finite(source.angle);
  if (source.kind === "image") return typeof source.src === "string";
  if (source.kind === "pattern") return typeof source.pattern === "string" && typeof source.color === "string" && typeof source.on === "string";
  return false;
}

function sceneElement(value: unknown): boolean {
  const source = object(value);
  if (!source || typeof source.id !== "string" || typeof source.role !== "string" || !finite(source.x) || !finite(source.y) || !finite(source.w) || !finite(source.h)) return false;
  if (source.kind === "text") return typeof source.text === "string" && typeof source.style === "string";
  if (source.kind === "shape") return typeof source.shape === "string";
  if (source.kind === "image") return typeof source.src === "string";
  if (source.kind === "icon") return typeof source.icon === "string";
  if (source.kind === "chart") return typeof source.chart === "string" && Array.isArray(source.data) && source.data.every((datum) => { const entry = object(datum); return entry && typeof entry.label === "string" && finite(entry.value); });
  if (source.kind === "table") return Array.isArray(source.rows) && source.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));
  return false;
}

function sceneDeck(value: unknown): value is SceneDeck {
  const deck = object(value);
  return Boolean(deck && deck.v === 2 && typeof deck.id === "string" && typeof deck.title === "string" && typeof deck.kind === "string" && typeof deck.formatId === "string" && typeof deck.themeId === "string" && finite(deck.width) && deck.width > 0 && finite(deck.height) && deck.height > 0 && Array.isArray(deck.pages) && deck.pages.length > 0 && deck.pages.every((value) => {
    const page = object(value);
    return page && typeof page.id === "string" && sceneBackground(page.background) && Array.isArray(page.elements) && page.elements.every(sceneElement);
  }));
}

function legacyElement(value: unknown, width: number, height: number): SceneElement | null {
  const source = object(value);
  if (!source) return null;
  const type = text(source.type).toLowerCase();
  const left = number(source.left);
  const top = number(source.top);
  const elementWidth = Math.max(1, number(source.width, 1) * number(source.scaleX, 1));
  const elementHeight = Math.max(1, number(source.height, 1) * number(source.scaleY, 1));
  const base = {
    id: text(source.esId) || id("el"),
    role: "shape" as const,
    x: normalize(left, width),
    y: normalize(top, height),
    w: Math.min(1, elementWidth / width),
    h: Math.min(1, elementHeight / height),
    rotation: number(source.angle) || undefined,
    opacity: number(source.opacity, 1),
    hidden: source.visible === false,
    locked: source.selectable === false,
    edited: true,
  };
  if (["textbox", "text", "i-text", "itext"].includes(type)) {
    return {
      ...base,
      kind: "text",
      role: "body",
      text: text(source.text),
      style: "body",
      color: text(source.fill, "text"),
      fontSize: number(source.fontSize, 24),
      fontFamily: text(source.fontFamily, "body"),
      fontWeight: number(source.fontWeight, 400),
      italic: source.fontStyle === "italic",
      underline: source.underline === true,
      align: ["left", "center", "right", "justify"].includes(text(source.textAlign)) ? source.textAlign as "left" | "center" | "right" | "justify" : "left",
    };
  }
  if (type === "image") {
    return { ...base, kind: "image", role: "media", src: text(source.src), fit: "cover" };
  }
  if (["rect", "circle", "ellipse", "triangle"].includes(type)) {
    return {
      ...base,
      kind: "shape",
      shape: (type === "rect" ? number(source.rx) > 0 ? "rounded" : "rect" : type) as ShapeKind,
      fill: text(source.fill, "transparent"),
      stroke: text(source.stroke, "transparent"),
      strokeWidth: number(source.strokeWidth),
      radius: number(source.rx) || undefined,
    };
  }
  return null;
}

function legacyPage(value: unknown, index: number, width: number, height: number, defaultBackground: Background): ScenePage {
  const source = object(value) ?? {};
  const snapshot = object(source.snapshot);
  const rawObjects = Array.isArray(snapshot?.objects) ? snapshot.objects : [];
  const elements: SceneElement[] = [];
  let background = defaultBackground;
  for (const rawObject of rawObjects) {
    const candidate = object(rawObject);
    if (candidate?.type === "rect" && candidate.selectable === false && number(candidate.left) <= 1 && number(candidate.top) <= 1 && number(candidate.width) * number(candidate.scaleX, 1) >= width - 1 && number(candidate.height) * number(candidate.scaleY, 1) >= height - 1 && typeof candidate.fill === "string") {
      background = { kind: "solid", color: candidate.fill };
      continue;
    }
    const element = legacyElement(rawObject, width, height);
    if (element) elements.push(element);
  }
  if (!elements.length) {
    const seed = object(source.seed);
    const title = text(seed?.title);
    const body = text(seed?.body);
    if (title) elements.push({ id: id("el"), kind: "text", role: "title", style: "title", text: title, x: 0.08, y: 0.12, w: 0.84, h: 0.18, color: "text" });
    if (body) elements.push({ id: id("el"), kind: "text", role: "body", style: "body", text: body, x: 0.08, y: 0.34, w: 0.84, h: 0.5, color: "text" });
  }
  return { id: text(source.id) || id("page"), name: text(source.name, `Page ${index + 1}`), background, elements, notes: text(source.notes) };
}

function legacyDocument(content: JsonObject): LoadedStudioDocument | null {
  const project = object(content.project);
  const pages = Array.isArray(content.pages) ? content.pages : null;
  if (!project || !pages) return null;
  const width = Math.max(1, number(project.width, 1280));
  const height = Math.max(1, number(project.height, 720));
  const format = findFormat(text(project.templateId)) ?? formatForSize(width, height);
  const theme = getDeckTheme(DEFAULT_DECK_THEME_ID);
  const oldKind = text(project.kind);
  const kind: DeckKind = oldKind === "doc" ? "doc" : oldKind === "design" ? "design" : "slides";
  return {
    deck: {
      v: 2,
      id: text(project.id) || id("deck"),
      title: text(project.title, "Untitled design"),
      kind,
      formatId: format?.id ?? "custom",
      width,
      height,
      themeId: theme.id,
      fontPairId: theme.fontPairId,
      pages: pages.map((page, index) => legacyPage(page, index, width, height, theme.background)),
    },
    convertedFromLegacy: true,
  };
}

export function readStudioDocument(value: unknown): LoadedStudioDocument | null {
  const content = object(value);
  if (!content || content.app !== "EdSync Studio") return null;
  if (content.version === 2) {
    if (!sceneDeck(content.deck)) return null;
    const outline = object(content.outline);
    return { deck: content.deck, outline: outline ? outline as unknown as LessonOutline : undefined, convertedFromLegacy: false };
  }
  return content.version === 1 ? legacyDocument(content) : null;
}

export function writeStudioDocument(deck: SceneDeck, outline?: LessonOutline): StudioDocumentV2 {
  return { app: "EdSync Studio", version: 2, deck, ...(outline ? { outline } : {}) };
}

export function studioPlainText(deck: SceneDeck): string {
  return deck.pages.flatMap((page) => page.elements.filter((element) => element.kind === "text").map((element) => element.text)).join("\n");
}
