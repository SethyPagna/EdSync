import type { LayoutDef } from "../scene";
import {
  clean,
  createKit,
  defineLayout,
  entriesOf,
  type Box,
  type Entry,
  type LayoutKit,
  type StackBlock,
} from "./kit";
import { textColumn } from "./lists";

type Side = "a" | "b";

export function compareEntries(side: Side, points: readonly string[] | undefined): Entry[] {
  const out: Entry[] = [];
  (points ?? []).forEach((point, j) => {
    const text = clean(point);
    if (!text) return;
    out.push({ index: j, key: `${side}-point-${j}`, title: text, slotTitle: `${side}-point-${j}`, slotBody: `${side}-point-${j}-body` });
  });
  return out;
}

/** Two comparison panels (side by side, or stacked on portrait pages). */
function comparePanels(k: LayoutKit, area: Box, opts: { vs: boolean }) {
  const cmp = k.content.compare;
  if (!cmp) return;
  const sides = (["a", "b"] as const).map((side) => ({
    side,
    label: clean(cmp[side]?.label),
    entries: compareEntries(side, cmp[side]?.points),
  }));
  const stacked = k.portrait;
  const d = Math.round(60 * k.s);
  const gap = opts.vs ? d + k.u * 2 : k.gutter;
  const boxes = stacked ? k.rows(area, 2, gap) : k.columns(area, 2, gap);
  const pad = k.pad;
  const tones = opts.vs ? (["muted", "soft"] as const) : (["default", "default"] as const);
  boxes.forEach((box, i) => k.card(box, { slot: `${sides[i].side}-card`, tone: tones[i] }));
  const barW = Math.round(40 * k.s);
  const barH = Math.max(3, Math.round(5 * k.s));
  const inner = boxes.map((b) => ({ x: b.x + pad, y: b.y + pad, w: b.w - pad * 2, h: b.h - pad * 2 }));
  const align = opts.vs && !stacked ? "center" : "left";
  const labels = sides.map((s, i) =>
    k.measure({ text: s.label, style: "heading", role: "item-title", slot: `${s.side}-label`, w: inner[i].w, maxH: inner[i].h * 0.28, align, color: "text" }),
  );
  const labelSize = Math.min(...labels.map((m) => m.fontSize));
  const listAreas: Box[] = [];
  sides.forEach((s, i) => {
    const box = inner[i];
    let y = box.y;
    const barX = align === "center" ? box.x + (box.w - barW) / 2 : box.x;
    k.shape({ x: barX, y, w: barW, h: barH }, { shape: "pill", fill: i === 0 ? "accent" : "accent2", slot: `${s.side}-bar` });
    y += barH + k.u * 2;
    const m = k.measure({ ...labels[i].spec, maxH: undefined, size: labelSize });
    k.place(m, box.x, y);
    y += m.h ? m.h + k.u * 2 : 0;
    listAreas.push({ x: box.x, y, w: box.w, h: Math.max(0, box.y + box.h - y) });
  });
  const listOpts = { marker: "dot" as const, ink: { color: "text" }, style: "body" as const };
  const scale = Math.min(...sides.map((s, i) => k.listScale(listAreas[i], s.entries, listOpts)));
  const rests: Entry[][] = [[], []];
  sides.forEach((s, i) => {
    if (!s.entries.length) return;
    k.list(listAreas[i], { field: "bullets", entries: s.entries }, { ...listOpts, maxScale: scale, onRest: (rest) => (rests[i] = rest) });
  });
  if (opts.vs) {
    const cx = stacked ? area.x + area.w / 2 : boxes[0].x + boxes[0].w + gap / 2;
    const cy = stacked ? boxes[0].y + boxes[0].h + gap / 2 : area.y + area.h / 2;
    k.badge(cx, cy, d, { slot: "vs", label: "VS", tone: "accent" });
  }
  k.use("compare");
  if (rests[0].length || rests[1].length) {
    k.continueWith({
      compare: {
        a: { label: sides[0].label, points: rests[0].map((e) => e.title) },
        b: { label: sides[1].label, points: rests[1].map((e) => e.title) },
      },
    });
  }
}

export const compareColumns = defineLayout({
  id: "compare-columns",
  name: "Two columns",
  kinds: ["compare", "concept", "bullets"],
  orientation: "any",
  fit: (s) => {
    if (!s.hasCompare) return 0;
    return (s.kind === "compare" ? 78 : 62) + (s.comparePoints > 8 ? 8 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    if (!analyzeCompare(content)) {
      textColumn(k, k.safe);
      return k.done();
    }
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.14, titleMaxH: k.safe.h * 0.26 });
    comparePanels(k, k.below(k.safe, bottom, k.u * 5), { vs: false });
    return k.done();
  },
});

export const compareVs = defineLayout({
  id: "compare-vs",
  name: "Versus",
  kinds: ["compare"],
  orientation: "any",
  fit: (s, _c, ctx) => {
    if (!s.hasCompare) return 0;
    const portrait = ctx.height > ctx.width * 1.15;
    return (s.comparePoints <= 8 ? 76 : 58) - (portrait ? 10 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    if (!analyzeCompare(content)) {
      textColumn(k, k.safe);
      return k.done();
    }
    const w = k.landscape ? k.col(1, 10).w : k.safe.w;
    const x = k.safe.x + (k.safe.w - w) / 2;
    const bottom = k.header({ x, y: k.safe.y, w, h: k.safe.h }, { align: "center", lead: true, leadMaxH: k.safe.h * 0.12, titleMaxH: k.safe.h * 0.24 });
    comparePanels(k, k.below(k.safe, bottom, k.u * 5), { vs: true });
    return k.done();
  },
});

function analyzeCompare(content: LayoutKit["content"]): boolean {
  const c = content.compare;
  return Boolean(c && (compareEntries("a", c.a?.points).length || compareEntries("b", c.b?.points).length || clean(c.a?.label) || clean(c.b?.label)));
}

export const statBig = defineLayout({
  id: "stat-big",
  name: "Big number",
  kinds: ["stat", "stats"],
  orientation: "any",
  fit: (s) => {
    if (!s.stats) return 0;
    if (s.stats === 1) return s.kind === "stat" || s.kind === "stats" ? 90 : 60;
    return s.stats === 2 ? 30 : 12;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const stats = entriesOf(content, "stats");
    const first = stats[0];
    if (!first) {
      textColumn(k, k.safe);
      return k.done();
    }
    k.use("stats");
    k.continueList("stats", stats.slice(1));
    const stat = k.style("stat");
    const valueBlocks = (w: number, maxH: number, align: "left" | "center"): StackBlock[] => {
      const blocks: StackBlock[] = [
        {
          m: k.measure({ text: first.title, style: "stat", role: "stat-value", slot: first.slotTitle, w, maxH: maxH * 0.72, maxSize: Math.round(stat.fontSize * 1.9), align, color: k.ink.accent }),
        },
      ];
      if (first.body) {
        blocks.push({
          m: k.measure({ text: first.body, style: "heading", role: "stat-label", slot: first.slotBody, w, maxH: maxH * 0.28, weight: 500, align }),
          gap: k.u * 2,
        });
      }
      return blocks;
    };
    if (k.landscape) {
      const left = k.col(0, 6);
      const right = k.col(7, 5);
      k.vstack(left.x, k.safe.y, k.safe.h, valueBlocks(left.w, k.safe.h, "left"), "middle", 0.5);
      k.vstack(right.x, k.safe.y, k.safe.h, k.headerBlocks(right.w, { titleStyle: "heading", titleMaxH: k.safe.h * 0.4, body: true, bodyMaxH: k.safe.h * 0.45, bodyStyle: "body" }), "middle", 0.5);
    } else {
      const bottom = k.header(k.safe, { align: "center", titleStyle: "heading", titleMaxH: k.safe.h * 0.22 });
      const area = k.below(k.safe, bottom, k.u * 4);
      const blocks = valueBlocks(area.w, area.h * 0.7, "center");
      if (clean(content.body)) blocks.push({ m: k.bodyBlock(area.w, area.h * 0.3, { align: "center", muted: true }), gap: k.u * 3 });
      k.vstack(area.x, area.y, area.h, blocks, "middle", 0.45);
    }
    return k.done();
  },
});

export const statsRow = defineLayout({
  id: "stats-row",
  name: "Stats row",
  kinds: ["stats", "stat"],
  orientation: "any",
  fit: (s) => {
    if (!s.stats) return 0;
    if (s.stats >= 2 && s.stats <= 4) return 86;
    if (s.stats <= 6) return 66;
    return s.stats === 1 ? 34 : 40;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const stats = entriesOf(content, "stats");
    if (!stats.length) {
      textColumn(k, k.safe);
      return k.done();
    }
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.18, titleMaxH: k.safe.h * 0.28 });
    const per = stats.length <= 6 ? stats.length : Math.ceil(stats.length / Math.ceil(stats.length / 6));
    const shown = stats.slice(0, per);
    const n = shown.length;
    const cols = k.landscape ? (n <= 4 ? n : 3) : k.square ? (n <= 2 ? n : 2) : n <= 3 ? 1 : 2;
    const rowsCount = Math.ceil(n / cols);
    const area = k.below(k.safe, bottom, k.u * 5);
    const gap = k.gutter;
    const cellW = (area.w - gap * (cols - 1)) / cols;
    const cellH = (area.h - gap * (rowsCount - 1)) / rowsCount;
    const pad = Math.round(Math.min(k.pad * 1.2, cellW * 0.12));
    const innerW = cellW - pad * 2;
    const barW = Math.round(36 * k.s);
    const barH = Math.max(3, Math.round(5 * k.s));
    const stat = k.style("stat");
    const horizontal = cols === 1;
    const valueW = horizontal ? innerW * 0.42 : innerW;
    const labelW = horizontal ? innerW - valueW - k.u * 2 : innerW;
    const oneLine = stat.fontSize * stat.lineHeight * 1.1;
    const valueMaxH = Math.min(oneLine, horizontal ? cellH - pad * 2 : (cellH - pad * 2 - barH - k.u * 2) * 0.55);
    const valueSize = Math.min(
      ...shown.map((e) => k.measure({ text: e.title, style: "stat", role: "stat-value", w: valueW, maxH: valueMaxH, maxSize: stat.fontSize }).fontSize),
    );
    const labelMaxH = horizontal ? cellH - pad * 2 : cellH - pad * 2 - barH - k.u * 3 - valueSize * stat.lineHeight;
    const labelled = shown.filter((e) => e.body);
    const labelSize = labelled.length
      ? Math.min(...labelled.map((e) => k.measure({ text: e.body ?? "", style: "body", role: "stat-label", w: labelW, maxH: labelMaxH }).fontSize))
      : k.style("body").fontSize;
    const measured = shown.map((e) => ({
      e,
      value: k.measure({ text: e.title, style: "stat", role: "stat-value", slot: e.slotTitle, w: valueW, size: valueSize, color: "accent" }),
      label: k.measure({ text: e.body ?? "", style: "body", role: "stat-label", slot: e.slotBody, w: labelW, size: labelSize, color: "muted" }),
    }));
    const natural = Math.max(
      ...measured.map(({ value, label }) =>
        horizontal ? Math.max(value.h, label.h) + pad * 2 : pad * 2 + barH + k.u * 2 + value.h + (label.h ? k.u + label.h : 0),
      ),
    );
    const h = Math.min(cellH, Math.max(natural, cellH * (horizontal ? 0.5 : 0.62)));
    measured.forEach(({ e, value, label }, i) => {
      const box = { x: area.x + (i % cols) * (cellW + gap), y: area.y + Math.floor(i / cols) * (h + gap), w: cellW, h };
      const group = k.ctx.newId();
      k.card(box, { slot: `${e.key}-card`, group });
      if (horizontal) {
        const cy = box.y + box.h / 2;
        k.place(value, box.x + pad, cy - value.h / 2, { group });
        k.place(label, box.x + pad + valueW + k.u * 2, cy - label.h / 2, { group });
        return;
      }
      let y = box.y + pad;
      k.shape({ x: box.x + pad, y, w: barW, h: barH }, { shape: "pill", fill: "accent", slot: `${e.key}-bar`, group });
      y += barH + k.u * 2;
      k.place(value, box.x + pad, y, { group });
      y += value.h + k.u;
      k.place(label, box.x + pad, y, { group });
    });
    k.use("stats");
    k.continueList("stats", stats.slice(per));
    return k.done();
  },
});

export const COMPARE_LAYOUTS: LayoutDef[] = [compareColumns, compareVs, statBig, statsRow];
