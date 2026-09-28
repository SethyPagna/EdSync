/**
 * Auto-layout: turns semantic `SlideContent` into editable scene pages.
 * Pure and deterministic (same input + seed → same deck); no DOM access.
 */
import { findDeckTheme, getDeckTheme, getFontPair, getFormat, type TemplateDef } from "@/lib/studio/library";
import { LAYOUTS, getLayout } from "./layouts";
import { FALLBACK_LAYOUT_ID, FLOW_LAYOUT_ID } from "./layouts/ids";
import { deckKindOf, clean as str, hashString, seededRandom, type EngineContent, type EngineContext } from "./layouts/kit";
import { refitTextElement } from "./fit";
import { createApproxMeasurer } from "./measure";
import type {
  Background,
  ContentItem,
  DeckKind,
  DeckTheme,
  FontPair,
  LayoutContext,
  LayoutDef,
  SceneDeck,
  SceneElement,
  ScenePage,
  SlideContent,
  TextMeasurer,
} from "./scene";
import { isGeneratedBackground, themedBackground } from "./theme-apply";

/** Hard cap on pages produced from one content (a runaway guard; normal content never gets close). */
const MAX_CONTINUATIONS = 40;

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

/** Deterministic id factory: `${prefix}-${seed36}-${n36}`. */
export function createIdFactory(prefix = "el", seed = 0): () => string {
  let n = 0;
  const base = (seed >>> 0).toString(36);
  return () => `${prefix}-${base}-${(n++).toString(36)}`;
}

export interface LayoutContextOptions {
  width: number;
  height: number;
  theme: DeckTheme;
  fontPair: FontPair;
  measure?: TextMeasurer;
  seed?: number;
  recent?: readonly string[];
  newId?: () => string;
  /** Deck kind; boosts document/worksheet/social layouts for matching decks. */
  deckKind?: DeckKind;
}

let contextCount = 0;

/**
 * Layout context with defaults (approximate measurer, seed 0). Without `newId`, ids come from
 * a per-context factory (`el<n>-…`); pass a globally unique generator when editing a live deck.
 */
export function createLayoutContext(opts: LayoutContextOptions): EngineContext {
  const seed = opts.seed ?? 0;
  const prefix = `el${(contextCount++).toString(36)}`;
  return {
    width: opts.width,
    height: opts.height,
    theme: opts.theme,
    fontPair: opts.fontPair,
    measure: opts.measure ?? createApproxMeasurer(),
    seed,
    recent: [...(opts.recent ?? [])],
    newId: opts.newId ?? createIdFactory(prefix, seed),
    deckKind: opts.deckKind,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface LayoutCandidate {
  id: string;
  name: string;
  score: number;
  layout: LayoutDef;
}

function scoreOf(layout: LayoutDef, content: SlideContent, ctx: LayoutContext): number {
  try {
    const score = layout.score(content, ctx);
    return Number.isFinite(score) && score > 0 ? score : 0;
  } catch {
    return 0;
  }
}

/** Layouts that suit the content, best first (ties keep registry order). */
export function candidateLayouts(content: SlideContent, ctx: LayoutContext): LayoutCandidate[] {
  return LAYOUTS.map((layout, order) => ({ layout, order, score: scoreOf(layout, content, ctx) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ layout, score }) => ({ id: layout.id, name: layout.name, score, layout }));
}

/* ------------------------------------------------------------------ */
/* Content helpers                                                     */
/* ------------------------------------------------------------------ */

/** Amount of content a page still has to show (title/kicker/media excluded). Used to guarantee progress. */
export function contentWeight(content: SlideContent): number {
  const sum = (values: readonly unknown[] | undefined) => (values ?? []).reduce<number>((n, v) => n + str(v).length + (str(v) ? 1 : 0), 0);
  let weight = str(content.subtitle).length + str(content.body).length + str(content.quote?.text).length + str(content.question?.prompt).length;
  weight += sum(content.bullets) + sum(content.steps) + sum(content.question?.choices);
  weight += (content.items ?? []).reduce((n, i) => n + str(i?.title).length + str(i?.body).length + 1, 0);
  weight += (content.terms ?? []).reduce((n, t) => n + str(t?.term).length + str(t?.definition).length + 1, 0);
  weight += (content.stats ?? []).reduce((n, s) => n + str(s?.value).length + str(s?.label).length + 1, 0);
  if (content.compare) {
    weight += str(content.compare.a?.label).length + str(content.compare.b?.label).length;
    weight += sum(content.compare.a?.points) + sum(content.compare.b?.points);
  }
  return weight;
}

type SlotTexts = Map<string, string>;

function slotTexts(elements: readonly SceneElement[]): SlotTexts {
  const texts: SlotTexts = new Map();
  for (const el of elements) {
    if (el.kind !== "text" || !el.slot || el.role === "deco") continue;
    const text = el.text.trim();
    if (!text) continue;
    const prev = texts.get(el.slot);
    texts.set(el.slot, prev ? `${prev} ${text}` : text);
  }
  return texts;
}

function indexed(texts: SlotTexts, pattern: RegExp): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  for (const [slot, text] of texts) {
    const match = pattern.exec(slot);
    if (!match) continue;
    const index = Number(match[1]);
    const part = match[2] ?? "";
    const row = out.get(index) ?? {};
    row[part] = row[part] ? `${row[part]}\n${text}` : text;
    out.set(index, row);
  }
  return new Map([...out.entries()].sort((a, b) => a[0] - b[0]));
}

const joinLabel = (row: Record<string, string>, main: string, extra: string) =>
  row[main] && row[extra] ? `${row[main]}: ${row[extra]}` : row[main] || row[extra] || "";

/**
 * Rebuilds the content a page shows from its element slots (current text wins), keeping
 * non-text data (kind, media, answers, icons) from `base`.
 */
export function contentFromElements(elements: readonly SceneElement[], base: SlideContent): SlideContent {
  const texts = slotTexts(elements);
  const b = base as EngineContent;
  const out: EngineContent = { kind: base.kind, title: texts.get("title") ?? base.title };
  const kicker = texts.get("kicker") ?? str(base.kicker);
  if (kicker) out.kicker = kicker;
  if (texts.has("subtitle")) out.subtitle = texts.get("subtitle");
  if (texts.has("body")) out.body = texts.get("body");
  if (base.imageQuery) out.imageQuery = base.imageQuery;
  if (base.image) out.image = base.image;
  if (base.icon) out.icon = base.icon;
  if (base.notes) out.notes = base.notes;
  if (base.continued) out.continued = true;
  if (b.listStart !== undefined) out.listStart = b.listStart;

  const bullets = [...indexed(texts, /^bullet-(\d+)(?:-(body))?$/).values()].map((r) => joinLabel(r, "", "body")).filter(Boolean);
  if (bullets.length) out.bullets = bullets;
  const steps = [...indexed(texts, /^step-(\d+)(?:-(body))?$/).values()].map((r) => joinLabel(r, "", "body")).filter(Boolean);
  if (steps.length) out.steps = steps;

  const itemRows = indexed(texts, /^item-(\d+)-(title|body)(?:-\d+)?$/);
  if (itemRows.size) {
    out.items = [...itemRows.entries()].map(([i, row]) => {
      const item: ContentItem = { title: row.title ?? "" };
      if (row.body) item.body = row.body;
      const icon = base.items?.[i]?.icon;
      if (icon) item.icon = icon;
      return item;
    });
  }
  const termRows = indexed(texts, /^term-(\d+)(?:-(def))?$/);
  if (termRows.size) out.terms = [...termRows.values()].map((r) => ({ term: r[""] ?? "", definition: r.def ?? "" }));
  const statRows = indexed(texts, /^stat-(\d+)-(value|label)$/);
  if (statRows.size) out.stats = [...statRows.values()].map((r) => ({ value: r.value ?? "", label: r.label ?? "" }));

  const points = (side: "a" | "b") => [...indexed(texts, new RegExp(`^${side}-point-(\\d+)()$`)).values()].map((r) => r[""]).filter(Boolean);
  const aPoints = points("a");
  const bPoints = points("b");
  if (texts.has("a-label") || texts.has("b-label") || aPoints.length || bPoints.length) {
    out.compare = {
      a: { label: texts.get("a-label") ?? "", points: aPoints },
      b: { label: texts.get("b-label") ?? "", points: bPoints },
    };
  }
  if (texts.has("quote")) {
    const author = (texts.get("author") ?? "").replace(/^[—–-]\s*/, "") || str(base.quote?.author);
    out.quote = { text: texts.get("quote") ?? "", ...(author ? { author } : {}) };
  }
  const choices = [...indexed(texts, /^choice-(\d+)()$/).values()].map((r) => r[""]).filter(Boolean);
  if (texts.has("question") || (base.question && choices.length)) {
    const q = base.question ?? { prompt: "" };
    out.question = { ...q, prompt: texts.get("question") ?? q.prompt };
    if (q.choices?.length || !(typeof q.answer === "boolean")) {
      if (choices.length) out.question.choices = choices;
    }
    if (texts.has("answer") && (typeof q.answer === "string" || q.answer === undefined)) out.question.answer = texts.get("answer");
  }
  return out;
}

/** Page content with the current text of its slotted elements (for relayout after edits). */
export function syncContentFromElements(page: ScenePage): SlideContent | undefined {
  if (!page.content) return undefined;
  return contentFromElements(page.elements, page.content);
}

const LIST_FIELDS = ["bullets", "items", "steps", "terms", "stats"] as const;

function hasField(c: SlideContent, field: string): boolean {
  switch (field) {
    case "subtitle":
    case "body":
      return Boolean(str(c[field]));
    case "quote":
      return Boolean(str(c.quote?.text));
    case "question":
      return Boolean(str(c.question?.prompt));
    case "compare":
      return Boolean(c.compare);
    default:
      return Boolean((c[field as (typeof LIST_FIELDS)[number]] ?? []).length);
  }
}

/** Content shown on a page: rebuilt from slots, plus fields the layout consumed without slots. */
function renderedContent(elements: readonly SceneElement[], input: SlideContent, overflow: SlideContent | undefined): SlideContent {
  const out = contentFromElements(elements, input) as EngineContent;
  for (const field of ["subtitle", "body", "quote", "question", "compare", ...LIST_FIELDS] as const) {
    if (!hasField(input, field) || hasField(out, field) || (overflow && hasField(overflow, field))) continue;
    Object.assign(out, { [field]: input[field] });
  }
  return out;
}

/** Joins a page and its continuation (inverse of overflow splitting, used when reflowing). */
export function mergeContent(a: SlideContent, b: SlideContent): SlideContent {
  const out: EngineContent = { ...a };
  delete out.continued;
  const joinText = (x?: string, y?: string) => [str(x), str(y)].filter(Boolean).join(" ") || undefined;
  if (b.subtitle && !str(a.subtitle)) out.subtitle = b.subtitle;
  out.body = joinText(a.body, b.body);
  if (!out.body) delete out.body;
  const aStart = (a as EngineContent).listStart ?? 0;
  const bStart = (b as EngineContent).listStart;
  const overlaps = (len: number) => bStart !== undefined && aStart + len > bStart;
  const joinList = <T>(x: T[] | undefined, y: T[] | undefined, merge: (p: T, q: T) => T | null): T[] | undefined => {
    if (!y?.length) return x;
    if (!x?.length) return y;
    if (overlaps(x.length)) {
      const merged = merge(x[x.length - 1], y[0]);
      if (merged) return [...x.slice(0, -1), merged, ...y.slice(1)];
    }
    return [...x, ...y];
  };
  out.bullets = joinList(a.bullets, b.bullets, (p, q) => `${p} ${q}`);
  out.steps = joinList(a.steps, b.steps, (p, q) => `${p} ${q}`);
  out.items = joinList(a.items, b.items, (p, q) => (p.title === q.title ? { ...p, body: joinText(p.body, q.body) } : null));
  out.terms = joinList(a.terms, b.terms, (p, q) => (p.term === q.term ? { ...p, definition: joinText(p.definition, q.definition) ?? "" } : null));
  out.stats = joinList(a.stats, b.stats, () => null);
  for (const field of LIST_FIELDS) if (!out[field]?.length) delete out[field];
  if (b.compare) {
    out.compare = a.compare
      ? {
          a: { label: a.compare.a.label || b.compare.a.label, points: [...a.compare.a.points, ...b.compare.a.points] },
          b: { label: a.compare.b.label || b.compare.b.label, points: [...a.compare.b.points, ...b.compare.b.points] },
        }
      : b.compare;
  }
  if (b.quote) out.quote = a.quote ? { ...a.quote, text: joinText(a.quote.text, b.quote.text) ?? "" } : b.quote;
  if (b.question) {
    out.question = a.question
      ? { ...a.question, choices: [...(a.question.choices ?? []), ...(b.question.choices ?? [])].filter(Boolean) }
      : b.question;
    if (out.question && !out.question.choices?.length) delete out.question.choices;
  }
  if (aStart) out.listStart = aStart;
  else delete out.listStart;
  return out;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function fallbackLayout(): LayoutDef {
  const layout = getLayout(FALLBACK_LAYOUT_ID);
  if (!layout) throw new Error("auto-layout: fallback layout missing");
  return layout;
}

/** Gives generated elements a slot when a layout left one out (slot-less elements are user additions). */
function stampSlots(elements: SceneElement[]): SceneElement[] {
  const seen = new Set<string>();
  return elements.map((el, i) => {
    let slot = el.slot ?? `x-${el.role}-${i}`;
    if (seen.has(slot)) slot = `${slot}~${i}`;
    seen.add(slot);
    return slot === el.slot ? el : { ...el, slot };
  });
}

export interface BuiltPage {
  page: ScenePage;
  /** Content that did not fit and continues on another page. */
  overflow?: SlideContent;
}

/** Builds exactly one page with a layout; the overflow is returned, not dropped. */
export function pageFromContent(content: SlideContent, ctx: LayoutContext, layoutId?: string, pageId?: string): BuiltPage {
  const layout = getLayout(layoutId) ?? candidateLayouts(content, ctx)[0]?.layout ?? fallbackLayout();
  const result = layout.build(content, ctx);
  const elements = stampSlots(result.elements);
  const page: ScenePage = {
    id: pageId ?? ctx.newId(),
    layoutId: layout.id,
    content: renderedContent(elements, content, result.overflow),
    background: result.background ?? ctx.theme.background,
    elements,
  };
  if (content.notes && !content.continued) page.notes = content.notes;
  return { page, overflow: result.overflow };
}

/**
 * Lays out one content as one or more pages. Overflow continues on pages marked
 * `content.continued` (same title, no "(cont.)"); every page makes progress.
 */
export function layoutPage(content: SlideContent, ctx: LayoutContext, layoutId?: string, pageId?: string): ScenePage[] {
  const pages: ScenePage[] = [];
  const recent = [...ctx.recent];
  let current: SlideContent | undefined = content;
  let stalled: SlideContent | undefined;
  let previous: string | undefined;
  const forced = getLayout(layoutId);
  for (let n = 0; current && n < MAX_CONTINUATIONS; n += 1) {
    const pageCtx: LayoutContext = { ...ctx, recent: [...recent] };
    const weight = contentWeight(current);
    const tries: string[] = [];
    if (n === 0 && forced && scoreOf(forced, current, { ...pageCtx, recent: [] }) > 0) tries.push(forced.id);
    if (n > 0 && previous && scoreOf(getLayout(previous) as LayoutDef, current, pageCtx) > 0) tries.push(previous);
    for (const c of candidateLayouts(current, pageCtx)) if (tries.length < 4 && !tries.includes(c.id)) tries.push(c.id);
    for (const id of [FALLBACK_LAYOUT_ID, FLOW_LAYOUT_ID]) if (!tries.includes(id)) tries.push(id);
    let built: BuiltPage | undefined;
    for (let t = 0; t < tries.length; t += 1) {
      const attempt = pageFromContent(current, pageCtx, tries[t], n === 0 ? pageId : undefined);
      const last = t === tries.length - 1;
      if (!attempt.overflow || contentWeight(attempt.overflow) < weight || last) {
        built = attempt;
        break;
      }
    }
    if (!built) break;
    pages.push(built.page);
    previous = built.page.layoutId;
    if (previous) recent.push(previous);
    const next = built.overflow;
    const nextWeight = next ? contentWeight(next) : 0;
    current = next && nextWeight > 0 && nextWeight < weight ? { ...next, continued: true } : undefined;
    // No layout made progress (should not happen): the rest goes on flow pages rather than being lost.
    if (next && !current && nextWeight > 0) stalled = { ...next, continued: true };
  }
  // Past the continuation cap (or after a stall), flow pages take the rest for as long as they make progress.
  let rest = current ?? stalled;
  while (rest) {
    const weight = contentWeight(rest);
    const flow = pageFromContent(rest, { ...ctx, recent: [...recent] }, FLOW_LAYOUT_ID);
    pages.push(flow.page);
    const next = flow.overflow;
    const nextWeight = next ? contentWeight(next) : 0;
    rest = next && nextWeight > 0 && nextWeight < weight ? { ...next, continued: true } : undefined;
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* Decks                                                               */
/* ------------------------------------------------------------------ */

export interface DeckFormat {
  id: string;
  width: number;
  height: number;
  kind: DeckKind;
}

export interface ComposeOptions {
  format: DeckFormat;
  theme: DeckTheme;
  fontPair: FontPair;
  title: string;
  seed?: number;
  measure?: TextMeasurer;
  /** Preferred layout id per content (same index); unknown ids are ignored. */
  layoutHints?: readonly (string | undefined | null)[];
  newId?: () => string;
  /** Deck id (default derived from the seed and title). */
  id?: string;
}

/** Seeded choice among layouts scoring within 88% of the best, never repeating the previous layout when avoidable. */
function chooseLayout(content: SlideContent, ctx: LayoutContext, random: () => number): string {
  const ranked = candidateLayouts(content, ctx);
  if (!ranked.length) return FALLBACK_LAYOUT_ID;
  const best = ranked[0].score;
  const last = ctx.recent[ctx.recent.length - 1];
  const pool = ranked.filter((c) => c.score >= best * 0.88 && c.id !== last);
  if (!pool.length) {
    const alternative = ranked.find((c) => c.id !== last);
    return alternative && alternative.score >= best * 0.5 ? alternative.id : ranked[0].id;
  }
  const total = pool.reduce((sum, c) => sum + c.score, 0);
  let pick = random() * total;
  for (const c of pool) {
    pick -= c.score;
    if (pick <= 0) return c.id;
  }
  return pool[pool.length - 1].id;
}

/** The hinted layout when it exists and suits the content on this page size, else undefined. */
function usableHint(hint: string | undefined | null, content: SlideContent, ctx: LayoutContext): string | undefined {
  const layout = getLayout(hint);
  return layout && scoreOf(layout, content, { ...ctx, recent: [] }) > 0 ? layout.id : undefined;
}

export function composeDeck(contents: readonly SlideContent[], opts: ComposeOptions): SceneDeck {
  const seed = (opts.seed ?? hashString(opts.title)) >>> 0;
  const newId = opts.newId ?? createIdFactory("el", seed);
  const pageId = opts.newId ?? createIdFactory("page", seed);
  const random = seededRandom(seed);
  const ctx = createLayoutContext({
    width: opts.format.width,
    height: opts.format.height,
    theme: opts.theme,
    fontPair: opts.fontPair,
    measure: opts.measure,
    seed,
    newId,
    deckKind: opts.format.kind,
  });
  const recent: string[] = [];
  const pages: ScenePage[] = [];
  contents.forEach((content, i) => {
    const pageCtx = { ...ctx, recent: [...recent] };
    const layoutId = usableHint(opts.layoutHints?.[i], content, pageCtx) ?? chooseLayout(content, pageCtx, random);
    for (const page of layoutPage(content, pageCtx, layoutId, pageId())) {
      pages.push(page);
      if (page.layoutId) recent.push(page.layoutId);
    }
  });
  return {
    v: 2,
    id: opts.id ?? `deck-${seed.toString(36)}`,
    title: opts.title,
    kind: opts.format.kind,
    formatId: opts.format.id,
    width: opts.format.width,
    height: opts.format.height,
    themeId: opts.theme.id,
    fontPairId: opts.fontPair.id,
    pages,
    seed,
  };
}

export interface TemplateComposeOptions {
  /** Deck title (default: the template name). */
  title?: string;
  seed?: number;
  measure?: TextMeasurer;
  newId?: () => string;
  id?: string;
  /** Overrides for the template's format, theme and font pair. */
  format?: DeckFormat;
  theme?: DeckTheme;
  fontPair?: FontPair;
}

/** Composes a library template (its format, theme, font pair and per-page layout hints) into a deck. */
export function composeTemplate(template: TemplateDef, opts: TemplateComposeOptions = {}): SceneDeck {
  const theme = opts.theme ?? getDeckTheme(template.themeId);
  const fontPair = opts.fontPair ?? getFontPair(template.fontPairId ?? theme.fontPairId);
  return composeDeck(template.pages, {
    format: opts.format ?? getFormat(template.formatId),
    theme,
    fontPair,
    title: opts.title ?? template.name,
    seed: opts.seed,
    measure: opts.measure,
    layoutHints: template.layoutHints,
    newId: opts.newId,
    id: opts.id,
  });
}

/* ------------------------------------------------------------------ */
/* Relayout                                                            */
/* ------------------------------------------------------------------ */

/** Elements the engine must keep: user-edited ones and user additions (no slot). */
function keptElements(page: ScenePage): SceneElement[] {
  return page.elements.filter((el) => el.edited || !el.slot);
}

function withUniqueIds(generated: SceneElement[], kept: SceneElement[]): SceneElement[] {
  const taken = new Set(kept.map((el) => el.id));
  return generated.map((el) => {
    if (!taken.has(el.id)) {
      taken.add(el.id);
      return el;
    }
    let n = 1;
    while (taken.has(`${el.id}-${n}`)) n += 1;
    taken.add(`${el.id}-${n}`);
    return { ...el, id: `${el.id}-${n}` };
  });
}

/** Longest stand-in a kept text lends the layout (see `relayout`). */
const STAND_IN_CHARS = 80;

/** A kept text as the layout sees it when its full text spills: its first line only. */
function standIn(el: SceneElement): SceneElement {
  if (el.kind !== "text" || !el.edited || !el.slot) return el;
  const line = el.text.trim().split("\n", 1)[0].trim().slice(0, STAND_IN_CHARS).trimEnd();
  return line === el.text ? el : { ...el, text: line };
}

const normalizeSpace = (text: string) => text.replace(/\s+/g, " ").trim();

/** True when some kept edited text did not land whole on the laid-out page (it spilled or was split). */
function keptTextSpills(kept: readonly SceneElement[], head: ScenePage): boolean {
  return kept.some((el) => {
    if (el.kind !== "text" || !el.edited || !el.slot) return false;
    const laid = head.elements.find((g) => g.slot === el.slot && g.kind === "text");
    return laid?.kind !== "text" || normalizeSpace(laid.text) !== normalizeSpace(el.text);
  });
}

/** Background a layout builds for a content under a context (theme surface, or its own fill). */
function layoutBackground(layoutId: string | undefined, content: SlideContent, ctx: LayoutContext): Background | undefined {
  const layout = getLayout(layoutId);
  if (!layout) return undefined;
  try {
    return layout.build(content, { ...ctx, recent: [], newId: createIdFactory("bg") }).background ?? ctx.theme.background;
  } catch {
    return undefined;
  }
}

interface RelayoutOptions {
  /** Kept elements take the box the new layout gives their slot (format reflow only). */
  adoptSlotBoxes?: boolean;
  /** Kept text is refit to its box at the context's size and font pair (format or font reflow only). */
  refit?: boolean;
  /** Without a layout id, pick the best layout instead of the page's current one. */
  pickLayout?: boolean;
}

/** Kept elements after a reflow: slotted ones may take the new layout's box for their slot, and text may be refit. */
function placeKept(kept: SceneElement[], laidOut: readonly SceneElement[], ctx: LayoutContext, opts: RelayoutOptions): SceneElement[] {
  if (!opts.adoptSlotBoxes && !opts.refit) return kept;
  const boxes = new Map(laidOut.filter((el) => el.slot).map((el) => [el.slot as string, el]));
  const page = { width: ctx.width, height: ctx.height, kind: deckKindOf(ctx) };
  return kept.map((el) => {
    const box = opts.adoptSlotBoxes && el.slot ? boxes.get(el.slot) : undefined;
    const placed: SceneElement = box ? { ...el, x: box.x, y: box.y, w: box.w, h: box.h } : el;
    return opts.refit && placed.kind === "text" ? refitTextElement(placed, ctx.fontPair, page, ctx.measure) : placed;
  });
}

function relayout(page: ScenePage, ctx: LayoutContext, layoutId: string | undefined, opts: RelayoutOptions = {}): ScenePage[] {
  if (!page.content) return [page];
  const kept = keptElements(page);
  const keptSlots = new Set(kept.map((el) => el.slot).filter(Boolean));
  const target = layoutId ?? (opts.pickLayout ? undefined : page.layoutId);
  let content = contentFromElements(page.elements, page.content);
  let pages = layoutPage(content, ctx, target, page.id);
  if (pages[0] && keptTextSpills(kept, pages[0])) {
    content = contentFromElements(page.elements.map(standIn), page.content);
    pages = layoutPage(content, ctx, target, page.id);
  }
  const [first, ...rest] = pages;
  if (!first) return [page];
  const generated = first.elements.filter((el) => !el.slot || !keptSlots.has(el.slot));
  const placed = placeKept(kept, first.elements, ctx, opts);
  const elements = [...withUniqueIds(generated, placed), ...placed];
  const builtBg = first.layoutId === page.layoutId ? first.background : layoutBackground(page.layoutId, content, ctx);
  const out: ScenePage = {
    ...page,
    layoutId: first.layoutId,
    content: renderedContent(elements, first.content ?? content, undefined),
    background: isGeneratedBackground(page.background, ctx.theme, builtBg) ? first.background : page.background,
    elements,
  };
  return [out, ...rest];
}

/**
 * Re-lays out a page (optionally with another layout). Edited elements and user additions
 * are kept as they are; generated elements for their slots are dropped. Kept text is laid out
 * as written, or as a one-line stand-in when the full text would spill onto continuation pages. Returns the page
 * (same id) followed by any continuation pages the new layout needs.
 */
export function relayoutPage(page: ScenePage, ctx: LayoutContext, layoutId?: string): ScenePage[] {
  return relayout(page, ctx, layoutId);
}

/** Cycles to the next suitable layout that can show the page (deterministic order). */
export function shuffleLayout(page: ScenePage, ctx: LayoutContext): ScenePage[] {
  const content = syncContentFromElements(page);
  if (!content) return [page];
  const ranked = candidateLayouts(content, { ...ctx, recent: [] });
  const best = ranked[0]?.score ?? 0;
  const ids = ranked.filter((c) => c.score >= best * 0.25).slice(0, 10).map((c) => c.id);
  if (!ids.length) ids.push(FALLBACK_LAYOUT_ID);
  const index = page.layoutId ? ids.indexOf(page.layoutId) : -1;
  for (let step = 1; step <= ids.length; step += 1) {
    const id = ids[(index + step) % ids.length];
    if (id === page.layoutId) continue;
    const next = relayoutPage(page, ctx, id);
    if (next[0]?.layoutId === id) return next;
  }
  return [page];
}

/* ------------------------------------------------------------------ */
/* Reflow (format / theme / font change)                               */
/* ------------------------------------------------------------------ */

export interface ReflowOptions {
  /** New theme (default: the deck's library theme). */
  theme?: DeckTheme;
  /** New font pair (default: the new theme's pair when a theme is given, else the deck's pair). */
  fontPair?: FontPair;
  format?: { id: string; width: number; height: number; kind?: DeckKind };
  measure?: TextMeasurer;
  newId?: () => string;
  /** Theme the deck used before (default: the deck's library theme); lets theme-default backgrounds swap precisely. */
  previousTheme?: DeckTheme;
}

const ASPECT_LOCKED = (el: SceneElement) =>
  el.kind === "icon" ||
  (el.kind === "shape" && (el.shape === "circle" || el.shape === "ring" || el.shape === "star" || el.shape === "blob")) ||
  (el.kind === "image" && (el.mask === "circle" || el.mask === "blob"));

/** Scales one element to a new page size: px properties by the type scale, round shapes keep their aspect. */
export function scaleElement(el: SceneElement, from: { width: number; height: number }, to: { width: number; height: number }): SceneElement {
  if (from.width === to.width && from.height === to.height) return el;
  const s = Math.min(to.width, to.height) / Math.max(1, Math.min(from.width, from.height));
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  const out = { ...el } as SceneElement;
  if (ASPECT_LOCKED(el)) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const w = Math.min(1, (el.w * from.width * s) / to.width);
    const h = Math.min(1, (el.h * from.height * s) / to.height);
    out.w = round(w);
    out.h = round(h);
    out.x = round(Math.min(1 - w, Math.max(0, cx - w / 2)));
    out.y = round(Math.min(1 - h, Math.max(0, cy - h / 2)));
  }
  if (out.kind === "text" && out.fontSize) out.fontSize = Math.max(1, Math.round(out.fontSize * s));
  if ((out.kind === "shape" || out.kind === "image" || out.kind === "text") && out.radius) out.radius = Math.round(out.radius * s);
  if (out.kind === "shape" && out.strokeWidth) out.strokeWidth = Math.max(1, Math.round(out.strokeWidth * s * 100) / 100);
  return out;
}

const pageEdited = (page: ScenePage) => page.elements.some((el) => el.edited || !el.slot);

/** The page's layout when it still suits the (new) format, else undefined so the best one is picked. */
function suitableLayoutId(layoutId: string | undefined, content: SlideContent, ctx: LayoutContext): string | undefined {
  const layout = getLayout(layoutId);
  return layout && scoreOf(layout, content, { ...ctx, recent: [] }) > 0 ? layout.id : undefined;
}

/**
 * Re-renders a deck for a new format, theme or font pair. Untouched continuation groups are
 * merged and laid out again (page count may change) and keep their notes and custom
 * backgrounds; edited pages keep user elements (on a new size, slotted ones take the new
 * layout's box for their slot; kept text is refit); pages without content are scaled geometrically.
 * A layout is kept only while the deck kind stays the same.
 */
export function reflowDeck(deck: SceneDeck, opts: ReflowOptions = {}): SceneDeck {
  const theme = opts.theme ?? getDeckTheme(deck.themeId);
  const fontPair = opts.fontPair ?? getFontPair(opts.theme ? theme.fontPairId : deck.fontPairId ?? theme.fontPairId);
  const previousTheme = opts.previousTheme ?? findDeckTheme(deck.themeId);
  const width = opts.format?.width ?? deck.width;
  const height = opts.format?.height ?? deck.height;
  const from = { width: deck.width, height: deck.height };
  const to = { width, height };
  const kind = opts.format?.kind ?? deck.kind;
  const sameKind = kind === deck.kind;
  const resized = width !== deck.width || height !== deck.height;
  const refit = resized || fontPair.id !== (deck.fontPairId ?? previousTheme?.fontPairId);
  const seed = deck.seed ?? hashString(deck.id);
  const taken = new Set(deck.pages.flatMap((page) => [page.id, ...page.elements.map((el) => el.id)]));
  const issue = opts.newId ?? createIdFactory(`r${hashString(`${deck.id}:${width}x${height}:${theme.id}:${fontPair.id}`).toString(36)}`, seed);
  const newId = () => {
    let id = issue();
    while (taken.has(id)) id = issue();
    taken.add(id);
    return id;
  };
  const ctx = createLayoutContext({ width, height, theme, fontPair, measure: opts.measure, seed, newId, deckKind: kind });
  const oldTheme = previousTheme ?? theme;
  const oldCtx = { ...ctx, width: deck.width, height: deck.height, theme: oldTheme, deckKind: deck.kind } as EngineContext;
  const builtBackgrounds = new Map<string, Background | undefined>();
  /** True when the user chose the page's background (it is neither the old theme's nor its layout's). */
  const customBackground = (page: ScenePage) => {
    if (isGeneratedBackground(page.background, oldTheme)) return false;
    const id = page.layoutId ?? "";
    if (!builtBackgrounds.has(id)) builtBackgrounds.set(id, page.content ? layoutBackground(page.layoutId, page.content, oldCtx) : undefined);
    return !isGeneratedBackground(page.background, oldTheme, builtBackgrounds.get(id));
  };
  const groups: ScenePage[][] = [];
  for (const page of deck.pages) {
    if (page.content?.continued && groups.length) groups[groups.length - 1].push(page);
    else groups.push([page]);
  }
  const recent: string[] = [];
  const pages: ScenePage[] = [];
  const push = (list: ScenePage[]) => {
    for (const page of list) {
      pages.push(page);
      if (page.layoutId) recent.push(page.layoutId);
    }
  };
  for (const group of groups) {
    const pageCtx = { ...ctx, recent: [...recent] };
    const head = group[0];
    const untouched = group.every((p) => p.content && getLayout(p.layoutId) && !pageEdited(p));
    if (untouched) {
      const merged = group.map((p) => syncContentFromElements(p) as SlideContent).reduce((a, b) => mergeContent(a, b));
      const laid = layoutPage(merged, pageCtx, suitableLayoutId(sameKind ? head.layoutId : undefined, merged, pageCtx), head.id);
      laid.forEach((p, i) => {
        const original = group[i];
        if (!original) return;
        if (i > 0) p.id = original.id;
        if (original.name) p.name = original.name;
        if (original.hidden) p.hidden = original.hidden;
        if (original.transition) p.transition = original.transition;
        if (original.notes) p.notes = original.notes;
        if (customBackground(original)) p.background = themedBackground(original.background, p.layoutId, theme, previousTheme);
      });
      const leftNotes = group.slice(laid.length).map((p) => str(p.notes)).filter(Boolean);
      const last = laid[laid.length - 1];
      if (last && leftNotes.length) last.notes = [str(last.notes), ...leftNotes].filter(Boolean).join("\n\n");
      push(laid);
      continue;
    }
    for (const page of group) {
      if (page.content && getLayout(page.layoutId)) {
        const scaled = {
          ...page,
          background: themedBackground(page.background, page.layoutId, theme, previousTheme),
          elements: page.elements.map((el) => (el.edited || !el.slot ? scaleElement(el, from, to) : el)),
        };
        const content = syncContentFromElements(scaled) as SlideContent;
        const layoutId = suitableLayoutId(sameKind ? page.layoutId : undefined, content, ctx);
        push(relayout(scaled, { ...ctx, recent: [...recent] }, layoutId, { adoptSlotBoxes: resized, refit, pickLayout: !layoutId }));
      } else {
        push([
          {
            ...page,
            background: themedBackground(page.background, page.layoutId, theme, previousTheme),
            elements: page.elements.map((el) => scaleElement(el, from, to)),
          },
        ]);
      }
    }
  }
  return {
    ...deck,
    kind,
    formatId: opts.format?.id ?? deck.formatId,
    width,
    height,
    themeId: theme.id,
    fontPairId: fontPair.id,
    pages,
  };
}

