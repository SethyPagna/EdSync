import type { LayoutDef } from "../scene";
import { clean, createKit, defineLayout, listSource, type LayoutKit, type StackBlock } from "./kit";

/** Kicker / accent bar / title / subtitle / body blocks for centered or stacked hero pages. */
function heroBlocks(
  k: LayoutKit,
  w: number,
  opts: {
    align: "left" | "center";
    titleMaxH: number;
    titleMaxSize?: number;
    bar?: boolean;
    ink?: { text: string; muted: { color: string; opacity?: number }; accent: string };
    bodyMaxH?: number;
  },
): StackBlock[] {
  const c = k.content;
  const ink = opts.ink ?? { text: k.ink.text, muted: k.ink.muted, accent: k.ink.accent };
  const blocks: StackBlock[] = [];
  if (clean(c.kicker)) {
    blocks.push({ m: k.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, align: opts.align, color: opts.ink ? ink.accent : k.ink.accentSmall }) });
  }
  if (opts.bar) {
    const barW = Math.round(56 * k.s);
    const barH = Math.max(3, Math.round(5 * k.s));
    blocks.push({
      h: barH,
      gap: k.u * 2.5,
      draw: (y) => {
        const x = opts.align === "center" ? k.safe.x + (k.safe.w - barW) / 2 : k.safe.x;
        k.shape({ x, y, w: barW, h: barH }, { shape: "pill", fill: ink.accent, slot: "accent-bar" });
      },
    });
  }
  blocks.push({
    m: k.measure({ text: clean(c.title), style: "display", role: "title", slot: "title", w, maxH: opts.titleMaxH, maxSize: opts.titleMaxSize, align: opts.align, color: ink.text }),
    gap: k.u * 3,
  });
  if (clean(c.subtitle)) {
    blocks.push({
      m: k.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: k.safe.h * 0.2, align: opts.align, color: ink.muted.color, opacity: ink.muted.opacity }),
      gap: k.u * 2.5,
    });
  }
  if (clean(c.body)) {
    blocks.push({ m: k.bodyBlock(w, opts.bodyMaxH ?? k.safe.h * 0.2, { style: "body", align: opts.align, ink: ink.muted }), gap: k.u * 2.5 });
  }
  k.use("title", "kicker", "subtitle");
  return blocks;
}

const heroKinds = ["title", "section", "closing"] as const;

export const titleCenter = defineLayout({
  id: "title-center",
  name: "Centered title",
  kinds: ["title", "closing", "section"],
  orientation: "any",
  fit: (s) => {
    const base = s.kind === "title" ? 72 : s.kind === "closing" ? 46 : s.kind === "section" ? 36 : 0;
    return base - (s.hasImage ? 14 : 0) - (s.titleLen > 90 ? 10 : 0) - (s.listCount ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const x = k.safe.x + (k.safe.w - w) / 2;
    k.vstack(x, k.safe.y, k.safe.h, heroBlocks(k, w, { align: "center", titleMaxH: k.safe.h * 0.5, bar: true }), "middle", 0.46);
    return k.done();
  },
});

export const titleLeftImage = defineLayout({
  id: "title-left-image",
  name: "Title with image",
  kinds: ["title", "section", "closing"],
  orientation: "any",
  fit: (s) => {
    if (!heroKinds.includes(s.kind as (typeof heroKinds)[number])) return 0;
    const base = s.kind === "title" ? 50 : 24;
    return base + (s.hasImage ? 32 : 0) - (s.listCount ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    if (k.landscape) {
      const split = Math.round(k.W * 0.5);
      k.image({ x: split, y: 0, w: k.W - split, h: k.H });
      const w = split - k.safe.x - k.gutter * 2;
      k.vstack(k.safe.x, k.safe.y, k.safe.h, heroBlocks(k, w, { align: "left", titleMaxH: k.safe.h * 0.55, bar: true }), "middle", 0.5);
    } else {
      const imageH = Math.round(k.H * 0.46);
      k.image({ x: 0, y: 0, w: k.W, h: imageH });
      const top = imageH + k.u * 5;
      k.vstack(k.safe.x, top, k.bottom - top, heroBlocks(k, k.safe.w, { align: "left", titleMaxH: (k.bottom - top) * 0.6 }), "middle", 0.4);
    }
    return k.done();
  },
});

export const titleSplitBand = defineLayout({
  id: "title-split-band",
  name: "Color band title",
  kinds: ["title", "section", "closing"],
  orientation: "any",
  fit: (s) => {
    const base = s.kind === "title" ? 60 : s.kind === "section" ? 56 : s.kind === "closing" ? 32 : 0;
    return base - (s.titleLen > 80 ? 12 : 0) - (s.listCount ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "content");
    const bandH = Math.round(k.H * (k.landscape ? 0.6 : k.portrait ? 0.52 : 0.56));
    k.shape({ x: 0, y: 0, w: k.W, h: bandH }, { fill: "accent", slot: "band" });
    const c = content;
    const w = k.landscape ? k.col(0, 10).w : k.safe.w;
    const on = { text: "onAccent", muted: { color: "onAccent", opacity: 0.85 }, accent: "onAccent" };
    const top: StackBlock[] = [];
    if (clean(c.kicker)) {
      top.push({ m: k.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, color: "onAccent", opacity: 0.8 }) });
    }
    top.push({
      m: k.measure({ text: clean(c.title), style: "display", role: "title", slot: "title", w, maxH: (bandH - k.safe.y) * 0.72, color: on.text }),
      gap: k.u * 2,
    });
    k.vstack(k.safe.x, k.safe.y, bandH - k.safe.y - k.u * 5, top, "bottom");
    const below: StackBlock[] = [];
    if (clean(c.subtitle)) {
      below.push({ m: k.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: (k.H - bandH) * 0.4, ...k.mutedSpec() }) });
    }
    const belowTop = bandH + k.u * 5;
    if (clean(c.body)) below.push({ m: k.bodyBlock(w, Math.max(0, k.bottom - belowTop) * 0.5, { style: "small", muted: true }), gap: k.u * 1.5 });
    k.vstack(k.safe.x, belowTop, Math.max(0, k.bottom - belowTop), below, "top");
    k.use("title", "kicker", "subtitle");
    return k.done();
  },
});

export const titleBigType = defineLayout({
  id: "title-big-type",
  name: "Big type title",
  kinds: ["title", "section", "closing"],
  orientation: "any",
  fit: (s) => {
    if (!heroKinds.includes(s.kind as (typeof heroKinds)[number])) return 0;
    const short = s.titleLen <= 32 ? 1 : s.titleLen <= 56 ? 0.65 : 0.3;
    const base = s.kind === "title" ? 74 : s.kind === "section" ? 56 : 50;
    return base * short - (s.listCount ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    const c = content;
    let top = k.safe.y;
    if (clean(c.kicker)) {
      const m = k.text({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w: k.safe.w, color: k.ink.accentSmall }, k.safe.x, top);
      top += m.h + k.u * 4;
    }
    const w = k.landscape ? k.safe.w * 0.92 : k.safe.w;
    const display = k.style("display").fontSize;
    const blocks: StackBlock[] = [
      {
        h: Math.max(3, Math.round(6 * k.s)),
        draw: (y) => k.shape({ x: k.safe.x, y, w: Math.round(72 * k.s), h: Math.max(3, Math.round(6 * k.s)) }, { fill: k.ink.accent, slot: "accent-bar" }),
      },
      { m: k.measure({ text: clean(c.title), style: "display", role: "title", slot: "title", w, maxH: k.safe.h * 0.62, maxSize: Math.round(display * 1.5), lineHeight: 1 }), gap: k.u * 3 },
    ];
    if (clean(c.subtitle)) {
      blocks.push({ m: k.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w: Math.min(w, k.col(0, 8).w), maxH: k.safe.h * 0.18, ...k.mutedSpec() }), gap: k.u * 3 });
    }
    if (clean(c.body)) blocks.push({ m: k.bodyBlock(Math.min(w, k.col(0, 8).w), k.safe.h * 0.16, { style: "small", muted: true }), gap: k.u * 2 });
    k.vstack(k.safe.x, top, k.bottom - top, blocks, "bottom");
    k.use("title", "kicker", "subtitle");
    return k.done();
  },
});

function sectionNumber(k: LayoutKit): { label: string; fromKicker: boolean } {
  const kicker = clean(k.content.kicker);
  if (kicker && kicker.length <= 6) return { label: kicker, fromKicker: true };
  const count = k.ctx.recent.filter((id) => id.startsWith("section-")).length + 1;
  return { label: String(count).padStart(2, "0"), fromKicker: false };
}

export const sectionNumberLayout = defineLayout({
  id: "section-number",
  name: "Numbered section",
  kinds: ["section"],
  orientation: "any",
  fit: (s) => (s.kind === "section" ? 76 - (s.titleLen > 70 ? 18 : 0) - (s.listCount ? 20 : 0) : 0),
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    const c = content;
    const { label, fromKicker } = sectionNumber(k);
    const stat = k.style("stat").fontSize;
    const numberSpec = { text: label, style: "stat" as const, role: "number" as const, slot: "number", maxSize: Math.round(stat * 1.5), color: k.ink.accent };
    const textBlocks = (w: number): StackBlock[] => {
      const blocks: StackBlock[] = [];
      if (clean(c.kicker) && !fromKicker) blocks.push({ m: k.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, color: k.ink.accentSmall }) });
      blocks.push({ m: k.measure({ text: clean(c.title), style: "display", role: "title", slot: "title", w, maxH: k.safe.h * 0.5, maxSize: Math.round(k.style("display").fontSize * 0.9) }), gap: k.u * 2 });
      if (clean(c.subtitle)) blocks.push({ m: k.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: k.safe.h * 0.2, ...k.mutedSpec() }), gap: k.u * 2.5 });
      if (clean(c.body)) blocks.push({ m: k.bodyBlock(w, k.safe.h * 0.18, { style: "small", muted: true }), gap: k.u * 2 });
      return blocks;
    };
    if (k.landscape) {
      const left = k.col(0, 4);
      const right = k.col(5, 7);
      const number = k.measure({ ...numberSpec, w: left.w, maxH: k.safe.h * 0.6 });
      k.vstack(left.x, k.safe.y, k.safe.h, [{ m: number }], "middle", 0.5);
      const ruleH = k.safe.h * 0.42;
      k.rule({ x: k.col(4, 1).x + k.col(4, 1).w / 2, y: k.safe.y + (k.safe.h - ruleH) / 2, w: k.hairline(), h: ruleH }, "border", "divider");
      k.vstack(right.x, k.safe.y, k.safe.h, textBlocks(right.w), "middle", 0.5);
    } else {
      const number = k.measure({ ...numberSpec, w: k.safe.w, maxH: k.safe.h * 0.3 });
      const blocks: StackBlock[] = [
        { m: number },
        {
          h: k.hairline(),
          gap: k.u * 3,
          draw: (y) => k.rule({ x: k.safe.x, y, w: k.safe.w * 0.22, h: k.hairline() }, "border", "divider"),
        },
        ...textBlocks(k.safe.w).map((b, i) => (i === 0 ? { ...b, gap: k.u * 4 } : b)),
      ];
      k.vstack(k.safe.x, k.safe.y, k.safe.h, blocks, "middle", 0.45);
    }
    k.use("title", "kicker", "subtitle");
    return k.done();
  },
});

export const sectionBand = defineLayout({
  id: "section-band",
  name: "Accent section",
  kinds: ["section", "title", "closing"],
  orientation: "any",
  fit: (s) => {
    const base = s.kind === "section" ? 66 : s.kind === "closing" ? 32 : s.kind === "title" ? 26 : 0;
    return base - (s.listCount ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, { kind: "solid", color: "accent" });
    const m = Math.min(k.W, k.H);
    const ring = (d: number, x: number, y: number, slot: string) =>
      k.shape({ x, y, w: d, h: d }, { shape: "circle", stroke: "onAccent", strokeWidth: Math.max(1, Math.round(2 * k.s)), opacity: 0.2, deco: true, slot });
    if (k.landscape) {
      const d = k.H * 0.78;
      ring(d, k.W - d - k.safe.x * 0.5, (k.H - d) / 2, "deco-ring-0");
      ring(d * 0.6, k.W - d * 0.8 - k.safe.x * 0.5, (k.H - d * 0.6) / 2, "deco-ring-1");
    } else {
      const d = m * 0.5;
      ring(d, k.W - d - k.safe.x * 0.5, k.H - d - k.safe.y * 0.5, "deco-ring-0");
    }
    const w = k.landscape ? k.col(0, 9).w : k.safe.w;
    const on = { text: "onAccent", muted: { color: "onAccent", opacity: 0.85 }, accent: "onAccent" };
    k.vstack(k.safe.x, k.safe.y, k.safe.h, heroBlocks(k, w, { align: "left", titleMaxH: k.safe.h * 0.55, ink: on }), "middle", 0.5);
    return k.done();
  },
});

export const closingThanks = defineLayout({
  id: "closing-thanks",
  name: "Closing",
  kinds: ["closing"],
  orientation: "any",
  fit: (s) => (s.kind === "closing" ? 80 : s.kind === "title" ? 18 : 0),
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    k.decorate("hero");
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const x = k.safe.x + (k.safe.w - w) / 2;
    const source = listSource(content, ["bullets", "items"]);
    const listH = source ? k.safe.h * 0.26 : 0;
    const topH = k.safe.h - listH - (source ? k.u * 3 : 0);
    const display = k.style("display").fontSize;
    k.vstack(x, k.safe.y, topH, heroBlocks(k, w, { align: "center", titleMaxH: topH * 0.55, titleMaxSize: Math.round(display * 1.15), bar: true }), "middle", 0.5);
    if (source) {
      const listW = k.landscape ? k.col(3, 6).w : w;
      k.list({ x: k.safe.x + (k.safe.w - listW) / 2, y: k.bottom - listH, w: listW, h: listH }, source, { marker: "none", style: "small", align: "center", gapEm: 0.3, ink: k.ink.muted });
    }
    return k.done();
  },
});

export const certificate = defineLayout({
  id: "certificate",
  name: "Certificate",
  kinds: ["closing", "title"],
  orientation: "landscape",
  fit: (s, c) => {
    if (!heroKinds.includes(s.kind as (typeof heroKinds)[number])) return 0;
    const cue = /certif|award|diploma|recogni|achievement|completion/i.test(`${c.kicker ?? ""} ${c.title ?? ""}`);
    return cue ? 95 : 10;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "content");
    const inset = Math.round(Math.min(k.safe.x, k.safe.y) * 0.45);
    const t = Math.max(2, Math.round(3 * k.s));
    k.shape({ x: inset, y: inset, w: k.W - inset * 2, h: k.H - inset * 2 }, { stroke: "accent", strokeWidth: t, slot: "frame-outer" });
    const inner = inset + Math.round(10 * k.s);
    k.shape({ x: inner, y: inner, w: k.W - inner * 2, h: k.H - inner * 2 }, { stroke: "border", strokeWidth: k.hairline(), slot: "frame-inner" });
    const c = content;
    const source = listSource(content, ["bullets", "items"]);
    const sigs = source ? source.entries.slice(0, 3) : [];
    const sigH = Math.round(96 * k.s);
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const x = k.safe.x + (k.safe.w - w) / 2;
    const top = k.safe.y + k.u * 2;
    const bottom = k.bottom - sigH - k.u * 3;
    const blocks: StackBlock[] = [];
    if (clean(c.kicker)) blocks.push({ m: k.measure({ text: clean(c.kicker), style: "label", role: "kicker", slot: "kicker", w, align: "center", color: k.ink.accentSmall, letterSpacing: 0.16 }) });
    blocks.push({ m: k.measure({ text: clean(c.title), style: "display", role: "title", slot: "title", w, maxH: (bottom - top) * 0.45, align: "center" }), gap: k.u * 3 });
    if (clean(c.subtitle)) blocks.push({ m: k.measure({ text: clean(c.subtitle), style: "subheading", role: "subtitle", slot: "subtitle", w, maxH: (bottom - top) * 0.2, align: "center", ...k.mutedSpec() }), gap: k.u * 2.5 });
    if (clean(c.body)) blocks.push({ m: k.bodyBlock(k.landscape ? k.col(2, 8).w : w, (bottom - top) * 0.22, { style: "body", align: "center", muted: true }), gap: k.u * 2.5, x: k.landscape ? k.col(2, 8).x : x });
    k.vstack(x, top, bottom - top, blocks, "middle", 0.5);
    k.use("title", "kicker", "subtitle");
    const sealD = Math.round(72 * k.s);
    const rowY = k.bottom - sigH;
    const slots = sigs.length ? k.columns({ x: k.safe.x, y: rowY, w: k.safe.w, h: sigH }, 3, k.gutter * 2) : [];
    const order = sigs.length === 2 ? [0, 2] : sigs.length === 1 ? [0] : [0, 1, 2];
    sigs.forEach((e, i) => {
      const box = slots[order[i]];
      const lineW = box.w * 0.8;
      const lx = box.x + (box.w - lineW) / 2;
      const lineY = rowY + sigH * 0.45;
      k.rule({ x: lx, y: lineY, w: lineW, h: k.hairline() }, "text", `${e.key}-line`);
      const y = lineY + k.u * 1.5;
      const room = rowY + sigH - y;
      const name = k.text({ text: e.title, style: "caption", role: "caption", slot: e.slotTitle, w: lineW, maxH: e.body ? room / 2 : room, align: "center", ...k.mutedSpec() }, lx, y);
      if (e.body) {
        const by = y + name.h + k.u * 0.5;
        k.text({ text: e.body, style: "caption", role: "caption", slot: e.slotBody, w: lineW, maxH: rowY + sigH - by, align: "center", ...k.mutedSpec() }, lx, by);
      }
    });
    if (sigs.length !== 3) {
      const cx = k.W / 2;
      const cy = rowY + sigH * 0.45;
      k.shape({ x: cx - sealD / 2, y: cy - sealD / 2, w: sealD, h: sealD }, { shape: "circle", fill: "accentSoft", stroke: "accent", strokeWidth: Math.max(1, Math.round(2 * k.s)), slot: "seal" });
      const star = sealD * 0.52;
      k.shape({ x: cx - star / 2, y: cy - star / 2, w: star, h: star }, { shape: "star", fill: "accent", slot: "seal-star" });
    }
    if (source) {
      k.use(source.field);
      k.continueList(source.field, source.entries.slice(3));
    }
    return k.done();
  },
});

export const posterHero = defineLayout({
  id: "poster-hero",
  name: "Poster",
  kinds: ["title", "section", "closing"],
  orientation: "portrait",
  fit: (s) => {
    if (!heroKinds.includes(s.kind as (typeof heroKinds)[number])) return 0;
    const base = s.kind === "title" ? 62 : s.kind === "section" ? 48 : 40;
    return base + (s.hasImage ? 20 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx, "hero");
    const source = listSource(content, ["bullets", "items", "steps"]);
    if (k.landscape) {
      const split = Math.round(k.W * 0.5);
      k.image({ x: 0, y: 0, w: split, h: k.H });
      const x = split + k.gutter * 2;
      const w = k.right - x;
      const listH = source ? k.safe.h * 0.3 : 0;
      k.vstack(x, k.safe.y, k.safe.h - listH, heroBlocks(k, w, { align: "left", titleMaxH: k.safe.h * 0.45, bar: true }), "middle", 0.5);
      if (source) k.list({ x, y: k.bottom - listH, w, h: listH }, source, { marker: "dash", style: "small", gapEm: 0.4 });
    } else {
      const imageH = Math.round(k.H * 0.5);
      k.image({ x: 0, y: 0, w: k.W, h: imageH });
      k.shape({ x: k.safe.x, y: imageH - Math.round(4 * k.s), w: Math.round(96 * k.s), h: Math.round(8 * k.s) }, { fill: "accent", slot: "accent-bar" });
      const top = imageH + k.u * 5;
      const listH = source ? (k.bottom - top) * 0.3 : 0;
      const area = k.bottom - top - listH;
      const display = k.style("display").fontSize;
      k.vstack(k.safe.x, top, area, heroBlocks(k, k.safe.w, { align: "left", titleMaxH: area * 0.55, titleMaxSize: Math.round(display * 1.1) }), "top");
      if (source) k.list({ x: k.safe.x, y: k.bottom - listH, w: k.safe.w, h: listH }, source, { marker: "dash", style: "small", gapEm: 0.4 });
    }
    return k.done();
  },
});

export const HERO_LAYOUTS: LayoutDef[] = [
  titleCenter,
  titleLeftImage,
  titleSplitBand,
  titleBigType,
  sectionNumberLayout,
  sectionBand,
  closingThanks,
  certificate,
  posterHero,
];
