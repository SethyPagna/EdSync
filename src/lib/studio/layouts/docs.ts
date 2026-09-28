import { splitTextToFit } from "../fit";
import type { ContentKind, DeckKind, LayoutDef } from "../scene";
import {
  analyze,
  choicesOf,
  clean,
  createKit,
  defineLayout,
  entriesOf,
  listSource,
  quoteOf,
  type Box,
  type Entry,
  type LayoutKit,
  type ListField,
} from "./kit";
import { compareEntries } from "./compare";
import { choiceEntries } from "./learning";
import { labelRows } from "./sequence";

const ALL_KINDS: ContentKind[] = [
  "title",
  "agenda",
  "section",
  "bullets",
  "concept",
  "steps",
  "timeline",
  "compare",
  "stat",
  "stats",
  "quote",
  "definition",
  "glossary",
  "question",
  "quiz",
  "activity",
  "image",
  "summary",
  "closing",
];

const DOC_WEIGHTS: Partial<Record<DeckKind, number>> = { doc: 1.6, worksheet: 1.25, slides: 0.45, social: 0.3, design: 0.7 };
const WORKSHEET_WEIGHTS: Partial<Record<DeckKind, number>> = { worksheet: 1.7, doc: 1.15, slides: 0.45, social: 0.3, design: 0.7 };
const CORNELL_WEIGHTS: Partial<Record<DeckKind, number>> = { doc: 1.45, worksheet: 1.3, slides: 0.45, social: 0.3, design: 0.7 };
/** Cornell rows in page order: cued fields (terms, question/answer items) before plain notes. */
const CORNELL_FIELDS: readonly ListField[] = ["terms", "items", "bullets", "steps"];

/** Document header (smaller on continuation pages) with a rule; returns the content top. */
function docHeader(k: LayoutKit, area: Box): number {
  const continued = Boolean(k.content.continued);
  const bottom = k.header(area, { titleStyle: continued ? "heading" : "title", titleMaxH: area.h * (continued ? 0.1 : 0.2) });
  const y = bottom + k.u * 2.5;
  k.rule({ x: area.x, y, w: area.w, h: k.hairline() }, "border", "header-rule");
  return y + k.u * 3.5;
}

/** Numbered worksheet tasks, each followed by writing lines. Returns the entries that did not fit. */
function tasks(k: LayoutKit, area: Box, entries: Entry[], lines: number): { bottom: number; rest: Entry[] } {
  const body = k.style("body");
  const lineGap = Math.round(32 * k.s);
  const start = k.content.listStart ?? 0;
  const d = k.badgeDiameter(Math.max(Math.round(body.fontSize * 1.5), Math.round(22 * k.s)), String(start + entries.length));
  const textX = area.x + d + k.u * 2;
  const textW = area.x + area.w - textX;
  const bottom = area.y + area.h;
  let y = area.y;
  let shown = 0;
  for (const e of entries) {
    const th = k.textHeight(e.title, "body", textW, undefined, e.body ? 600 : undefined) + (e.body ? k.u + k.textHeight(e.body, "small", textW) : 0);
    const h = Math.max(th, d) + k.u * 1.5 + lines * lineGap;
    if (shown > 0 && y + h > bottom + 0.5) break;
    const group = k.ctx.newId();
    k.badge(area.x + d / 2, y + (body.fontSize * body.lineHeight) / 2, d, { slot: e.key, label: String(start + e.index + 1), tone: "soft", group });
    const t = k.text({ text: e.title, style: "body", role: e.body ? "item-title" : "bullet", slot: e.slotTitle, w: textW, size: body.fontSize, weight: e.body ? 600 : undefined }, textX, y, { group });
    let ty = y + t.h;
    if (e.body) {
      const b = k.text({ text: e.body, style: "small", role: "item-body", slot: e.slotBody, w: textW, ...k.mutedSpec() }, textX, ty + k.u, { group });
      ty += k.u + b.h;
    }
    ty = Math.max(ty, y + d) + k.u * 1.5;
    for (let i = 0; i < lines; i += 1) {
      k.rule({ x: textX, y: ty + (i + 1) * lineGap - k.hairline(), w: textW, h: k.hairline() }, "border", `${e.key}-line-${i}`, group);
    }
    y += h + k.u * 3;
    shown += 1;
  }
  return { bottom: y, rest: entries.slice(shown) };
}

/**
 * Renders every content field in reading order at document type sizes. The first field
 * that does not fit is split; it and everything after it continue on the next page.
 */
function flow(k: LayoutKit, area: Box, opts: { worksheet?: boolean } = {}) {
  const c = k.content;
  const bottom = area.y + area.h;
  const body = k.style("body");
  const minRoom = body.fontSize * body.lineHeight * 2.4;
  const gap = k.u * 3.5;
  let y = area.y;
  let first = true;
  let stopped = false;
  const room = () => bottom - y;
  const start = () => {
    if (stopped) return false;
    if (!first && room() < minRoom) stopped = true;
    return !stopped;
  };
  const advance = (to: number) => {
    y = to + gap;
    first = false;
  };

  if (clean(c.image) && !c.continued && start()) {
    const h = Math.round(Math.min(area.w * 0.5, area.h * 0.3));
    k.image({ x: area.x, y, w: area.w, h }, { radius: k.radius });
    advance(y + h);
  }

  if (clean(c.body) && start()) {
    const m = k.bodyBlock(area.w, room(), { fixed: true });
    k.place(m, area.x, y);
    advance(y + m.h);
    if (m.spec.text.length < clean(c.body).length) stopped = true;
  }

  const fields: ListField[] = ["bullets", "items", "steps", "terms", "stats"];
  for (const field of fields) {
    const entries = entriesOf(c, field);
    if (!entries.length) continue;
    if (!start()) break;
    const box = { x: area.x, y, w: area.w, h: room() };
    if (opts.worksheet && (field === "bullets" || field === "items" || field === "steps")) {
      const res = tasks(k, box, entries, field === "items" ? 3 : 2);
      k.use(field);
      k.continueList(field, res.rest);
      advance(res.bottom - k.u * 3);
      if (res.rest.length) stopped = true;
      continue;
    }
    const marker = field === "steps" ? "number" : field === "terms" || field === "stats" ? "none" : "dot";
    const res = k.list(box, { field, entries }, { marker, fixed: true, gapEm: field === "terms" ? 0.9 : 0.6 });
    advance(res.bottom);
    if (res.rest.length) stopped = true;
  }

  const cmp = c.compare;
  if (cmp && analyze(c).hasCompare && start()) {
    k.use("compare");
    const full = (side: "a" | "b") => ({ label: clean(cmp[side]?.label), points: (cmp[side]?.points ?? []).map(clean).filter(Boolean) });
    for (const side of ["a", "b"] as const) {
      if (!start()) {
        const left = { a: side === "a" ? full("a") : { label: "", points: [] }, b: full("b") };
        if ([left.a, left.b].some((s) => s.label || s.points.length)) k.continueWith({ compare: left });
        break;
      }
      const label = clean(cmp[side]?.label);
      if (label) {
        const m = k.text({ text: label, style: "subheading", role: "item-title", slot: `${side}-label`, w: area.w, weight: 600, color: k.ink.accent }, area.x, y);
        y += m.h + k.u * 1.5;
      }
      const entries = compareEntries(side, cmp[side]?.points);
      let rest: Entry[] = [];
      if (entries.length) {
        const res = k.list({ x: area.x, y, w: area.w, h: Math.max(minRoom, bottom - y) }, { field: "bullets", entries }, { marker: "dot", fixed: true, onRest: (r) => (rest = r) });
        advance(res.bottom);
      } else {
        advance(y - gap + k.u);
      }
      if (rest.length) {
        const points = rest.map((e) => e.title);
        k.continueWith({
          compare: side === "a" ? { a: { label, points }, b: full("b") } : { a: { label: "", points: [] }, b: { label, points } },
        });
        stopped = true;
        break;
      }
    }
  }

  if (clean(c.quote?.text) && start()) {
    const { text, author } = quoteOf(c);
    const style = k.style("quote");
    const size = Math.round(Math.min(style.fontSize, body.fontSize * 1.3));
    const barW = Math.max(3, Math.round(4 * k.s));
    const x = area.x + barW + k.u * 2.5;
    const w = area.w - barW - k.u * 2.5;
    const authorM = k.measure({ text: author ? `— ${author}` : "", style: "small", role: "author", slot: "author", w, ...k.mutedSpec() });
    const avail = room() - (authorM.h ? authorM.h + k.u : 0);
    const split = splitTextToFit(text, { ...style, fontSize: size, minSize: size }, w, Math.max(avail, size * style.lineHeight), k.ctx.measure);
    if (split.rest && !first && split.fit.length < text.length * 0.5) {
      stopped = true;
    } else {
      const top = y;
      const q = k.text({ text: split.fit, style: "quote", role: "quote", slot: "quote", w, size }, x, y);
      y += q.h;
      if (authorM.h) {
        k.place(authorM, x, y + k.u);
        y += k.u + authorM.h;
      }
      k.rule({ x: area.x, y: top, w: barW, h: y - top }, "accent", "quote-bar");
      k.use("quote");
      if (split.rest) {
        k.continueWith({ quote: { text: split.rest, ...(author ? { author } : {}) } });
        stopped = true;
      }
      advance(y);
    }
  }

  const q = c.question;
  if (q && clean(q.prompt) && start()) {
    const m = k.text({ text: clean(q.prompt), style: "subheading", role: "item-title", slot: "question", w: area.w, weight: 600 }, area.x, y);
    y += m.h + k.u * 2;
    k.use("question");
    const choices = choiceEntries(choicesOf(c));
    if (choices.length) {
      let rest: Entry[] = [];
      const res = k.list({ x: area.x, y, w: area.w, h: Math.max(minRoom, bottom - y) }, { field: "bullets", entries: choices }, { marker: "letter", fixed: true, onRest: (r) => (rest = r) });
      if (rest.length) {
        k.continueWith({ question: { ...q, choices: rest.map((e) => e.title) }, listStart: (c.listStart ?? 0) + rest[0].index });
        stopped = true;
      }
      advance(res.bottom);
    } else if (opts.worksheet || typeof q.answer !== "boolean") {
      const lineGap = Math.round(32 * k.s);
      const lines = Math.max(2, Math.min(6, Math.floor((bottom - y) / lineGap)));
      for (let i = 0; i < lines; i += 1) {
        k.rule({ x: area.x, y: y + (i + 1) * lineGap - k.hairline(), w: area.w, h: k.hairline() }, "border", `answer-line-${i}`);
      }
      advance(y + lines * lineGap);
    } else {
      advance(y);
    }
  }
}

export const docArticle = defineLayout({
  id: "doc-article",
  name: "Article page",
  kinds: ALL_KINDS,
  orientation: "portrait",
  deckKinds: DOC_WEIGHTS,
  fit: (s) => {
    let score = 50 + (s.totalChars > 500 ? 26 : s.totalChars > 250 ? 12 : 0) + (s.listCount >= 6 ? 8 : 0);
    if (s.kind === "title" || s.kind === "section" || s.kind === "closing") score -= 26;
    return score;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    const top = docHeader(k, k.safe);
    flow(k, k.below(k.safe, top, 0));
    return k.done();
  },
});

export const docWorksheet = defineLayout({
  id: "doc-worksheet",
  name: "Worksheet page",
  kinds: ["question", "quiz", "activity", "steps", "bullets", "summary"],
  orientation: "portrait",
  deckKinds: WORKSHEET_WEIGHTS,
  fit: (s) => {
    if (s.hasQuestion) return 72;
    if (s.kind === "activity" || s.kind === "quiz" || s.kind === "question") return 66;
    if (s.steps || s.bullets) return 36;
    return s.listCount ? 24 : 12;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    const top = docHeader(k, k.safe);
    flow(k, k.below(k.safe, top, 0), { worksheet: true });
    return k.done();
  },
});

export const docCornell = defineLayout({
  id: "doc-cornell",
  name: "Cornell notes",
  kinds: ["concept", "summary", "bullets", "glossary", "definition", "timeline"],
  orientation: "portrait",
  deckKinds: CORNELL_WEIGHTS,
  fit: (s) => {
    const cued = s.terms + s.itemBodies;
    if (cued >= 2) return 62 + (s.kind === "glossary" || s.kind === "definition" || s.kind === "concept" ? 8 : 0);
    return s.bullets >= 3 ? 34 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    const top = docHeader(k, k.safe);
    const area = k.below(k.safe, top, 0);
    const source = listSource(content, ["terms", "items", "bullets", "steps"]);
    if (!source) {
      k.paragraph(area, { fixed: true });
      return k.done();
    }
    let rowsBottom = area.y + area.h;
    if (clean(content.body)) {
      const pad = k.pad;
      const m = k.bodyBlock(area.w - pad * 2, area.h * 0.26, { style: "body", fixed: true });
      const boxH = m.h + pad * 2;
      const box = { x: area.x, y: area.y + area.h - boxH, w: area.w, h: boxH };
      k.card(box, { slot: "summary-box", tone: "muted" });
      k.place(m, box.x + pad, box.y + pad);
      rowsBottom = box.y - k.u * 3;
    }
    const cueW = Math.round(area.w * 0.3);
    const body = k.style("body");
    const gap = body.fontSize * 1.4;
    const minRoom = body.fontSize * body.lineHeight * 2;
    let bottom = area.y;
    for (const field of CORNELL_FIELDS) {
      const entries = entriesOf(content, field);
      if (!entries.length) continue;
      let y = area.y;
      if (bottom > area.y) {
        if (rowsBottom - bottom - gap < minRoom) break;
        k.rule({ x: area.x, y: bottom + gap / 2, w: area.w, h: k.hairline() }, "border", `${field}-rule`);
        y = bottom + gap;
      }
      const res = labelRows(k, { x: area.x, y, w: area.w, h: Math.max(0, rowsBottom - y) }, { field, entries }, { leftW: cueW, separators: true, fixed: true });
      k.use(field);
      k.continueList(field, res.rest);
      bottom = res.bottom;
      if (res.rest.length) break;
    }
    const colGap = k.u * 2.5;
    k.rule({ x: area.x + cueW + colGap / 2 - k.hairline() / 2, y: area.y, w: k.hairline(), h: Math.max(k.u, bottom - area.y) }, "border", "cue-rule");
    return k.done();
  },
});

export const DOC_LAYOUTS: LayoutDef[] = [docArticle, docWorksheet, docCornell];
