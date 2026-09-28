import type { ContentItem, LayoutDef } from "../scene";
import { clean, createKit, defineLayout, entriesToField, listSource, type Box, type Entry, type LayoutKit, type ListField } from "./kit";
import { compareEntries } from "./compare";

/* ---------------- mind map ---------------- */

/** List fields a mind map draws as branches, in the order it looks for them. */
const MINDMAP_FIELDS: readonly ListField[] = ["items", "bullets", "terms", "steps"];

function nodeHeight(k: LayoutKit, e: Entry, innerW: number, pad: number, rich: boolean): number {
  const title = k.textHeight(e.title, "subheading", innerW, undefined, rich ? 600 : undefined);
  const body = e.body ? k.style("small").fontSize * 0.5 + k.textHeight(e.body, "small", innerW) : 0;
  return title + body + pad * 2;
}

export const mindmap = defineLayout({
  id: "mindmap",
  name: "Mind map",
  kinds: ["concept", "bullets", "summary", "agenda"],
  orientation: "any",
  deckKinds: { design: 1.2 },
  fit: (s, c, ctx) => {
    const count = listSource(c, MINDMAP_FIELDS)?.entries.length ?? 0;
    if (count < 3) return 0;
    const portrait = ctx.height > ctx.width * 1.15;
    let base = count <= 8 && s.avgEntryChars <= 70 ? (s.kind === "concept" ? 64 : 48) : 18;
    if (s.hasBody) base -= 12;
    return portrait ? base * 0.6 : base;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    let top = k.safe.y;
    if (clean(content.kicker)) {
      const m = k.text({ text: clean(content.kicker), style: "label", role: "kicker", slot: "kicker", w: k.safe.w, color: k.ink.accentSmall }, k.safe.x, top);
      top += m.h + k.u * 2;
    }
    let bottom = k.bottom;
    if (clean(content.body)) {
      const m = k.bodyBlock(k.safe.w, k.safe.h * 0.14, { style: "small", align: "center", muted: true });
      bottom -= m.h;
      k.place(m, k.safe.x, bottom);
      bottom -= k.u * 3;
    }
    const area: Box = { x: k.safe.x, y: top, w: k.safe.w, h: bottom - top };
    const source = listSource(content, MINDMAP_FIELDS);
    const entries = source?.entries ?? [];
    const n = Math.min(entries.length, 8);
    const leftN = Math.ceil(n / 2);
    const sides = [entries.slice(0, leftN), entries.slice(leftN, n)];
    const rich = entries.some((e) => e.body);
    const centerW = Math.round(area.w * (k.landscape ? 0.26 : 0.32));
    const link = Math.round(area.w * (k.landscape ? 0.06 : 0.04));
    const sideW = (area.w - centerW - link * 2) / 2;
    const cpad = Math.round(k.pad * 1.1);
    const title = k.measure({ text: clean(content.title), style: "heading", role: "title", slot: "title", w: centerW - cpad * 2, maxH: area.h * 0.4, align: "center", color: "onAccent" });
    const sub = k.measure({ text: clean(content.subtitle), style: "small", role: "subtitle", slot: "subtitle", w: centerW - cpad * 2, maxH: area.h * 0.16, align: "center", color: "onAccent", opacity: 0.85 });
    const centerH = Math.max(title.h + (sub.h ? sub.h + k.u : 0) + cpad * 2, Math.round(84 * k.s));
    const center = { x: area.x + sideW + link, y: area.y + (area.h - centerH) / 2, w: centerW, h: centerH };
    k.shape(center, { shape: "rounded", radius: Math.max(k.radius, Math.round(18 * k.s)), fill: "accent", role: "card", slot: "center" });
    k.vstack(center.x + cpad, center.y + cpad, centerH - cpad * 2, [{ m: title }, { m: sub, gap: k.u }], "middle");
    k.use("title", "kicker", "subtitle");
    const t = Math.max(2, Math.round(2.5 * k.s));
    const rest: Entry[] = entries.slice(n);
    sides.forEach((list, side) => {
      if (!list.length) return;
      const pad = Math.round(Math.min(k.pad, sideW * 0.1));
      const gap = k.u * 2;
      const maxNode = (area.h - gap * (list.length - 1)) / list.length;
      const nodeH = Math.min(maxNode, Math.max(Math.round(64 * k.s), ...list.map((e) => nodeHeight(k, e, sideW - pad * 2, pad, rich))));
      const sideH = nodeH * list.length + gap * (list.length - 1);
      const x = side === 0 ? area.x : center.x + center.w + link;
      const res = k.cards({ x, y: area.y + (area.h - sideH) / 2, w: sideW, h: sideH }, list, {
        cols: 1,
        badge: "none",
        tone: "soft",
        titleStyle: "subheading",
        bodyStyle: "small",
        plainTitles: !rich,
        fill: 1,
        gapY: gap,
      });
      rest.push(...res.rest);
      const cy = center.y + center.h / 2;
      const cEdge = side === 0 ? center.x : center.x + center.w;
      res.boxes.forEach((box, i) => {
        const e = list[i];
        const nEdge = side === 0 ? box.x + box.w : box.x;
        const ny = box.y + box.h / 2;
        const mid = (nEdge + cEdge) / 2;
        const spec = { fill: "accent", opacity: 0.5, role: "line" as const };
        const x0 = Math.min(nEdge, mid);
        k.shape({ x: x0, y: ny - t / 2, w: Math.abs(mid - nEdge) + t / 2, h: t }, { ...spec, slot: `${e.key}-link-0` });
        if (Math.abs(ny - cy) > t) k.shape({ x: mid - t / 2, y: Math.min(ny, cy) - t / 2, w: t, h: Math.abs(ny - cy) + t }, { ...spec, slot: `${e.key}-link-1` });
      });
      if (res.boxes.length) {
        const mid = ((side === 0 ? res.boxes[0].x + res.boxes[0].w : res.boxes[0].x) + cEdge) / 2;
        k.shape({ x: Math.min(mid, cEdge), y: cy - t / 2, w: Math.abs(cEdge - mid), h: t }, { fill: "accent", opacity: 0.5, role: "line", slot: `link-${side === 0 ? "left" : "right"}` });
      }
    });
    if (source) {
      k.use(source.field);
      k.continueList(source.field, rest.sort((a, b) => a.index - b.index));
    }
    return k.done();
  },
});

/* ---------------- kanban ---------------- */

interface Note {
  text: string;
  slot: string;
  index: number;
}

interface Column {
  key: string;
  label: string;
  labelSlot: string;
  notes: Note[];
}

export function splitNotes(text: string | undefined): string[] {
  return clean(text)
    .split(/\r?\n|;\s*|\s+•\s+/)
    .map((part) => part.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function kanbanColumns(k: LayoutKit): { columns: Column[]; mode: "items" | "compare" | "bullets" } {
  const c = k.content;
  const items = (c.items ?? []).map((item, i) => ({ item, i })).filter(({ item }) => clean(item?.title) || clean(item?.body));
  if (items.length) {
    return {
      mode: "items",
      columns: items.slice(0, 4).map(({ item, i }) => ({
        key: `item-${i}`,
        label: clean(item.title),
        labelSlot: `item-${i}-title`,
        notes: splitNotes(item.body).map((text, j) => ({ text, slot: `item-${i}-body-${j}`, index: j })),
      })),
    };
  }
  if (c.compare) {
    return {
      mode: "compare",
      columns: (["a", "b"] as const).map((side) => ({
        key: side,
        label: clean(c.compare?.[side]?.label),
        labelSlot: `${side}-label`,
        notes: compareEntries(side, c.compare?.[side]?.points).map((e) => ({ text: e.title, slot: e.slotTitle, index: e.index })),
      })),
    };
  }
  const source = listSource(c, ["bullets", "steps"]);
  const entries = source?.entries ?? [];
  const count = Math.min(3, Math.max(1, Math.ceil(entries.length / 3)));
  const columns: Column[] = Array.from({ length: count }, (_, i) => ({ key: `col-${i}`, label: "", labelSlot: `col-${i}-label`, notes: [] }));
  entries.forEach((e, i) => columns[i % count].notes.push({ text: e.body ? `${e.title}: ${e.body}` : e.title, slot: e.slotTitle, index: e.index }));
  return { mode: "bullets", columns };
}

export const kanbanBoard = defineLayout({
  id: "kanban-board",
  name: "Board",
  kinds: ["activity", "steps", "summary", "compare"],
  orientation: "landscape",
  deckKinds: { design: 1.3 },
  fit: (s, content) => {
    const noted = (content.items ?? []).filter((item) => splitNotes(item?.body).length >= 2).length;
    if (s.items >= 2 && s.items <= 4 && noted >= 2) return 74;
    if (s.hasCompare) return 28;
    if (s.kind === "activity" && s.items >= 2) return 34;
    return s.bullets >= 6 && s.avgEntryChars < 60 ? 16 : 0;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.12, titleMaxH: k.safe.h * 0.22 });
    const area = k.below(k.safe, bottom, k.u * 4);
    const { columns, mode } = kanbanColumns(k);
    const cols = k.columns(area, Math.max(1, columns.length), k.gutter * 0.75);
    const pad = Math.round(k.pad * 0.7);
    const noteGap = k.u * 1.5;
    const label = k.style("subheading");
    const note = k.style("small");
    const labelSize = Math.min(...columns.map((col, i) => k.measure({ text: col.label, style: "subheading", role: "item-title", w: cols[i].w - pad * 2, maxH: area.h * 0.18, weight: 600 }).fontSize), label.fontSize);
    const labelH = (col: Column, i: number) => (col.label ? k.textHeight(col.label, "subheading", cols[i].w - pad * 2, labelSize, 600) + k.u * 2 : 0);
    const noteH = (text: string, w: number, size: number) => k.textHeight(text, "small", w, size) + pad * 1.4;
    const columnH = (col: Column, i: number, size: number, notes = col.notes) =>
      pad * 2 + labelH(col, i) + notes.reduce((sum, n) => sum + noteH(n.text, cols[i].w - pad * 3.4, size), 0) + Math.max(0, notes.length - 1) * noteGap;
    let size = note.fontSize;
    while (size > note.minSize && columns.some((col, i) => columnH(col, i, size) > area.h)) size -= 1;
    const rests: Note[][] = columns.map(() => []);
    columns.forEach((col, i) => {
      const box = cols[i];
      const group = ctx.newId();
      k.card(box, { slot: `${col.key}-column`, tone: "muted", group });
      let y = box.y + pad;
      if (col.label) {
        const m = k.text({ text: col.label, style: "subheading", role: "item-title", slot: col.labelSlot, w: box.w - pad * 2, size: labelSize, weight: 600, color: "text" }, box.x + pad, y, { group });
        y += m.h + k.u * 2;
      }
      col.notes.forEach((n, j) => {
        const h = noteH(n.text, box.w - pad * 3.4, size);
        if (j > 0 && y + h > box.y + box.h - pad + 0.5) {
          rests[i].push(n);
          return;
        }
        if (rests[i].length) {
          rests[i].push(n);
          return;
        }
        const noteBox = { x: box.x + pad, y, w: box.w - pad * 2, h };
        k.card(noteBox, { slot: `${n.slot}-card`, tone: "plain", radius: Math.round(k.radius * 0.6), group });
        k.text({ text: n.text, style: "small", role: "item-body", slot: n.slot, w: noteBox.w - pad * 1.4, size, color: "text" }, noteBox.x + pad * 0.7, y + pad * 0.7, { group });
        y += h + noteGap;
      });
    });
    if (mode === "items") {
      k.use("items");
      const all = content.items ?? [];
      const shownKeys = new Set(columns.map((col) => col.key));
      const restItems: ContentItem[] = [];
      columns.forEach((col, i) => {
        if (!rests[i].length) return;
        const item = all[Number(col.key.slice(5))];
        restItems.push({ ...item, body: rests[i].map((n) => n.text).join("\n") });
      });
      all.forEach((item, i) => {
        if (!shownKeys.has(`item-${i}`) && (clean(item?.title) || clean(item?.body))) restItems.push(item);
      });
      if (restItems.length) k.continueWith({ items: restItems });
    } else if (mode === "compare") {
      k.use("compare");
      if (rests.some((r) => r.length)) {
        k.continueWith({
          compare: {
            a: { label: columns[0].label, points: rests[0].map((n) => n.text) },
            b: { label: columns[1].label, points: rests[1].map((n) => n.text) },
          },
        });
      }
    } else {
      const source = listSource(content, ["bullets", "steps"]);
      if (source) {
        k.use(source.field);
        const restIdx = new Set(rests.flat().map((n) => n.index));
        const rest = source.entries.filter((e) => restIdx.has(e.index));
        if (rest.length) k.continueWith(entriesToField(source.field, rest));
      }
    }
    return k.done();
  },
});

/* ---------------- SWOT ---------------- */

const SWOT = /strength|weakness|opportunit|threat|fortal|debilid|oportunid|amenaz|forces|faiblesse|menace/i;

export const swotGrid = defineLayout({
  id: "swot-grid",
  name: "2 × 2 grid",
  kinds: ["compare", "concept", "summary"],
  orientation: "any",
  fit: (s, content) => {
    if (s.items !== 4) return 0;
    const swot = (content.items ?? []).filter((item) => SWOT.test(item?.title ?? "")).length;
    return swot >= 3 ? 96 : s.itemBodies >= 4 ? 36 : 20;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.12, titleMaxH: k.safe.h * 0.22 });
    const source = listSource(content, ["items", "bullets", "terms"]);
    if (source) {
      const tones = ["soft", "muted", "muted", "soft"] as const;
      const res = k.cards(k.below(k.safe, bottom, k.u * 4), source.entries, {
        cols: 2,
        capacity: 4,
        badge: "letter",
        badgeLabel: (e) => (e.title.trim().charAt(0) || "•").toUpperCase(),
        badgeTone: "accent",
        horizontal: false,
        titleStyle: "subheading",
        bodyStyle: "small",
        tone: (i) => tones[i % 4],
        fill: 1,
        gapX: k.u * 2,
        gapY: k.u * 2,
      });
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

export const BOARD_LAYOUTS: LayoutDef[] = [mindmap, kanbanBoard, swotGrid];
