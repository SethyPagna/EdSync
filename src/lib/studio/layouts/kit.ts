import { getIcon } from "@/lib/studio/library";
import { measureTextAt, splitTextToFit, splitToFit, fitTextToBox, wordsFit } from "../fit";
import { backgroundBaseColor, colorContrast, readableToken, resolveThemePaint } from "../paint";
import type {
  Background,
  ContentItem,
  ContentKind,
  DeckKind,
  ElementRole,
  IconElement,
  ImageElement,
  LayoutContext,
  LayoutDef,
  Paint,
  SceneElement,
  ShapeElement,
  ShapeKind,
  SlideContent,
  TextElement,
  TextStyleToken,
} from "../scene";
import { TEXT_STYLES, resolveTextStyle, textScale, type ResolvedTextStyle } from "../text-styles";

/* ------------------------------------------------------------------ */
/* Content helpers                                                     */
/* ------------------------------------------------------------------ */

/** Content plus the engine's numbering offset for continuation pages. */
export type EngineContent = SlideContent & { listStart?: number };

export type Orientation = "landscape" | "portrait" | "square";

export function orientationOf(width: number, height: number): Orientation {
  const aspect = width / Math.max(1, height);
  if (aspect >= 1.15) return "landscape";
  if (aspect <= 0.87) return "portrait";
  return "square";
}

export type ListField = "bullets" | "items" | "steps" | "terms" | "stats";

export interface Entry {
  /** Index in the source array (slot names use it). */
  index: number;
  /** Slot prefix, e.g. "item-2". */
  key: string;
  title: string;
  body?: string;
  icon?: string;
  slotTitle: string;
  slotBody: string;
}

export interface ListSource {
  field: ListField;
  entries: Entry[];
}

export const DEFAULT_LIST_ORDER: readonly ListField[] = ["items", "bullets", "steps", "terms", "stats"];

export const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Canonical library id for an icon id or alias; undefined when the library has no such icon. */
export function knownIcon(id: unknown): string | undefined {
  return getIcon(clean(id))?.id;
}

export function entriesOf(content: SlideContent, field: ListField): Entry[] {
  const out: Entry[] = [];
  const push = (index: number, key: string, title: string, body: string | undefined, slotTitle: string, slotBody: string, icon?: string) => {
    if (!title && !body) return;
    out.push({ index, key, title, body: body || undefined, icon: icon || undefined, slotTitle, slotBody });
  };
  switch (field) {
    case "bullets":
      (content.bullets ?? []).forEach((text, i) => push(i, `bullet-${i}`, clean(text), undefined, `bullet-${i}`, `bullet-${i}-body`));
      break;
    case "steps":
      (content.steps ?? []).forEach((text, i) => push(i, `step-${i}`, clean(text), undefined, `step-${i}`, `step-${i}-body`));
      break;
    case "items":
      (content.items ?? []).forEach((item, i) =>
        push(i, `item-${i}`, clean(item?.title), clean(item?.body), `item-${i}-title`, `item-${i}-body`, clean(item?.icon)),
      );
      break;
    case "terms":
      (content.terms ?? []).forEach((term, i) =>
        push(i, `term-${i}`, clean(term?.term), clean(term?.definition), `term-${i}`, `term-${i}-def`),
      );
      break;
    case "stats":
      (content.stats ?? []).forEach((stat, i) =>
        push(i, `stat-${i}`, clean(stat?.value), clean(stat?.label), `stat-${i}-value`, `stat-${i}-label`),
      );
      break;
  }
  return out;
}

export function listSource(content: SlideContent, order: readonly ListField[] = DEFAULT_LIST_ORDER): ListSource | null {
  for (const field of order) {
    const entries = entriesOf(content, field);
    if (entries.length) return { field, entries };
  }
  return null;
}

const joinEntry = (e: Entry) => (e.body ? `${e.title}: ${e.body}` : e.title);

export function entriesToField(field: ListField, entries: Entry[]): Partial<SlideContent> {
  switch (field) {
    case "bullets":
      return { bullets: entries.map(joinEntry) };
    case "steps":
      return { steps: entries.map(joinEntry) };
    case "items":
      return {
        items: entries.map((e) => {
          const item: ContentItem = { title: e.title };
          if (e.body) item.body = e.body;
          if (e.icon) item.icon = e.icon;
          return item;
        }),
      };
    case "terms":
      return { terms: entries.map((e) => ({ term: e.title, definition: e.body ?? "" })) };
    case "stats":
      return { stats: entries.map((e) => ({ value: e.title, label: e.body ?? "" })) };
  }
}

export function choicesOf(content: SlideContent): string[] {
  return (content.question?.choices ?? []).map(clean).filter(Boolean);
}

export function isTrueFalse(content: SlideContent): boolean {
  const q = content.question;
  if (!q) return false;
  const choices = choicesOf(content).map((c) => c.toLowerCase());
  if (choices.length === 2) {
    const known = [["true", "false"], ["yes", "no"], ["verdadero", "falso"], ["vrai", "faux"], ["richtig", "falsch"]];
    if (known.some(([a, b]) => choices[0] === a && choices[1] === b)) return true;
  }
  return choices.length === 0 && typeof q.answer === "boolean";
}

/** Question prompt, falling back to the page title. */
export function promptOf(content: SlideContent): string {
  return clean(content.question?.prompt) || clean(content.title);
}

export function quoteOf(content: SlideContent): { text: string; author: string } {
  const text = clean(content.quote?.text) || clean(content.body) || clean(content.title);
  return { text, author: clean(content.quote?.author) };
}

/** Timeline/step label split: "1905: Special relativity" → ["1905", "Special relativity"]. */
export function splitLabel(text: string): [string, string] | null {
  const match = /^\s*([^:–—-]{1,24}?)\s*[:–—-]\s+(.+)$/.exec(text);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()];
}

/* ------------------------------------------------------------------ */
/* Content shape analysis (drives scoring)                            */
/* ------------------------------------------------------------------ */

export interface ContentShape {
  kind: ContentKind;
  titleLen: number;
  subtitleLen: number;
  bodyLen: number;
  bullets: number;
  items: number;
  itemBodies: number;
  itemIcons: number;
  steps: number;
  terms: number;
  stats: number;
  choices: number;
  /** Primary list (items > bullets > steps > terms > stats). */
  listField: ListField | null;
  listCount: number;
  listChars: number;
  maxEntryChars: number;
  avgEntryChars: number;
  hasImage: boolean;
  hasQuote: boolean;
  quoteLen: number;
  hasCompare: boolean;
  comparePoints: number;
  hasQuestion: boolean;
  trueFalse: boolean;
  hasBody: boolean;
  totalChars: number;
}

const shapeCache = new WeakMap<SlideContent, ContentShape>();

export function analyze(content: SlideContent): ContentShape {
  const cached = shapeCache.get(content);
  if (cached) return cached;
  const source = listSource(content);
  const entries = source?.entries ?? [];
  const entryChars = entries.map((e) => e.title.length + (e.body?.length ?? 0));
  const listChars = entryChars.reduce((a, b) => a + b, 0);
  const items = entriesOf(content, "items");
  const compare = content.compare;
  const comparePoints = compare ? (compare.a?.points?.length ?? 0) + (compare.b?.points?.length ?? 0) : 0;
  const shape: ContentShape = {
    kind: content.kind,
    titleLen: clean(content.title).length,
    subtitleLen: clean(content.subtitle).length,
    bodyLen: clean(content.body).length,
    bullets: entriesOf(content, "bullets").length,
    items: items.length,
    itemBodies: items.filter((i) => i.body).length,
    itemIcons: items.filter((i) => knownIcon(i.icon)).length,
    steps: entriesOf(content, "steps").length,
    terms: entriesOf(content, "terms").length,
    stats: entriesOf(content, "stats").length,
    choices: choicesOf(content).length,
    listField: source?.field ?? null,
    listCount: entries.length,
    listChars,
    maxEntryChars: entryChars.length ? Math.max(...entryChars) : 0,
    avgEntryChars: entries.length ? listChars / entries.length : 0,
    hasImage: Boolean(clean(content.image) || clean(content.imageQuery)),
    hasQuote: Boolean(clean(content.quote?.text)),
    quoteLen: clean(content.quote?.text).length,
    hasCompare: Boolean(compare && (comparePoints > 0 || clean(compare.a?.label) || clean(compare.b?.label))),
    comparePoints,
    hasQuestion: Boolean(clean(content.question?.prompt)),
    trueFalse: isTrueFalse(content),
    hasBody: Boolean(clean(content.body)),
    totalChars: 0,
  };
  shape.totalChars =
    shape.titleLen + shape.subtitleLen + shape.bodyLen + listChars + shape.quoteLen +
    (compare ? [...(compare.a?.points ?? []), ...(compare.b?.points ?? [])].join("").length : 0);
  shapeCache.set(content, shape);
  return shape;
}

/* ------------------------------------------------------------------ */
/* Layout definition helper                                            */
/* ------------------------------------------------------------------ */

type BuildResult = ReturnType<LayoutDef["build"]>;

/** Layout context plus the optional deck kind (documents, social posts...) used by scoring. */
export type EngineContext = LayoutContext & { deckKind?: DeckKind };

export function deckKindOf(ctx: LayoutContext): DeckKind | undefined {
  return (ctx as EngineContext).deckKind;
}

export interface LayoutSpec {
  id: string;
  name: string;
  kinds: ContentKind[];
  orientation: LayoutDef["orientation"];
  /** Score multipliers by deck kind (1 when missing or when the context has no deck kind). */
  deckKinds?: Partial<Record<DeckKind, number>>;
  /** Base suitability from the content shape; 0 = unsuitable. */
  fit: (shape: ContentShape, content: SlideContent, ctx: LayoutContext) => number;
  build: (content: EngineContent, ctx: LayoutContext) => BuildResult;
}

export function orientationFactor(layout: LayoutDef["orientation"], page: Orientation): number {
  if (layout === "any" || layout === page) return 1;
  return page === "square" ? 0.8 : 0;
}

function family(id: string): string {
  return id.split("-").slice(0, 2).join("-");
}

export function recencyFactor(id: string, recent: readonly string[]): number {
  const last = recent[recent.length - 1];
  if (last === id) return 0.55;
  if (recent.slice(-3).includes(id)) return 0.85;
  if (last && family(last) === family(id)) return 0.88;
  return 1;
}

export function defineLayout(spec: LayoutSpec): LayoutDef {
  return {
    id: spec.id,
    name: spec.name,
    kinds: spec.kinds,
    orientation: spec.orientation,
    score: (content, ctx) => {
      const base = spec.fit(analyze(content), content, ctx);
      if (!(base > 0)) return 0;
      const kind = spec.kinds.includes(content.kind) ? 1 : 0.5;
      const orient = orientationFactor(spec.orientation, orientationOf(ctx.width, ctx.height));
      const deckKind = deckKindOf(ctx);
      const deck = deckKind ? spec.deckKinds?.[deckKind] ?? 1 : 1;
      return Math.round(base * kind * orient * deck * recencyFactor(spec.id, ctx.recent) * 100) / 100;
    },
    build: (content, ctx) => spec.build(content, ctx),
  };
}

/* ------------------------------------------------------------------ */
/* Kit                                                                 */
/* ------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Surface = "hero" | "content" | Background;

export interface Ink {
  color: Paint;
  opacity?: number;
}

export interface TextSpec {
  text: string;
  style: TextStyleToken;
  role: ElementRole;
  slot?: string;
  /** Box width, px. */
  w: number;
  /** Height budget, px (shrinks toward the style minimum to fit). */
  maxH?: number;
  /** Fixed size, px (no fitting). */
  size?: number;
  maxSize?: number;
  minSize?: number;
  align?: TextElement["align"];
  color?: Paint;
  opacity?: number;
  fill?: Paint;
  weight?: number;
  italic?: boolean;
  uppercase?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
  list?: TextElement["list"];
  locked?: boolean;
}

export interface Measured {
  spec: TextSpec;
  style: ResolvedTextStyle;
  fontSize: number;
  h: number;
  lines: number;
  overflow: boolean;
}

export type StackBlock =
  | { m: Measured; gap?: number; x?: number; group?: string }
  | { h: number; gap?: number; draw: (y: number) => void };

export type CardTone = "default" | "accent" | "soft" | "muted" | "plain";

export type Marker = "dot" | "number" | "letter" | "check" | "dash" | "none";

export interface ListOptions {
  marker?: Marker;
  /** Style for title-only entries. */
  style?: TextStyleToken;
  titleStyle?: TextStyleToken;
  bodyStyle?: TextStyleToken;
  gapEm?: number;
  ink?: Ink;
  align?: TextElement["align"];
  /** Upper bound for the type scale (share a scale across several lists). */
  maxScale?: number;
  /** Keep the base type size (documents): overflow continues instead of shrinking. */
  fixed?: boolean;
  /** Let a sparse list grow its type to use the space (default: primary lists, i.e. not small/caption or fixed). */
  grow?: boolean;
  /** Most entries on one page; defaults to a readable slide density (none for documents). */
  maxEntries?: number;
  /** Handles entries that did not fit; by default they continue on the next page. */
  onRest?: (rest: Entry[]) => void;
}

export interface CardOptions {
  cols: number;
  capacity?: number;
  badge?: "number" | "icon" | "letter" | "none";
  titleStyle?: TextStyleToken;
  bodyStyle?: TextStyleToken;
  tone?: CardTone | ((index: number) => CardTone);
  horizontal?: boolean;
  align?: "left" | "center";
  /** Minimum card height as a share of the available height. */
  fill?: number;
  gapX?: number;
  gapY?: number;
  /** Titles take the accent color (glossary terms). */
  accentTitles?: boolean;
  /** Title-only entries use the title style at body weight. */
  plainTitles?: boolean;
  /** No card shape and no padding (open grids). */
  bare?: boolean;
  badgeLabel?: (entry: Entry, n: number) => string;
  badgeTone?: "accent" | "soft" | "outline" | "surface";
  /** Number of the first entry (defaults to the content's list offset). */
  startIndex?: number;
  /** Let sparse cards grow their type (and badges) to use the space (default true). */
  grow?: boolean;
  /** Vertical placement of the grid in the area when it is shorter than the area. */
  valign?: "top" | "middle";
}

const LEFTOVER_FIELDS = [
  "subtitle",
  "body",
  "bullets",
  "items",
  "steps",
  "terms",
  "stats",
  "compare",
  "quote",
  "question",
] as const;

type ContentField = (typeof LEFTOVER_FIELDS)[number] | "title" | "kicker" | "image";

function hasValue(content: SlideContent, field: (typeof LEFTOVER_FIELDS)[number]): boolean {
  switch (field) {
    case "subtitle":
    case "body":
      return Boolean(clean(content[field]));
    case "compare":
      return analyze(content).hasCompare;
    case "quote":
      return Boolean(clean(content.quote?.text));
    case "question":
      return Boolean(clean(content.question?.prompt));
    default:
      return entriesOf(content, field).length > 0;
  }
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Most one-line entries a slide list shows before continuing on another page. */
const SLIDE_MAX_ENTRIES = 8;
/** Most title + body entries a slide list shows before continuing on another page. */
const SLIDE_MAX_RICH_ENTRIES = 6;
/** Share of its area a grown list or card may fill, so growth never removes the whitespace. */
const GROW_FILL = 0.7;
const GROW_STEP = 0.1;
/** Where a vertically centered block sits in its free space (slightly above center reads as centered). */
const MIDDLE_BIAS = 0.42;

/** Neutral icon for icon-grid entries without a (known) icon of their own. */
const DEFAULT_BADGE_ICON = "sparkles";

/** Fill each badge tone draws (see `badge()`). */
const BADGE_FILL: Record<"accent" | "soft" | "outline" | "surface", Paint> = { accent: "accent", soft: "accentSoft", outline: "transparent", surface: "surface" };

/** Badge label size as a share of the badge diameter. */
const badgeRatio = (label: string) => (label.length > 2 ? 0.34 : 0.42);

function boosted(style: ResolvedTextStyle, boost: number): ResolvedTextStyle {
  return boost === 1 ? style : { ...style, fontSize: style.fontSize * boost };
}

export class LayoutKit {
  readonly W: number;
  readonly H: number;
  /** Type/space scale: shorter side / 720. */
  readonly s: number;
  /** Spacing unit (8px at 720). */
  readonly u: number;
  readonly orient: Orientation;
  readonly safe: Box;
  readonly gutter: number;
  readonly radius: number;
  readonly pad: number;
  readonly background: Background;
  /** Page inks; `accentSmall` is the accent for small text (kickers), only when it reaches 4.5:1. */
  readonly ink: { text: Paint; muted: Ink; accent: Paint; accentSmall: Paint; onBgStrong: Paint };
  private readonly decoEls: SceneElement[] = [];
  private readonly els: SceneElement[] = [];
  private readonly consumed = new Set<ContentField>();
  private readonly patch: Partial<EngineContent> = {};
  private continues = false;

  constructor(
    readonly content: EngineContent,
    readonly ctx: LayoutContext,
    surface: Surface = "content",
  ) {
    const { width: W, height: H, theme } = ctx;
    this.W = W;
    this.H = H;
    this.s = textScale(W, H);
    this.u = 8 * this.s;
    this.orient = orientationOf(W, H);
    const mx = Math.round(W * (this.orient === "portrait" ? 0.08 : this.orient === "landscape" ? 0.06 : 0.075));
    const my = Math.round(Math.min(Math.max(mx, H * 0.07), H * 0.12));
    this.safe = { x: mx, y: my, w: W - mx * 2, h: H - my * 2 };
    this.gutter = Math.round((this.orient === "portrait" ? 20 : 24) * this.s);
    this.radius = Math.round(Math.max(0, theme.radius) * this.s);
    this.pad = Math.round(22 * this.s);
    this.background =
      surface === "hero"
        ? theme.heroBackground ?? theme.background
        : surface === "content"
          ? theme.background
          : surface;
    this.ink = this.inkFor(backgroundBaseColor(this.background, theme));
  }

  get landscape() {
    return this.orient === "landscape";
  }
  get portrait() {
    return this.orient === "portrait";
  }
  get square() {
    return this.orient === "square";
  }
  get right() {
    return this.safe.x + this.safe.w;
  }
  get bottom() {
    return this.safe.y + this.safe.h;
  }

  private inkFor(bg: string) {
    const theme = this.ctx.theme;
    const contrast = (paint: Paint) => colorContrast(resolveThemePaint(paint, theme), bg);
    if (contrast("text") >= 4.5) {
      const mutedOk = contrast("muted") >= 3.5;
      return {
        text: "text" as Paint,
        muted: mutedOk ? { color: "muted" as Paint } : { color: "text" as Paint, opacity: 0.75 },
        accent: (contrast("accent") >= 3 ? "accent" : "text") as Paint,
        accentSmall: (contrast("accent") >= 4.5 ? "accent" : "text") as Paint,
        onBgStrong: "text" as Paint,
      };
    }
    const token = readableToken(bg, theme, ["onAccent", "bg", "surface", "text"]);
    return {
      text: token as Paint,
      muted: { color: token as Paint, opacity: 0.8 },
      accent: (contrast("accent") >= 3 ? "accent" : token) as Paint,
      accentSmall: (contrast("accent") >= 4.5 ? "accent" : token) as Paint,
      onBgStrong: token as Paint,
    };
  }

  /** Accent for small text on a fill (4.5:1), else the most readable of accent and text. */
  accentSmallOn(fill: Paint): Paint {
    const theme = this.ctx.theme;
    const on = fill === "transparent" ? backgroundBaseColor(this.background, theme) : resolveThemePaint(fill, theme);
    if (colorContrast(resolveThemePaint("accent", theme), on) >= 4.5) return "accent";
    return readableToken(on, theme, ["text", "accent"]);
  }

  /* ---------------- geometry ---------------- */

  col(start: number, span: number, area: Box = this.safe): { x: number; w: number } {
    const colW = (area.w - this.gutter * 11) / 12;
    return { x: area.x + start * (colW + this.gutter), w: span * colW + (span - 1) * this.gutter };
  }

  columns(area: Box, count: number, gap = this.gutter): Box[] {
    const n = Math.max(1, count);
    const w = (area.w - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x: area.x + i * (w + gap), y: area.y, w, h: area.h }));
  }

  rows(area: Box, count: number, gap = this.gutter): Box[] {
    const n = Math.max(1, count);
    const h = (area.h - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ x: area.x, y: area.y + i * (h + gap), w: area.w, h }));
  }

  grid(area: Box, count: number, cols: number, gapX = this.gutter, gapY = this.gutter): Box[] {
    const c = Math.max(1, Math.min(cols, count));
    const r = Math.max(1, Math.ceil(count / c));
    const w = (area.w - gapX * (c - 1)) / c;
    const h = (area.h - gapY * (r - 1)) / r;
    return Array.from({ length: count }, (_, i) => ({
      x: area.x + (i % c) * (w + gapX),
      y: area.y + Math.floor(i / c) * (h + gapY),
      w,
      h,
    }));
  }

  below(area: Box, top: number, gap = 0): Box {
    const y = Math.min(area.y + area.h, top + gap);
    return { x: area.x, y, w: area.w, h: Math.max(0, area.y + area.h - y) };
  }

  norm(box: Box): Pick<SceneElement, "x" | "y" | "w" | "h"> {
    const x = Math.min(1, Math.max(0, round5(box.x / this.W)));
    const y = Math.min(1, Math.max(0, round5(box.y / this.H)));
    const w = Math.max(0, Math.min(round5(box.w / this.W), round5(1 - x)));
    const h = Math.max(0, Math.min(round5(box.h / this.H), round5(1 - y)));
    return { x, y, w, h };
  }

  /* ---------------- text ---------------- */

  style(token: TextStyleToken): ResolvedTextStyle {
    return resolveTextStyle(token, this.ctx.fontPair, { width: this.W, height: this.H, kind: deckKindOf(this.ctx) });
  }

  sizeAt(token: TextStyleToken, scale: number): number {
    const style = this.style(token);
    return Math.max(style.minSize, Math.round(style.fontSize * scale));
  }

  /** Largest type boost for sparse content: documents keep reading sizes, social and print designs grow most. */
  growLimit(): number {
    const kind = deckKindOf(this.ctx);
    if (kind === "doc" || kind === "worksheet") return 1;
    return kind === "social" || kind === "design" ? 1.6 : 1.4;
  }

  /** Largest boost in (1, limit] whose height fills at most `GROW_FILL` of `maxH`; 1 when none does. */
  growScale(heightAt: (boost: number) => number, maxH: number, limit = this.growLimit()): number {
    for (let b = Math.round(limit * 100) / 100; b > 1.001; b = Math.round((b - GROW_STEP) * 100) / 100) {
      if (heightAt(b) <= maxH * GROW_FILL) return b;
    }
    return 1;
  }

  private resolveSpec(spec: TextSpec): ResolvedTextStyle {
    const base = this.style(spec.style);
    return {
      ...base,
      fontWeight: spec.weight ?? base.fontWeight,
      italic: spec.italic ?? base.italic,
      uppercase: spec.uppercase ?? base.uppercase,
      lineHeight: spec.lineHeight ?? base.lineHeight,
      letterSpacing: spec.letterSpacing ?? base.letterSpacing,
    };
  }

  /** True when every word of `text` fits `width` at `size` (no mid-word breaks). */
  wordsFit(text: string, token: TextStyleToken, width: number, size: number, weight?: number): boolean {
    if (!clean(text)) return true;
    const style = { ...this.style(token), ...(weight ? { fontWeight: weight } : {}) };
    return wordsFit(text, style, size, width, this.ctx.measure);
  }

  textHeight(text: string, token: TextStyleToken, width: number, size?: number, weight?: number): number {
    if (!clean(text)) return 0;
    const style = { ...this.style(token), ...(weight ? { fontWeight: weight } : {}) };
    return measureTextAt(text, style, size ?? style.fontSize, width, this.ctx.measure).height;
  }

  measure(spec: TextSpec): Measured {
    const style = this.resolveSpec(spec);
    if (!clean(spec.text)) return { spec, style, fontSize: style.fontSize, h: 0, lines: 0, overflow: false };
    if (spec.size) {
      const size = Math.max(1, Math.round(spec.size));
      const r = measureTextAt(spec.text, style, size, spec.w, this.ctx.measure);
      return { spec, style, fontSize: size, h: r.height, lines: r.lines, overflow: spec.maxH !== undefined && r.height > spec.maxH + 0.5 };
    }
    const max = Math.max(1, Math.round(spec.maxSize ?? style.fontSize));
    const min = Math.min(max, Math.round(spec.minSize ?? style.minSize));
    const fit = fitTextToBox(spec.text, { ...style, fontSize: max, minSize: min }, spec.w, spec.maxH ?? Number.POSITIVE_INFINITY, this.ctx.measure);
    return { spec, style, fontSize: fit.fontSize, h: fit.height, lines: fit.lines, overflow: fit.overflow };
  }

  /** Adds a measured text element at (x, y); returns null for blank text. */
  place(m: Measured, x: number, y: number, extra: { h?: number; group?: string } = {}): TextElement | null {
    const { spec } = m;
    if (!clean(spec.text) || m.h <= 0) return null;
    const box = this.norm({ x, y, w: spec.w, h: Math.min(extra.h ?? m.h, this.H - y) });
    const el: TextElement = {
      id: this.ctx.newId(),
      kind: "text",
      role: spec.role,
      ...box,
      text: spec.text,
      style: spec.style,
      color: spec.color ?? this.ink.text,
      fontSize: m.fontSize,
      align: spec.align ?? "left",
    };
    if (spec.slot) el.slot = spec.slot;
    if (spec.fill) el.fill = spec.fill;
    if (spec.weight !== undefined) el.fontWeight = spec.weight;
    if (spec.italic !== undefined) el.italic = spec.italic;
    if (spec.uppercase !== undefined) el.uppercase = spec.uppercase;
    if (spec.lineHeight !== undefined) el.lineHeight = spec.lineHeight;
    if (spec.letterSpacing !== undefined) el.letterSpacing = spec.letterSpacing;
    if (spec.list) el.list = spec.list;
    if (spec.opacity !== undefined && spec.opacity < 1) el.opacity = spec.opacity;
    if (spec.locked) el.locked = true;
    if (extra.group) el.group = extra.group;
    this.els.push(el);
    return el;
  }

  text(spec: TextSpec, x: number, y: number, extra: { group?: string } = {}): Measured {
    const m = this.measure(spec);
    this.place(m, x, y, extra);
    return m;
  }

  /** Total height of a stack (same rules as `vstack`). */
  stackHeight(blocks: StackBlock[]): number {
    const present = blocks.filter((b) => ("m" in b ? b.m.h > 0 : b.h > 0));
    return present.reduce((sum, b, i) => sum + ("m" in b ? b.m.h : b.h) + (i ? b.gap ?? 0 : 0), 0);
  }

  /** Places blocks as one vertical stack inside [top, top + height]. Returns the stack bounds. */
  vstack(x: number, top: number, height: number, blocks: StackBlock[], valign: "top" | "middle" | "bottom" = "middle", bias = 0.5) {
    const present = blocks.filter((b) => ("m" in b ? b.m.h > 0 : b.h > 0));
    const total = present.reduce((sum, b, i) => sum + ("m" in b ? b.m.h : b.h) + (i ? b.gap ?? 0 : 0), 0);
    const free = height - total;
    let y = valign === "top" ? top : valign === "bottom" ? top + free : top + free * bias;
    y = Math.max(top, y);
    const start = y;
    present.forEach((b, i) => {
      if (i) y += b.gap ?? 0;
      if ("m" in b) {
        this.place(b.m, b.x ?? x, y, { group: b.group });
        y += b.m.h;
      } else {
        b.draw(y);
        y += b.h;
      }
    });
    return { top: start, bottom: y };
  }

  mutedSpec(): Pick<TextSpec, "color" | "opacity"> {
    return { color: this.ink.muted.color, opacity: this.ink.muted.opacity };
  }

  /* ---------------- shapes ---------------- */

  shape(
    box: Box,
    spec: {
      shape?: ShapeKind;
      fill?: Paint;
      stroke?: Paint;
      strokeWidth?: number;
      radius?: number;
      role?: ElementRole;
      slot?: string;
      opacity?: number;
      shadow?: boolean;
      locked?: boolean;
      group?: string;
      deco?: boolean;
    } = {},
  ): ShapeElement {
    const el: ShapeElement = {
      id: this.ctx.newId(),
      kind: "shape",
      role: spec.deco ? "deco" : spec.role ?? "shape",
      ...this.norm(box),
      shape: spec.shape ?? "rect",
      fill: spec.fill ?? "transparent",
    };
    if (spec.slot) el.slot = spec.slot;
    if (spec.stroke) {
      el.stroke = spec.stroke;
      el.strokeWidth = spec.strokeWidth ?? Math.max(1, Math.round(1.5 * this.s));
    }
    if (spec.radius) el.radius = Math.round(spec.radius);
    if (spec.opacity !== undefined && spec.opacity < 1) el.opacity = spec.opacity;
    if (spec.shadow) el.shadow = true;
    if (spec.locked || spec.deco) el.locked = true;
    if (spec.group) el.group = spec.group;
    (spec.deco ? this.decoEls : this.els).push(el);
    return el;
  }

  /** Thin filled rectangle used as a rule/connector. */
  rule(box: Box, fill: Paint = "border", slot?: string, group?: string): ShapeElement {
    return this.shape(box, { shape: "rect", fill, role: "line", slot, group });
  }

  hairline(): number {
    return Math.max(1, Math.round(1.25 * this.s));
  }

  card(box: Box, spec: { slot?: string; tone?: CardTone; radius?: number; group?: string } = {}): ShapeElement {
    const tone = spec.tone ?? "default";
    const radius = spec.radius ?? this.radius;
    const base = { shape: (radius > 0 ? "rounded" : "rect") as ShapeKind, radius, role: "card" as ElementRole, slot: spec.slot, group: spec.group };
    switch (tone) {
      case "accent":
        return this.shape(box, { ...base, fill: "accent" });
      case "soft":
        return this.shape(box, { ...base, fill: "accentSoft" });
      case "muted":
        return this.shape(box, { ...base, fill: "surface2" });
      case "plain":
        return this.shape(box, { ...base, fill: "surface", stroke: "border" });
      default:
        switch (this.ctx.theme.cardStyle) {
          case "flat":
            return this.shape(box, { ...base, fill: "surface2" });
          case "outline":
            return this.shape(box, { ...base, fill: "surface", stroke: "border" });
          case "soft":
            return this.shape(box, { ...base, fill: "accentSoft" });
          case "shadow":
            return this.shape(box, { ...base, fill: "surface", shadow: true });
          case "glass":
            return this.shape(box, { ...base, fill: "surface", stroke: "border", opacity: 0.78, strokeWidth: 1 });
        }
    }
    return this.shape(box, { ...base, fill: "surface" });
  }

  /** Text inks for content placed on a card of the given tone. */
  cardInk(tone: CardTone = "default"): { text: Paint; muted: Ink; accent: Paint } {
    if (tone === "accent") return { text: "onAccent", muted: { color: "onAccent", opacity: 0.85 }, accent: "onAccent" };
    return { text: "text", muted: { color: "muted" }, accent: "accent" };
  }

  image(box: Box, spec: { slot?: string; radius?: number; mask?: ImageElement["mask"]; group?: string } = {}): ImageElement {
    const src = clean(this.content.image);
    const el: ImageElement = {
      id: this.ctx.newId(),
      kind: "image",
      role: "media",
      slot: spec.slot ?? "media",
      ...this.norm(box),
      src,
      fit: "cover",
      query: clean(this.content.imageQuery) || clean(this.content.title) || undefined,
    };
    if (!src) el.placeholder = true;
    if (spec.radius) el.radius = Math.round(spec.radius);
    if (spec.mask && spec.mask !== "none") el.mask = spec.mask;
    if (spec.group) el.group = spec.group;
    this.consumed.add("image");
    this.els.push(el);
    return el;
  }

  icon(box: Box, icon: string, spec: { slot?: string; color?: Paint; group?: string } = {}): IconElement {
    const el: IconElement = {
      id: this.ctx.newId(),
      kind: "icon",
      role: "icon",
      ...this.norm(box),
      icon: knownIcon(icon) ?? icon,
      color: spec.color ?? this.ink.accent,
      strokeWidth: 1.75,
    };
    if (spec.slot) el.slot = spec.slot;
    if (spec.group) el.group = spec.group;
    this.els.push(el);
    return el;
  }

  /** Label size for a badge of diameter `d`, never below the label minimum (10px at the 720 base). */
  private badgeLabelSize(d: number, label: string): number {
    const floor = Math.max(Math.round(this.style("caption").minSize), Math.ceil(TEXT_STYLES.label.minSize * this.s - 1e-6));
    return Math.max(Math.round(d * badgeRatio(label)), floor);
  }

  /** Diameter a badge with this label actually takes (grown so its label keeps the minimum size). */
  badgeDiameter(d: number, label?: string): number {
    return label ? Math.max(d, this.badgeLabelSize(d, label) / badgeRatio(label)) : d;
  }

  /** Round badge centered at (cx, cy) with a short label or an icon. */
  badge(
    cx: number,
    cy: number,
    size: number,
    spec: { slot: string; label?: string; icon?: string; tone?: "accent" | "soft" | "outline" | "surface"; group?: string },
  ) {
    const tone = spec.tone ?? "accent";
    const d = spec.icon ? size : this.badgeDiameter(size, spec.label);
    const box = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
    const fill: Paint = tone === "accent" ? "accent" : tone === "soft" ? "accentSoft" : tone === "surface" ? "surface" : "transparent";
    const ink: Paint = tone === "accent" ? "onAccent" : this.accentSmallOn(fill);
    this.shape(box, {
      shape: "circle",
      fill,
      stroke: tone === "outline" ? "accent" : undefined,
      slot: `${spec.slot}-badge`,
      group: spec.group,
    });
    if (spec.icon) {
      const inset = d * 0.25;
      this.icon({ x: box.x + inset, y: box.y + inset, w: d - inset * 2, h: d - inset * 2 }, spec.icon, {
        slot: `${spec.slot}-icon`,
        color: ink,
        group: spec.group,
      });
    } else if (spec.label) {
      const m = this.measure({
        text: spec.label,
        style: "subheading",
        role: "number",
        slot: `${spec.slot}-number`,
        w: d,
        size: this.badgeLabelSize(d, spec.label),
        weight: 600,
        lineHeight: 1.15,
        align: "center",
        color: ink,
      });
      this.place(m, box.x, cy - m.h / 2, { group: spec.group });
    }
  }

  /* ---------------- composites ---------------- */

  /** Kicker, title, subtitle (and optionally the body as a lead). Returns the bottom y. */
  header(
    area: Box,
    opts: {
      align?: "left" | "center";
      titleStyle?: TextStyleToken;
      titleMaxH?: number;
      titleMaxSize?: number;
      lead?: boolean;
      leadMaxH?: number;
    } = {},
  ): number {
    const c = this.content;
    const align = opts.align ?? "left";
    let y = area.y;
    if (clean(c.kicker)) {
      const m = this.text({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w: area.w, maxH: area.h * 0.12, align, color: this.ink.accentSmall }, area.x, y);
      y += m.h + this.u * 1.5;
    }
    const title = this.text(
      {
        text: clean(c.title),
        style: opts.titleStyle ?? "title",
        role: "title",
        slot: "title",
        w: area.w,
        maxH: opts.titleMaxH ?? area.h * 0.34,
        maxSize: opts.titleMaxSize,
        align,
      },
      area.x,
      y,
    );
    y += title.h;
    if (clean(c.subtitle)) {
      y += this.u * 1.5;
      const m = this.text({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w: area.w, maxH: area.h * 0.2, align, ...this.mutedSpec() }, area.x, y);
      y += m.h;
    }
    if (opts.lead && clean(c.body)) {
      y += this.u * 2;
      y = this.paragraph({ x: area.x, y, w: area.w, h: opts.leadMaxH ?? area.h * 0.28 }, { align, muted: true });
    }
    this.use("title", "kicker", "subtitle");
    return y;
  }

  /** Kicker / title / subtitle (/ body) as stack blocks for vertically centered columns. */
  headerBlocks(
    w: number,
    opts: {
      align?: "left" | "center";
      titleStyle?: TextStyleToken;
      titleMaxH: number;
      titleMaxSize?: number;
      body?: boolean;
      bodyMaxH?: number;
      bodyStyle?: TextStyleToken;
      ink?: { text: Paint; muted: Ink; accent: Paint };
    },
  ): StackBlock[] {
    const c = this.content;
    const align = opts.align ?? "left";
    const ink = opts.ink ?? { text: this.ink.text, muted: this.ink.muted, accent: this.ink.accent };
    const blocks: StackBlock[] = [];
    if (clean(c.kicker)) {
      blocks.push({ m: this.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, align, color: opts.ink ? ink.accent : this.ink.accentSmall }) });
    }
    blocks.push({
      m: this.measure({ text: clean(c.title), style: opts.titleStyle ?? "title", role: "title", slot: "title", w, maxH: opts.titleMaxH, maxSize: opts.titleMaxSize, align, color: ink.text }),
      gap: this.u * 1.5,
    });
    if (clean(c.subtitle)) {
      blocks.push({
        m: this.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: this.safe.h * 0.2, align, color: ink.muted.color, opacity: ink.muted.opacity }),
        gap: this.u * 1.5,
      });
    }
    if (opts.body && clean(c.body)) {
      blocks.push({ m: this.bodyBlock(w, opts.bodyMaxH ?? this.safe.h * 0.3, { style: opts.bodyStyle ?? "body", align, ink: ink.muted }), gap: this.u * 2.5 });
    }
    this.use("title", "kicker", "subtitle");
    return blocks;
  }

  /** Fitted part of the body (or given text) as a stack block; a body remainder continues. */
  bodyBlock(
    w: number,
    maxH: number,
    opts: { style?: TextStyleToken; align?: TextElement["align"]; muted?: boolean; ink?: Ink; text?: string; slot?: string; fixed?: boolean } = {},
  ): Measured {
    const slot = opts.slot ?? "body";
    const text = clean(opts.text ?? this.content.body);
    const token = opts.style ?? "body";
    const ink = opts.ink ?? (opts.muted ? this.ink.muted : { color: this.ink.text });
    const spec: TextSpec = { text: "", style: token, role: "body", slot, w, align: opts.align, color: ink.color, opacity: ink.opacity };
    if (!text) return this.measure(spec);
    const style = this.style(token);
    const fitStyle = opts.fixed ? { ...style, minSize: style.fontSize } : style;
    const split = splitTextToFit(text, fitStyle, w, Math.max(maxH, style.minSize * style.lineHeight), this.ctx.measure);
    if (slot === "body" && opts.text === undefined) {
      this.use("body");
      if (split.rest) this.continueWith({ body: split.rest });
    }
    return this.measure({ ...spec, text: split.fit, size: split.fontSize });
  }

  /** Body paragraph fitted into an area; the remainder continues on the next page. Returns the bottom y. */
  paragraph(
    area: Box,
    opts: { style?: TextStyleToken; align?: TextElement["align"]; muted?: boolean; ink?: Ink; text?: string; slot?: string; fixed?: boolean } = {},
  ): number {
    const m = this.bodyBlock(area.w, area.h, opts);
    this.place(m, area.x, area.y);
    return area.y + m.h;
  }

  /** List metrics at base sizes times `boost` (growth for sparse lists). */
  private listMetrics(area: Box, entries: Entry[], opts: ListOptions, boost = 1) {
    const marker = opts.marker ?? "dot";
    const rich = entries.some((e) => e.body);
    const leadToken = rich ? opts.titleStyle ?? "subheading" : opts.style ?? "body";
    const bodyToken = opts.bodyStyle ?? "small";
    const lead = boosted(this.style(leadToken), boost);
    const body = boosted(this.style(bodyToken), boost);
    const gapEm = opts.gapEm ?? (rich ? 1 : 0.65);
    const markerW =
      marker === "none" ? 0 : Math.round(lead.fontSize * (marker === "number" || marker === "letter" ? 2.2 : marker === "check" ? 1.9 : 1.3));
    const textW = Math.max(this.u * 6, area.w - markerW);
    const maxScale = boost > 1 ? 1 : Math.min(1, opts.maxScale ?? 1);
    const minScale = opts.fixed
      ? maxScale
      : Math.min(maxScale, Math.max(lead.minSize / lead.fontSize, rich ? body.minSize / body.fontSize : 0));
    const sizes = (scale: number) => ({
      lead: Math.max(lead.minSize, Math.round(lead.fontSize * scale)),
      body: Math.max(body.minSize, Math.round(body.fontSize * scale)),
    });
    const titleWeight = rich ? 600 : undefined;
    const entryH = (e: Entry, scale: number) => {
      const s = sizes(scale);
      let h = this.textHeight(e.title, leadToken, textW, s.lead, titleWeight);
      if (e.body) h += (e.title ? s.body * 0.35 : 0) + this.textHeight(e.body, bodyToken, textW, s.body);
      return h;
    };
    const heightAt = (list: Entry[], scale: number) =>
      list.reduce((sum, e) => sum + entryH(e, scale), 0) + Math.max(0, list.length - 1) * gapEm * sizes(scale).lead;
    return { marker, rich, leadToken, bodyToken, lead, body, gapEm, markerW, textW, maxScale, minScale, sizes, titleWeight, entryH, heightAt };
  }

  /**
   * Entries a slide list may show at once and the ones held back for the next page. Long lists
   * are spread evenly (14 → 7 + 7) instead of being shrunk into one dense page.
   */
  private densityCap(entries: Entry[], opts: ListOptions, rich: boolean): [Entry[], Entry[]] {
    const kind = deckKindOf(this.ctx);
    const document = opts.fixed || kind === "doc" || kind === "worksheet";
    const cap = opts.maxEntries ?? (document ? Infinity : rich ? SLIDE_MAX_RICH_ENTRIES : SLIDE_MAX_ENTRIES);
    if (entries.length <= cap) return [entries, []];
    const per = Math.ceil(entries.length / Math.ceil(entries.length / Math.max(1, cap)));
    return [entries.slice(0, per), entries.slice(per)];
  }

  /**
   * Metrics for the entries a list shows on this page: grown for a sparse primary list
   * (capped by an explicit `maxScale`), otherwise at base sizes.
   */
  private listPlan(area: Box, entries: Entry[], opts: ListOptions) {
    const base = this.listMetrics(area, entries, opts);
    const [head, held] = this.densityCap(entries, opts, base.rich);
    const grow = opts.grow ?? (!opts.fixed && opts.style !== "small" && opts.style !== "caption");
    const limit = Math.min(this.growLimit(), opts.maxScale ?? Infinity);
    const boost = grow && head.length ? this.growScale((b) => this.listMetrics(area, head, opts, b).heightAt(head, 1), area.h, limit) : 1;
    return { m: boost > 1 ? this.listMetrics(area, entries, opts, boost) : base, boost, head, held };
  }

  /** Type scale (relative to the base sizes) at which a list would fit an area (dry run, places nothing). */
  listScale(area: Box, entries: Entry[], opts: ListOptions = {}): number {
    if (!entries.length) return 1;
    const { m, boost, head } = this.listPlan(area, entries, opts);
    const split = splitToFit(head, (list, sc) => m.heightAt(list, sc * m.maxScale), area.h, m.minScale / m.maxScale, 0.04);
    return boost * split.scale * m.maxScale;
  }

  /** Vertical list with markers. Entries with bodies render as title + body. */
  list(
    area: Box,
    source: ListSource,
    opts: ListOptions = {},
  ): { bottom: number; shown: number; rest: Entry[]; fontSize: number; markers: { cx: number; cy: number; d: number }[] } {
    const { m, head, held } = this.listPlan(area, source.entries, opts);
    const split = splitToFit(head, (list, sc) => m.heightAt(list, sc * m.maxScale), area.h, m.minScale / m.maxScale, 0.04, !opts.fixed);
    const scale = split.scale * m.maxScale;
    let fit = split.fit;
    let rest = [...split.rest, ...held];
    const sz = m.sizes(scale);
    if (fit.length === 1 && m.entryH(fit[0], scale) > area.h + 0.5) {
      const e = fit[0];
      if (e.body) {
        const titleH = this.textHeight(e.title, m.leadToken, m.textW, sz.lead, m.titleWeight) + sz.body * 0.35;
        const part = splitTextToFit(e.body, { ...m.body, fontSize: sz.body, minSize: sz.body }, m.textW, Math.max(sz.body * 2, area.h - titleH), this.ctx.measure);
        fit = [{ ...e, body: part.fit }];
        if (part.rest) rest = [{ ...e, body: part.rest }, ...rest];
      } else {
        const part = splitTextToFit(e.title, { ...m.lead, fontSize: sz.lead, minSize: sz.lead }, m.textW, area.h, this.ctx.measure);
        fit = [{ ...e, title: part.fit }];
        if (part.rest) rest = [{ ...e, title: part.rest }, ...rest];
      }
    }
    const ink = opts.ink ?? { color: this.ink.text };
    const start = this.content.listStart ?? 0;
    const markers: { cx: number; cy: number; d: number }[] = [];
    let y = area.y;
    fit.forEach((e, i) => {
      const group = this.ctx.newId();
      const lineH = sz.lead * m.lead.lineHeight;
      if (m.marker !== "none") markers.push(this.marker(m.marker, area.x, y, lineH, sz.lead, e, start + e.index, group, ink));
      const t = this.measure({
        text: e.title,
        style: m.leadToken,
        role: m.rich ? "item-title" : "bullet",
        slot: e.slotTitle,
        w: m.textW,
        size: sz.lead,
        weight: m.titleWeight,
        color: ink.color,
        opacity: ink.opacity,
        align: opts.align,
      });
      this.place(t, area.x + m.markerW, y, { group });
      y += t.h;
      if (e.body) {
        if (t.h) y += sz.body * 0.35;
        const b = this.measure({
          text: e.body,
          style: m.bodyToken,
          role: "item-body",
          slot: e.slotBody,
          w: m.textW,
          size: sz.body,
          align: opts.align,
          ...(opts.ink ? { color: opts.ink.color, opacity: (opts.ink.opacity ?? 1) * 0.85 } : this.mutedSpec()),
        });
        this.place(b, area.x + m.markerW, y, { group });
        y += b.h;
      }
      if (i < fit.length - 1) y += m.gapEm * sz.lead;
    });
    if (opts.onRest) {
      if (rest.length) opts.onRest(rest);
    } else {
      this.use(source.field);
      this.continueList(source.field, rest);
    }
    return { bottom: y, shown: fit.length, rest, fontSize: sz.lead, markers };
  }

  private marker(kind: Marker, x: number, y: number, lineH: number, size: number, e: Entry, n: number, group: string, ink: Ink) {
    const cy = y + lineH / 2;
    const slot = `${e.key}-marker`;
    const tint: Paint = ink.color === this.ink.text ? this.ink.accent : ink.color;
    if (kind === "dash") {
      const w = size * 0.7;
      const h = Math.max(2, size * 0.1);
      this.rule({ x, y: cy - h / 2, w, h }, tint, slot, group);
      return { cx: x + w / 2, cy, d: w };
    }
    if (kind === "check") {
      const d = size * 1.25;
      this.icon({ x, y: cy - d / 2, w: d, h: d }, "circle-check", { slot, color: tint, group });
      return { cx: x + d / 2, cy, d };
    }
    if (kind === "number" || kind === "letter") {
      const label = kind === "letter" ? String.fromCharCode(65 + (n % 26)) : String(n + 1);
      const d = this.badgeDiameter(size * 1.5, label);
      this.badge(x + d / 2, cy, d, { slot: e.key, label, tone: ink.color === this.ink.text ? "soft" : "surface", group });
      return { cx: x + d / 2, cy, d };
    }
    const d = Math.max(4, size * 0.34);
    this.shape({ x: x + d * 0.2, y: cy - d / 2, w: d, h: d }, { shape: "circle", fill: tint, slot, group });
    return { cx: x + d * 0.7, cy, d };
  }

  /** Grid geometry and type scale for showing `shown` as cards; `scale` is undefined when they cannot all fit. */
  private cardGrid(area: Box, shown: Entry[], opts: CardOptions) {
    const cols = Math.max(1, Math.min(opts.cols, shown.length || 1));
    const rowsCount = Math.max(1, Math.ceil(shown.length / cols));
    const gapX = opts.gapX ?? this.gutter;
    const gapY = opts.gapY ?? this.gutter;
    const cardW = (area.w - gapX * (cols - 1)) / cols;
    const maxCardH = (area.h - gapY * (rowsCount - 1)) / rowsCount;
    const pad = opts.bare ? 0 : Math.round(Math.min(this.pad, cardW * 0.1));
    const badge = opts.badge ?? "number";
    const horizontal = Boolean(opts.horizontal);
    const badgeAt = (scale: number) => Math.round((horizontal ? 44 : 40) * this.s * Math.min(1.3, Math.max(1, scale)));
    const wide = cardW >= 420 * this.s;
    const titleToken = opts.titleStyle ?? (wide ? "heading" : "subheading");
    const bodyToken = opts.bodyStyle ?? (wide ? "body" : "small");
    const titleStyle = this.style(titleToken);
    const bodyStyle = this.style(bodyToken);
    const hasBadge = badge !== "none";
    const innerWAt = (scale: number) => (horizontal && hasBadge ? cardW - pad * 2 - this.u * 2 - badgeAt(scale) : cardW - pad * 2);
    const titleWeight = opts.plainTitles ? undefined : 600;
    const minScale = Math.max(titleStyle.minSize / titleStyle.fontSize, bodyStyle.minSize / bodyStyle.fontSize);
    const sizes = (scale: number) => ({
      title: Math.max(titleStyle.minSize, Math.round(titleStyle.fontSize * scale)),
      body: Math.max(bodyStyle.minSize, Math.round(bodyStyle.fontSize * scale)),
    });
    const contentH = (e: Entry, scale: number) => {
      const s = sizes(scale);
      const w = innerWAt(scale);
      const th = this.textHeight(e.title, titleToken, w, s.title, titleWeight);
      const bh = e.body ? this.textHeight(e.body, bodyToken, w, s.body) : 0;
      return th + (th && bh ? s.body * 0.5 : 0) + bh;
    };
    const topAt = (scale: number) => (hasBadge && !horizontal ? badgeAt(scale) + this.u * 2 : 0);
    const cardH = (e: Entry, scale: number) =>
      pad * 2 + Math.max(topAt(scale) + contentH(e, scale), horizontal && hasBadge ? badgeAt(scale) : 0);
    const naturalAt = (list: Entry[], scale: number) => Math.max(...list.map((e) => cardH(e, scale)));
    const grid = { cols, rowsCount, gapX, gapY, cardW, maxCardH, pad, badge, horizontal, badgeAt, titleToken, bodyToken, titleStyle, bodyStyle, hasBadge, innerWAt, titleWeight, minScale, sizes, contentH, topAt, naturalAt };
    if (!shown.length) return { ...grid, scale: undefined };
    const boost = opts.grow === false ? 1 : this.growScale((b) => naturalAt(shown, b), maxCardH);
    const scales: number[] = [];
    for (let s = 1; s > minScale + 1e-6; s -= 0.05) scales.push(Math.round(s * 1000) / 1000);
    scales.push(minScale);
    let scale = boost > 1 ? boost : scales.find((sc) => shown.every((e) => cardH(e, sc) <= maxCardH + 0.5));
    const wholeWords = (sc: number) => {
      const s = sizes(sc);
      const w = innerWAt(sc);
      return shown.every(
        (e) => this.wordsFit(e.title, titleToken, w, s.title, titleWeight) && (!e.body || this.wordsFit(e.body, bodyToken, w, s.body)),
      );
    };
    if (scale !== undefined && !wholeWords(scale)) {
      const from = scale;
      const lower: number[] = [];
      for (let b = Math.round((from - 0.05) * 100) / 100; b > 1.001; b = Math.round((b - 0.05) * 100) / 100) lower.push(b);
      scale = [...lower, ...scales].find((sc) => sc < from && wholeWords(sc)) ?? minScale;
    }
    return { ...grid, scale };
  }

  /** Cuts one entry too long for a lone card: its body (or its title) up to what fits; the rest continues. */
  private splitCardEntry(e: Entry, grid: ReturnType<LayoutKit["cardGrid"]>): { fit: Entry; rest?: Entry } {
    const scale = grid.minScale;
    const sz = grid.sizes(scale);
    const w = grid.innerWAt(scale);
    const avail = grid.maxCardH - grid.pad * 2 - grid.topAt(scale);
    const th = this.textHeight(e.title, grid.titleToken, w, sz.title, grid.titleWeight);
    if (th > avail + 0.5) {
      const titleStyle = { ...grid.titleStyle, fontSize: sz.title, minSize: sz.title, ...(grid.titleWeight ? { fontWeight: grid.titleWeight } : {}) };
      const part = splitTextToFit(e.title, titleStyle, w, Math.max(0, avail), this.ctx.measure);
      const fit: Entry = { ...e, title: part.fit, body: undefined };
      return part.rest || e.body ? { fit, rest: { ...e, title: part.rest || e.title } } : { fit };
    }
    if (!e.body) return { fit: e };
    const room = avail - th - (th ? sz.body * 0.5 : 0);
    if (room < sz.body * grid.bodyStyle.lineHeight) return { fit: { ...e, body: undefined }, rest: e };
    const part = splitTextToFit(e.body, { ...grid.bodyStyle, fontSize: sz.body, minSize: sz.body }, w, room, this.ctx.measure);
    return { fit: { ...e, body: part.fit }, rest: part.rest ? { ...e, body: part.rest } : undefined };
  }

  /** Fill token of a card of this tone (what `card()` draws), for keeping badges visible on it. */
  private cardFill(tone: CardTone): Paint {
    if (tone === "accent") return "accent";
    const style = this.ctx.theme.cardStyle;
    if (tone === "soft" || (tone === "default" && style === "soft")) return "accentSoft";
    if (tone === "muted" || (tone === "default" && style === "flat")) return "surface2";
    return "surface";
  }

  /**
   * Entry cards in a grid. Cards share one type scale. Entries beyond capacity, or beyond what
   * fits whole, continue on the next page; only a single entry too long for a card is cut.
   * Returns the remaining entries.
   */
  cards(area: Box, entries: Entry[], opts: CardOptions): { rest: Entry[]; bottom: number; boxes: Box[]; badge: number; pad: number } {
    const capacity = Math.min(entries.length, opts.capacity ?? entries.length);
    let shown = entries.slice(0, capacity);
    let rest = entries.slice(capacity);
    let grid = this.cardGrid(area, shown, opts);
    if (!shown.length) return { rest, bottom: area.y, boxes: [], badge: grid.badgeAt(1), pad: grid.pad };
    let scale = grid.scale;
    if (scale === undefined) {
      for (let n = shown.length - 1; n >= 1; n -= 1) {
        const fewer = this.cardGrid(area, shown.slice(0, n), opts);
        if (fewer.scale === undefined) continue;
        rest = [...shown.slice(n), ...rest];
        shown = shown.slice(0, n);
        grid = fewer;
        scale = fewer.scale;
        break;
      }
    }
    if (scale === undefined) {
      const [one, ...others] = shown;
      if (others.length) grid = this.cardGrid(area, [one], opts);
      const split = this.splitCardEntry(one, grid);
      shown = [split.fit];
      rest = [...(split.rest ? [split.rest] : []), ...others, ...rest];
      scale = grid.minScale;
    }
    const { cols, rowsCount, gapX, gapY, cardW, maxCardH, pad, badge, horizontal, hasBadge, titleToken, bodyToken, titleWeight } = grid;
    const sz = grid.sizes(scale);
    const d = grid.badgeAt(scale);
    const innerW = grid.innerWAt(scale);
    const h = Math.min(maxCardH, Math.max(grid.naturalAt(shown, scale), maxCardH * (opts.fill ?? 0.7)));
    const gridH = h * rowsCount + gapY * (rowsCount - 1);
    const gridTop = opts.valign === "middle" ? area.y + Math.max(0, area.h - gridH) * MIDDLE_BIAS : area.y;
    const startIndex = opts.startIndex ?? this.content.listStart ?? 0;
    const iconOf = (e: Entry) => knownIcon(e.icon) ?? knownIcon(this.content.icon);
    const iconGrid = badge === "icon" && shown.some((e) => iconOf(e));
    const theme = this.ctx.theme;
    const boxes: Box[] = [];
    shown.forEach((e, i) => {
      const box = {
        x: area.x + (i % cols) * (cardW + gapX),
        y: gridTop + Math.floor(i / cols) * (h + gapY),
        w: cardW,
        h,
      };
      boxes.push(box);
      const tone = typeof opts.tone === "function" ? opts.tone(i) : opts.tone ?? "default";
      const ink = opts.bare ? { text: this.ink.text, muted: this.ink.muted, accent: this.ink.accent } : this.cardInk(tone);
      const group = this.ctx.newId();
      if (!opts.bare) this.card(box, { slot: `${e.key}-card`, tone, group });
      let tx = box.x + pad;
      let ty = box.y + pad;
      const n = startIndex + e.index;
      if (hasBadge) {
        const icon = iconGrid ? iconOf(e) ?? DEFAULT_BADGE_ICON : undefined;
        const label = opts.badgeLabel
          ? opts.badgeLabel(e, n)
          : badge === "letter"
            ? String.fromCharCode(65 + (n % 26))
            : String(n + 1).padStart(2, "0");
        let badgeTone = opts.badgeTone ?? (tone === "accent" ? "surface" : "soft");
        if (!opts.bare && resolveThemePaint(BADGE_FILL[badgeTone], theme) === resolveThemePaint(this.cardFill(tone), theme)) {
          badgeTone = tone === "accent" ? "surface" : "accent";
        }
        if (horizontal) {
          this.badge(box.x + pad + d / 2, box.y + Math.max(pad + d / 2, box.h / 2), d, { slot: e.key, label: icon ? undefined : label, icon, tone: badgeTone, group });
          tx = box.x + pad + d + this.u * 2;
        } else {
          const cx = opts.align === "center" ? box.x + box.w / 2 : box.x + pad + d / 2;
          this.badge(cx, box.y + pad + d / 2, d, { slot: e.key, label: icon ? undefined : label, icon, tone: badgeTone, group });
          ty += d + this.u * 2;
        }
      }
      if (horizontal) ty = box.y + Math.max(pad, (box.h - grid.contentH(e, scale)) / 2);
      const t = this.measure({
        text: e.title,
        style: titleToken,
        role: "item-title",
        slot: e.slotTitle,
        w: innerW,
        size: sz.title,
        weight: titleWeight,
        align: opts.align,
        color: opts.accentTitles && tone !== "accent" ? ink.accent : ink.text,
      });
      this.place(t, tx, ty, { group });
      ty += t.h;
      if (e.body) {
        if (t.h) ty += sz.body * 0.5;
        const b = this.measure({ text: e.body, style: bodyToken, role: "item-body", slot: e.slotBody, w: innerW, size: sz.body, align: opts.align, color: ink.muted.color, opacity: ink.muted.opacity });
        this.place(b, tx, ty, { group });
      }
    });
    return { rest, bottom: gridTop + gridH, boxes, badge: d, pad };
  }

  /** Moves an element (added last) behind everything added since `mark`. */
  sendBehind(el: SceneElement, mark: number) {
    const index = this.els.lastIndexOf(el);
    if (index < 0) return;
    this.els.splice(index, 1);
    this.els.splice(Math.min(mark, this.els.length), 0, el);
  }

  /** Current element count, for `sendBehind`. */
  mark(): number {
    return this.els.length;
  }

  /* ---------------- decoration ---------------- */

  decorate(mode: "hero" | "content" = "content") {
    const { W, H } = this;
    const m = Math.min(W, H);
    const deco = (box: Box, spec: Parameters<LayoutKit["shape"]>[1], slot: string) =>
      this.shape(box, { ...spec, deco: true, slot });
    const mx = this.safe.x;
    const my = this.safe.y;
    switch (this.ctx.theme.decor) {
      case "blobs": {
        const big = m * (mode === "hero" ? 0.46 : 0.2);
        deco({ x: W - big, y: 0, w: big, h: big }, { shape: "blob", fill: "accentSoft", opacity: mode === "hero" ? 0.9 : 0.7 }, "deco-blob-0");
        if (mode === "hero") {
          const small = m * 0.26;
          deco({ x: 0, y: H - small, w: small, h: small }, { shape: "blob", fill: "accent", opacity: 0.14 }, "deco-blob-1");
        }
        break;
      }
      case "lines": {
        const t = Math.max(1, Math.round(1.25 * this.s));
        const y = H - my / 2;
        deco({ x: mx, y, w: W - mx * 2, h: t }, { fill: "border" }, "deco-line-0");
        deco({ x: mx, y: y - t, w: Math.min(W * 0.12, 120 * this.s), h: t * 3 }, { fill: "accent" }, "deco-line-1");
        break;
      }
      case "dots": {
        const cols = mode === "hero" ? 5 : 3;
        const rows = mode === "hero" ? 4 : 3;
        const d = Math.max(3, m * 0.009);
        const step = m * 0.028;
        const x0 = W - mx / 2 - (cols - 1) * step - d;
        const y0 = H - my / 2 - (rows - 1) * step - d;
        const group = this.ctx.newId();
        for (let r = 0; r < rows; r += 1)
          for (let c = 0; c < cols; c += 1)
            deco({ x: x0 + c * step, y: y0 + r * step, w: d, h: d }, { shape: "circle", fill: "accent", opacity: 0.4, group }, `deco-dot-${r}-${c}`);
        break;
      }
      case "frame": {
        const ix = mx / 2;
        const iy = my / 2;
        deco(
          { x: ix, y: iy, w: W - ix * 2, h: H - iy * 2 },
          { shape: this.radius ? "rounded" : "rect", radius: this.radius * 0.6, stroke: mode === "hero" ? "accent" : "border", strokeWidth: Math.max(1, Math.round(1.5 * this.s)), opacity: mode === "hero" ? 0.6 : 1 },
          "deco-frame",
        );
        break;
      }
      case "corner": {
        const len = m * (mode === "hero" ? 0.2 : 0.12);
        const t = Math.max(3, Math.round(6 * this.s));
        deco({ x: 0, y: 0, w: len, h: t }, { fill: "accent" }, "deco-corner-0");
        deco({ x: 0, y: 0, w: t, h: len }, { fill: "accent" }, "deco-corner-1");
        if (mode === "hero") {
          deco({ x: W - len, y: H - t, w: len, h: t }, { fill: "accent" }, "deco-corner-2");
          deco({ x: W - t, y: H - len, w: t, h: len }, { fill: "accent" }, "deco-corner-3");
        }
        break;
      }
      case "waves": {
        if (mode !== "hero") break;
        deco({ x: 0, y: H * 0.8, w: W * 0.58, h: H * 0.2 }, { shape: "ellipse", fill: "accentSoft", opacity: 0.8 }, "deco-wave-0");
        deco({ x: W * 0.36, y: H * 0.86, w: W * 0.64, h: H * 0.14 }, { shape: "ellipse", fill: "accent", opacity: 0.12 }, "deco-wave-1");
        break;
      }
      default:
        break;
    }
  }

  /* ---------------- bookkeeping ---------------- */

  use(...fields: ContentField[]) {
    for (const field of fields) this.consumed.add(field);
  }

  continueWith(patch: Partial<EngineContent>) {
    Object.assign(this.patch, patch);
    this.continues = true;
  }

  continueList(field: ListField, rest: Entry[]) {
    if (!rest.length) return;
    this.continueWith({ ...entriesToField(field, rest), listStart: (this.content.listStart ?? 0) + rest[0].index });
  }

  done(background: Background = this.background): BuildResult {
    const leftovers: Partial<SlideContent> = {};
    for (const field of LEFTOVER_FIELDS) {
      if (this.consumed.has(field) || !hasValue(this.content, field)) continue;
      Object.assign(leftovers, { [field]: this.content[field] });
    }
    const elements = [...this.decoEls, ...this.els];
    if (!this.continues && Object.keys(leftovers).length === 0) return { elements, background };
    const c = this.content;
    const overflow: EngineContent = { kind: c.kind, title: c.title, continued: true };
    if (c.kicker) overflow.kicker = c.kicker;
    if (c.imageQuery) overflow.imageQuery = c.imageQuery;
    if (c.image) overflow.image = c.image;
    if (c.icon) overflow.icon = c.icon;
    Object.assign(overflow, leftovers, this.patch);
    return { elements, background, overflow };
  }
}

export function createKit(content: SlideContent, ctx: LayoutContext, surface: Surface = "content"): LayoutKit {
  return new LayoutKit(content as EngineContent, ctx, surface);
}

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
