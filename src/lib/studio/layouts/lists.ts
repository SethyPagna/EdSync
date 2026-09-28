import { splitToFit } from "../fit";
import type { LayoutDef } from "../scene";
import {
  clean,
  createKit,
  defineLayout,
  knownIcon,
  listSource,
  orientationOf,
  type Box,
  type ContentShape,
  type Entry,
  type LayoutKit,
  type ListSource,
  type Marker,
  type StackBlock,
} from "./kit";

export function markerFor(source: ListSource): Marker {
  if (source.field === "steps") return "number";
  if (source.field === "terms" || source.field === "stats") return "none";
  return "dot";
}

/** Header + lead + list inside an area (the standard text column). */
export function textColumn(k: LayoutKit, area: Box, opts: { marker?: Marker; listW?: number } = {}) {
  const source = listSource(k.content);
  const bottom = k.header(area, {
    titleMaxH: area.h * 0.34,
    lead: true,
    leadMaxH: area.h * (source ? 0.22 : 0.62),
  });
  if (!source) return;
  const listArea = k.below(area, bottom, k.u * 4);
  if (opts.listW) listArea.w = Math.min(listArea.w, opts.listW);
  k.list(listArea, source, { marker: opts.marker ?? markerFor(source) });
}

function listKinds(s: ContentShape, weights: Partial<Record<string, number>>, fallback = 0): number {
  return weights[s.kind] ?? fallback;
}

/** Numbered agenda rows with hairline separators. */
function numberedRows(k: LayoutKit, area: Box, source: ListSource) {
  const num = k.style("heading");
  const text = k.style("subheading");
  const body = k.style("small");
  const numW = Math.round(num.fontSize * 2.2);
  const textW = Math.max(k.u * 8, area.w - numW);
  const rowPad = k.u * 1.75;
  const sizes = (scale: number) => ({
    num: Math.max(num.minSize, Math.round(num.fontSize * scale)),
    text: Math.max(text.minSize, Math.round(text.fontSize * scale)),
    body: Math.max(body.minSize, Math.round(body.fontSize * scale)),
  });
  const rowH = (e: Entry, scale: number) => {
    const s = sizes(scale);
    const th = k.textHeight(e.title, "subheading", textW, s.text) + (e.body ? s.body * 0.3 + k.textHeight(e.body, "small", textW, s.body) : 0);
    return Math.max(th, s.num * num.lineHeight) + rowPad * 2;
  };
  const minScale = Math.max(text.minSize / text.fontSize, num.minSize / num.fontSize);
  const split = splitToFit(source.entries, (list, scale) => list.reduce((sum, e) => sum + rowH(e, scale), 0), area.h, minScale, 0.04);
  const sz = sizes(split.scale);
  const start = k.content.listStart ?? 0;
  let y = area.y;
  split.fit.forEach((e) => {
    const group = k.ctx.newId();
    k.rule({ x: area.x, y, w: area.w, h: k.hairline() }, "border", `${e.key}-rule`, group);
    const numLine = sz.num * num.lineHeight;
    const textLine = sz.text * text.lineHeight;
    k.text({ text: String(start + e.index + 1).padStart(2, "0"), style: "heading", role: "number", slot: `${e.key}-number`, w: numW, size: sz.num, color: k.ink.accent }, area.x, y + rowPad, { group });
    let ty = y + rowPad + Math.max(0, (numLine - textLine) / 2);
    const t = k.text({ text: e.title, style: "subheading", role: e.body ? "item-title" : "bullet", slot: e.slotTitle, w: textW, size: sz.text }, area.x + numW, ty, { group });
    ty += t.h;
    if (e.body) {
      k.text({ text: e.body, style: "small", role: "item-body", slot: e.slotBody, w: textW, size: sz.body, ...k.mutedSpec() }, area.x + numW, ty + sz.body * 0.3, { group });
    }
    y += rowH(e, split.scale);
  });
  if (split.fit.length) k.rule({ x: area.x, y, w: area.w, h: k.hairline() }, "border", "rows-end");
  k.use(source.field);
  k.continueList(source.field, split.rest);
}

export const agendaList = defineLayout({
  id: "agenda-list",
  name: "Agenda list",
  kinds: ["agenda", "bullets", "summary"],
  orientation: "any",
  fit: (s) => {
    if (!s.listCount) return 0;
    if (s.kind === "agenda") return s.listCount <= 8 ? 82 : 62;
    const short = s.avgEntryChars < 60 && s.listCount >= 3 && s.listCount <= 7;
    return listKinds(s, { bullets: short ? 40 : 14, summary: short ? 30 : 12 }, short ? 20 : 8);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const source = listSource(content, ["items", "bullets", "steps", "terms"]);
    if (k.landscape) {
      const left = k.col(0, 4);
      const right = k.col(5, 7);
      k.header({ x: left.x, y: k.safe.y, w: left.w, h: k.safe.h }, { titleMaxH: k.safe.h * 0.5, lead: true, leadMaxH: k.safe.h * 0.3 });
      if (source) numberedRows(k, { x: right.x, y: k.safe.y, w: right.w, h: k.safe.h }, source);
    } else {
      const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.18 });
      if (source) numberedRows(k, k.below(k.safe, bottom, k.u * 4), source);
    }
    return k.done();
  },
});

export const agendaCards = defineLayout({
  id: "agenda-cards",
  name: "Agenda cards",
  kinds: ["agenda", "bullets"],
  orientation: "any",
  fit: (s) => {
    if (!s.listCount) return 0;
    const n = s.listCount;
    const base = n >= 3 && n <= 6 ? 74 : n === 2 ? 48 : n <= 8 ? 42 : 20;
    if (s.kind === "agenda") return base - (s.avgEntryChars > 120 ? 20 : 0);
    return s.avgEntryChars < 70 ? base * 0.5 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.16, titleMaxH: k.safe.h * 0.3 });
    const source = listSource(content, ["items", "bullets", "steps", "terms"]);
    if (source) {
      const n = Math.min(6, source.entries.length);
      const cols = k.landscape ? (n <= 4 ? n : 3) : k.square ? 2 : n <= 3 ? 1 : 2;
      const res = k.cards(k.below(k.safe, bottom, k.u * 5), source.entries, {
        cols,
        capacity: 6,
        badge: "number",
        horizontal: cols === 1,
        titleStyle: "subheading",
        bodyStyle: "small",
        fill: 0.6,
      });
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

export const bulletsSimple = defineLayout({
  id: "bullets-simple",
  name: "Bullets",
  kinds: ["bullets", "concept", "summary", "agenda", "activity", "steps", "timeline", "glossary", "definition"],
  orientation: "any",
  fit: (s) => {
    if (!s.listCount) return s.hasBody ? 34 : 0;
    const base = listKinds(s, { bullets: 56, concept: 46, summary: 40, agenda: 40, activity: 34, steps: 30, timeline: 24, glossary: 26, definition: 24 }, 24);
    return base + (s.listCount >= 5 ? 10 : 0) + (s.avgEntryChars > 90 ? 6 : 0) - (s.hasImage ? 10 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const area = k.landscape ? { ...k.safe, w: k.col(0, 10).w } : k.safe;
    textColumn(k, area, { listW: k.landscape ? k.col(0, 9).w : undefined });
    return k.done();
  },
});

function imageTextArea(k: LayoutKit, side: "left" | "right"): Box {
  if (k.landscape) {
    const imgW = Math.round(k.W * 0.42);
    if (side === "right") {
      k.image({ x: k.W - imgW, y: 0, w: imgW, h: k.H });
      return { x: k.safe.x, y: k.safe.y, w: k.W - imgW - k.safe.x - k.gutter * 2, h: k.safe.h };
    }
    k.image({ x: 0, y: 0, w: imgW, h: k.H });
    const x = imgW + k.gutter * 2;
    return { x, y: k.safe.y, w: k.right - x, h: k.safe.h };
  }
  const imgH = Math.round(k.H * (k.portrait ? 0.34 : 0.38));
  if (side === "right") {
    k.image({ x: 0, y: 0, w: k.W, h: imgH });
    const y = imgH + k.u * 5;
    return { x: k.safe.x, y, w: k.safe.w, h: k.bottom - y };
  }
  k.image({ x: 0, y: k.H - imgH, w: k.W, h: imgH });
  const bottom = k.H - imgH - k.u * 5;
  return { x: k.safe.x, y: k.safe.y, w: k.safe.w, h: bottom - k.safe.y };
}

function bulletsImage(side: "left" | "right"): LayoutDef {
  return defineLayout({
    id: `bullets-image-${side}`,
    name: side === "right" ? "Bullets, image right" : "Bullets, image left",
    kinds: ["bullets", "concept", "summary", "activity"],
    orientation: "any",
    fit: (s) => {
      if (!s.listCount && !s.hasBody) return 0;
      const base = (s.hasImage ? 70 : 28) - (side === "left" ? 3 : 0);
      return base - (s.listCount > 6 ? 18 : 0) - (s.avgEntryChars > 130 ? 10 : 0);
    },
    build: (content, ctx) => {
      const k = createKit(content, ctx);
      textColumn(k, imageTextArea(k, side));
      return k.done();
    },
  });
}

export const bulletsImageRight = bulletsImage("right");
export const bulletsImageLeft = bulletsImage("left");

export const bulletsIconGrid = defineLayout({
  id: "bullets-icon-grid",
  name: "Icon grid",
  kinds: ["bullets", "concept", "summary", "agenda"],
  orientation: "any",
  fit: (s) => {
    if (s.listCount < 2) return 0;
    if (s.itemIcons >= 2 && s.listCount <= 6) return 82;
    if (s.listCount >= 3 && s.listCount <= 6 && s.avgEntryChars < 90) return 46;
    return 12;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.16, titleMaxH: k.safe.h * 0.28 });
    const source = listSource(content);
    if (source) {
      const n = Math.min(6, source.entries.length);
      const cols = k.landscape ? (n <= 3 ? n : n === 4 ? 2 : 3) : n <= 2 ? 1 : 2;
      const rich = source.entries.some((e) => e.body);
      const res = k.cards(k.below(k.safe, bottom, k.u * 5), source.entries, {
        cols,
        capacity: 6,
        bare: true,
        badge: "icon",
        badgeTone: "soft",
        horizontal: cols === 1,
        titleStyle: rich ? "subheading" : "body",
        bodyStyle: "small",
        plainTitles: !rich,
        gapX: k.gutter * 2,
        gapY: k.u * 5,
        fill: 0.5,
        valign: "middle",
      });
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

function cardsLayout(n: 2 | 3 | 4): LayoutDef {
  return defineLayout({
    id: `cards-${n}`,
    name: `${n} cards`,
    kinds: ["bullets", "concept", "summary", "agenda", "activity", "compare"],
    orientation: "any",
    fit: (s) => {
      if (s.listCount !== n) return s.listCount > n ? 6 : 0;
      let score = 70 + (s.itemBodies >= n ? 10 : 0) - (s.avgEntryChars > 220 ? 22 : s.avgEntryChars > 140 ? 10 : 0);
      if (s.listField === "stats") score -= 30;
      if (s.listField === "steps" || s.listField === "terms") score -= 15;
      return score;
    },
    build: (content, ctx) => {
      const k = createKit(content, ctx);
      k.decorate();
      const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.18, titleMaxH: k.safe.h * 0.3 });
      const source = listSource(content);
      if (source) {
        const cols = k.landscape ? n : n === 4 ? 2 : k.square && n === 2 ? 2 : 1;
        const res = k.cards(k.below(k.safe, bottom, k.u * 5), source.entries, {
          cols,
          capacity: n,
          badge: source.entries.some((e) => e.icon) ? "icon" : "number",
          horizontal: cols === 1,
          fill: 0.72,
        });
        k.use(source.field);
        k.continueList(source.field, res.rest);
      }
      return k.done();
    },
  });
}

export const cards2 = cardsLayout(2);
export const cards3 = cardsLayout(3);
export const cards4 = cardsLayout(4);

export const conceptHeroImage = defineLayout({
  id: "concept-hero-image",
  name: "Image banner",
  kinds: ["concept", "image", "bullets"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasBody && !s.listCount) return 0;
    const base = s.kind === "concept" ? 58 : s.kind === "image" ? 46 : 30;
    return base + (s.hasImage ? 20 : -26) - (s.listCount > 4 ? 16 : 0) - (s.bodyLen > 420 ? 12 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    const imageH = Math.round(k.H * (k.landscape ? 0.48 : 0.4));
    k.image({ x: 0, y: 0, w: k.W, h: imageH });
    const top = imageH + k.u * 5;
    const area = { x: k.safe.x, y: top, w: k.safe.w, h: k.bottom - top };
    const source = listSource(content);
    if (k.landscape) {
      const left = k.col(0, 5);
      const right = k.col(6, 6);
      k.header({ x: left.x, y: top, w: left.w, h: area.h }, { titleMaxH: area.h * 0.8 });
      let y = top;
      if (content.body) y = k.paragraph({ x: right.x, y, w: right.w, h: area.h * (source ? 0.5 : 1) }, { muted: true }) + k.u * 3;
      if (source) k.list({ x: right.x, y, w: right.w, h: k.bottom - y }, source, { marker: markerFor(source), style: "small" });
    } else {
      const bottom = k.header(area, { titleMaxH: area.h * 0.3, lead: true, leadMaxH: area.h * (source ? 0.3 : 0.6) });
      if (source) k.list(k.below(area, bottom, k.u * 3), source, { marker: markerFor(source), style: "small" });
    }
    return k.done();
  },
});

export const summaryChecklist = defineLayout({
  id: "summary-checklist",
  name: "Checklist",
  kinds: ["summary", "bullets", "activity", "agenda"],
  orientation: "any",
  fit: (s) => {
    if (!s.listCount) return 0;
    return listKinds(s, { summary: 80, bullets: s.listCount >= 3 ? 30 : 14, activity: 24, agenda: 20 }, 10);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const area = k.landscape ? { ...k.safe, w: k.col(0, 10).w } : k.safe;
    const source = listSource(content);
    const bottom = k.header(area, { lead: true, leadMaxH: area.h * (source ? 0.2 : 0.6), titleMaxH: area.h * 0.32 });
    if (source) k.list(k.below(area, bottom, k.u * 4), source, { marker: "check", gapEm: 0.8 });
    return k.done();
  },
});

export const socialTip = defineLayout({
  id: "social-tip",
  name: "Tip card",
  kinds: ["bullets", "concept", "summary", "stat", "activity", "title"],
  orientation: "any",
  fit: (s, _c, ctx) => {
    const cover = !s.listCount && !s.hasBody;
    if (cover && s.kind !== "title" && s.kind !== "section") return 0;
    const base = cover ? 34 : s.listCount <= 4 && s.avgEntryChars < 110 ? 62 : 28;
    return orientationOf(ctx.width, ctx.height) === "landscape" ? base * 0.4 : base;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    const source = listSource(content);
    const w = k.safe.w;
    const blocks: StackBlock[] = [];
    const icon = knownIcon(content.icon);
    if (icon) {
      const d = Math.round(64 * k.s);
      blocks.push({ h: d, draw: (y) => k.badge(k.safe.x + d / 2, y + d / 2, d, { slot: "icon", icon, tone: "soft" }) });
    }
    if (clean(content.kicker)) {
      blocks.push({ m: k.measure({ text: clean(content.kicker), style: "label", role: "kicker", slot: "kicker", w, color: k.ink.accentSmall }), gap: k.u * 3 });
    }
    const barH = Math.max(3, Math.round(6 * k.s));
    blocks.push({
      h: barH,
      gap: k.u * 2,
      draw: (y) => k.shape({ x: k.safe.x, y, w: Math.round(64 * k.s), h: barH }, { shape: "pill", fill: k.ink.accent, slot: "accent-bar" }),
    });
    const display = k.style("display").fontSize;
    blocks.push({
      m: k.measure({ text: clean(content.title), style: "display", role: "title", slot: "title", w, maxH: k.safe.h * 0.34, maxSize: Math.round(display * 0.9) }),
      gap: k.u * 3,
    });
    if (clean(content.subtitle)) {
      blocks.push({ m: k.measure({ text: clean(content.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: k.safe.h * 0.14, ...k.mutedSpec() }), gap: k.u * 2 });
    }
    k.use("title", "kicker", "subtitle");
    if (!source) {
      if (clean(content.body)) blocks.push({ m: k.bodyBlock(w, k.safe.h * 0.4, { style: "subheading", muted: true }), gap: k.u * 4 });
      k.vstack(k.safe.x, k.safe.y, k.safe.h, blocks, "middle", 0.45);
      return k.done();
    }
    let y = k.vstack(k.safe.x, k.safe.y, k.safe.h, blocks, "top").bottom;
    if (clean(content.body)) y = k.paragraph({ x: k.safe.x, y: y + k.u * 3, w, h: (k.bottom - y) * 0.3 }, { muted: true });
    const area = k.below(k.safe, y, k.u * 4);
    const res = k.cards(area, source.entries, { cols: 1, capacity: 4, horizontal: true, badge: "number", titleStyle: "subheading", bodyStyle: "small", plainTitles: !source.entries.some((e) => e.body), fill: 0, gapY: k.u * 2 });
    k.use(source.field);
    k.continueList(source.field, res.rest);
    return k.done();
  },
});

export const LIST_LAYOUTS: LayoutDef[] = [
  agendaList,
  agendaCards,
  bulletsSimple,
  bulletsImageRight,
  bulletsImageLeft,
  bulletsIconGrid,
  cards2,
  cards3,
  cards4,
  conceptHeroImage,
  summaryChecklist,
  socialTip,
];
