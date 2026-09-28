import { splitTextToFit, splitToFit } from "../fit";
import type { LayoutDef, TextStyleToken } from "../scene";
import {
  createKit,
  defineLayout,
  listSource,
  splitLabel,
  type Box,
  type Entry,
  type LayoutKit,
  type ListSource,
} from "./kit";

/** Timeline entries: items keep title/body; "1905: text" strings split into date + text. */
export function timelineSource(content: LayoutKit["content"]): ListSource | null {
  const source = listSource(content, ["items", "steps", "bullets"]);
  if (!source) return null;
  return {
    field: source.field,
    entries: source.entries.map((e) => {
      if (e.body) return e;
      const parts = splitLabel(e.title);
      return parts ? { ...e, title: parts[0], body: parts[1] } : e;
    }),
  };
}

/** Balanced page capacity: 7 entries at 5 per page become 4 + 3. */
export function balanced(count: number, max: number): number {
  if (count <= max) return count;
  return Math.ceil(count / Math.ceil(count / max));
}

export interface LabelRowsOptions {
  /** Width of the left (label/date/cue) column; 0 = no left column. */
  leftW: number;
  leftStyle?: TextStyleToken;
  rightStyle?: TextStyleToken;
  /** Dots on a vertical axis between the columns. */
  axis?: boolean;
  /** Hairlines between rows. */
  separators?: boolean;
  /** Keep base type size (documents). */
  fixed?: boolean;
  gapEm?: number;
}

/**
 * Two-column rows: entry title on the left (date, cue, term), body on the right.
 * Entries without a body put their text on the right. Rows that do not fit continue.
 */
export function labelRows(k: LayoutKit, area: Box, source: ListSource, opts: LabelRowsOptions): { bottom: number; rest: Entry[] } {
  const leftTok = opts.leftStyle ?? "subheading";
  const rightTok = opts.rightStyle ?? "body";
  const left = k.style(leftTok);
  const right = k.style(rightTok);
  const dot = opts.axis ? Math.round(14 * k.s) : 0;
  const colGap = k.u * 2.5;
  const axisX = area.x + (opts.leftW ? opts.leftW + colGap : 0) + dot / 2;
  const textX = opts.axis ? axisX + dot / 2 + colGap : area.x + (opts.leftW ? opts.leftW + colGap : 0);
  const textW = Math.max(k.u * 8, area.x + area.w - textX);
  const gapEm = opts.gapEm ?? (opts.separators ? 1.4 : 1.1);
  // Largest left size at which no label word breaks mid-word in the narrow left column.
  const labels = opts.leftW ? source.entries.filter((e) => e.body).map((e) => e.title) : [];
  let leftCap = Infinity;
  if (labels.length) {
    leftCap = Math.round(left.minSize);
    for (let size = Math.round(left.fontSize * k.growLimit()); size > left.minSize; size -= 1) {
      if (labels.every((label) => k.wordsFit(label, leftTok, opts.leftW, size, 600))) {
        leftCap = size;
        break;
      }
    }
  }
  const sizes = (scale: number) => ({
    left: Math.max(left.minSize, Math.min(leftCap, Math.round(left.fontSize * scale))),
    right: Math.max(right.minSize, Math.round(right.fontSize * scale)),
  });
  const parts = (e: Entry) =>
    opts.leftW && e.body
      ? { l: e.title, r: e.body, lSlot: e.slotTitle, rSlot: e.slotBody }
      : { l: "", r: e.body ? `${e.title}: ${e.body}` : e.title, lSlot: e.slotTitle, rSlot: e.slotTitle };
  const rowH = (e: Entry, scale: number) => {
    const s = sizes(scale);
    const p = parts(e);
    const lh = opts.leftW ? k.textHeight(p.l, leftTok, opts.leftW, s.left, 600) : 0;
    return Math.max(lh, k.textHeight(p.r, rightTok, textW, s.right), dot);
  };
  const minScale = opts.fixed ? 1 : Math.max(left.minSize / left.fontSize, right.minSize / right.fontSize);
  const heightAt = (list: Entry[], scale: number) =>
    list.reduce((sum, e) => sum + rowH(e, scale), 0) + Math.max(0, list.length - 1) * gapEm * sizes(scale).right;
  const boost = opts.fixed ? 1 : k.growScale((b) => heightAt(source.entries, b), area.h);
  const split = boost > 1 ? { fit: source.entries, rest: [] as Entry[], scale: boost } : splitToFit(source.entries, heightAt, area.h, minScale, 0.04, !opts.fixed);
  const sz = sizes(split.scale);
  let fit = split.fit;
  let rest = split.rest;
  if (fit.length === 1 && rowH(fit[0], split.scale) > area.h + 0.5) {
    const e = fit[0];
    const p = parts(e);
    const part = splitTextToFit(p.r, { ...right, fontSize: sz.right, minSize: sz.right }, textW, area.h, k.ctx.measure);
    if (part.rest) {
      if (opts.leftW && e.body) {
        fit = [{ ...e, body: part.fit }];
        rest = [{ ...e, body: part.rest }, ...rest];
      } else {
        fit = [{ ...e, title: part.fit, body: undefined }];
        rest = [{ ...e, title: part.rest, body: undefined }, ...rest];
      }
    }
  }
  const mark = k.mark();
  const dots: number[] = [];
  let y = area.y;
  fit.forEach((e, i) => {
    const group = k.ctx.newId();
    const p = parts(e);
    const lineH = sz.right * right.lineHeight;
    if (opts.separators && i > 0) k.rule({ x: area.x, y: y - (gapEm * sz.right) / 2, w: area.w, h: k.hairline() }, "border", `${e.key}-rule`, group);
    if (p.l) {
      k.text({ text: p.l, style: leftTok, role: "item-title", slot: p.lSlot, w: opts.leftW, size: sz.left, weight: 600, align: opts.axis ? "right" : "left", color: k.ink.accent }, area.x, y, { group });
    }
    k.text({ text: p.r, style: rightTok, role: p.l ? "item-body" : "bullet", slot: p.rSlot, w: textW, size: sz.right }, textX, y, { group });
    if (opts.axis) {
      const cy = y + lineH / 2;
      dots.push(cy);
      k.shape({ x: axisX - dot / 2, y: cy - dot / 2, w: dot, h: dot }, { shape: "circle", fill: "accent", stroke: "bg", strokeWidth: Math.max(2, Math.round(3 * k.s)), slot: `${e.key}-marker`, group });
    }
    y += rowH(e, split.scale);
    if (i < fit.length - 1) y += gapEm * sz.right;
  });
  if (opts.axis && dots.length > 1) {
    const t = Math.max(2, Math.round(2 * k.s));
    const line = k.rule({ x: axisX - t / 2, y: dots[0], w: t, h: dots[dots.length - 1] - dots[0] }, "border", "axis");
    k.sendBehind(line, mark);
  }
  return { bottom: y, rest };
}

/** Header on the left third (landscape) or on top; returns the remaining content area. */
function sideHeader(k: LayoutKit, leadShare = 0.3): Box {
  if (k.landscape) {
    const left = k.col(0, 4);
    const right = k.col(5, 7);
    k.header({ x: left.x, y: k.safe.y, w: left.w, h: k.safe.h }, { titleMaxH: k.safe.h * 0.5, lead: true, leadMaxH: k.safe.h * leadShare });
    return { x: right.x, y: k.safe.y, w: right.w, h: k.safe.h };
  }
  const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.18, titleMaxH: k.safe.h * 0.28 });
  return k.below(k.safe, bottom, k.u * 4);
}

const sequenceOrder = ["steps", "items", "bullets"] as const;

export const stepsHorizontal = defineLayout({
  id: "steps-horizontal",
  name: "Steps across",
  kinds: ["steps", "timeline", "activity", "agenda"],
  orientation: "landscape",
  fit: (s) => {
    const n = s.steps || (s.kind === "steps" ? s.listCount : 0);
    if (!n) return s.kind === "activity" && s.listCount >= 2 && s.listCount <= 5 ? 26 : 0;
    const base = n >= 2 && n <= 5 ? 80 : n <= 8 ? 50 : 24;
    return base - (s.avgEntryChars > 150 ? 24 : s.avgEntryChars > 100 ? 8 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.16, titleMaxH: k.safe.h * 0.28 });
    const source = listSource(content, sequenceOrder);
    if (source) {
      const per = balanced(source.entries.length, 5);
      const rich = source.entries.some((e) => e.body);
      const mark = k.mark();
      const res = k.cards(k.below(k.safe, bottom, k.u * 6), source.entries, {
        cols: per,
        capacity: per,
        bare: true,
        badge: "number",
        badgeTone: "accent",
        titleStyle: rich ? "subheading" : "body",
        bodyStyle: "small",
        plainTitles: !rich,
        gapX: Math.round(k.gutter * 1.5),
        fill: 0,
        valign: "middle",
      });
      if (res.boxes.length > 1) {
        const first = res.boxes[0];
        const last = res.boxes[res.boxes.length - 1];
        const t = Math.max(2, Math.round(2 * k.s));
        const line = k.rule({ x: first.x + res.badge / 2, y: first.y + res.badge / 2 - t / 2, w: last.x - first.x, h: t }, "border", "connector");
        k.sendBehind(line, mark);
      }
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

export const stepsVertical = defineLayout({
  id: "steps-vertical",
  name: "Numbered steps",
  kinds: ["steps", "activity", "timeline", "agenda"],
  orientation: "any",
  fit: (s, _c, ctx) => {
    const n = s.steps || (s.kind === "steps" ? s.listCount : 0);
    if (!n) return s.kind === "activity" && s.listCount ? 30 : 0;
    const portrait = ctx.height > ctx.width * 1.15;
    return (n <= 7 ? 70 : 56) + (portrait ? 14 : 0) + (s.avgEntryChars > 120 ? 6 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const area = sideHeader(k);
    const source = listSource(content, sequenceOrder);
    if (source) {
      const mark = k.mark();
      const res = k.list(area, source, { marker: "number", gapEm: source.entries.some((e) => e.body) ? 1.1 : 0.95 });
      if (res.markers.length > 1) {
        const a = res.markers[0];
        const b = res.markers[res.markers.length - 1];
        const t = Math.max(2, Math.round(2 * k.s));
        const line = k.rule({ x: a.cx - t / 2, y: a.cy, w: t, h: b.cy - a.cy }, "border", "connector");
        k.sendBehind(line, mark);
      }
    }
    return k.done();
  },
});

export const timelineHorizontal = defineLayout({
  id: "timeline-horizontal",
  name: "Timeline across",
  kinds: ["timeline", "steps"],
  orientation: "landscape",
  fit: (s, c) => {
    if (!s.listCount) return 0;
    const dated = (timelineSource(c)?.entries ?? []).filter((e) => e.body && e.title.length <= 24).length;
    const n = s.listCount;
    let base = s.kind === "timeline" ? (n >= 3 && n <= 6 ? 84 : 58) : dated >= Math.max(2, n - 1) ? 44 : 0;
    if (s.avgEntryChars > 160) base -= 20;
    return base;
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const bottom = k.header(k.safe, { lead: true, leadMaxH: k.safe.h * 0.14, titleMaxH: k.safe.h * 0.26 });
    const source = timelineSource(content);
    if (source) {
      const per = balanced(source.entries.length, 6);
      const rich = source.entries.some((e) => e.body);
      const area = k.below(k.safe, bottom, k.u * 6);
      const dot = Math.round(18 * k.s);
      const t = Math.max(2, Math.round(3 * k.s));
      const res = k.cards(k.below(area, area.y + dot, k.u * 3), source.entries, {
        cols: per,
        capacity: per,
        bare: true,
        badge: "none",
        titleStyle: rich ? "heading" : "body",
        bodyStyle: "small",
        accentTitles: rich,
        plainTitles: !rich,
        fill: 0,
        valign: "middle",
      });
      if (res.boxes.length) {
        const axisY = res.boxes[0].y - k.u * 3 - dot / 2;
        k.rule({ x: area.x, y: axisY - t / 2, w: area.w, h: t }, "border", "axis");
        res.boxes.forEach((box, i) => {
          const e = source.entries[i];
          k.shape({ x: box.x, y: axisY - dot / 2, w: dot, h: dot }, { shape: "circle", fill: "accent", stroke: "bg", strokeWidth: Math.max(2, Math.round(3 * k.s)), slot: `${e.key}-marker` });
        });
      }
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

export const timelineVertical = defineLayout({
  id: "timeline-vertical",
  name: "Timeline",
  kinds: ["timeline", "steps", "agenda"],
  orientation: "any",
  fit: (s, _c, ctx) => {
    if (!s.listCount) return 0;
    const portrait = ctx.height > ctx.width * 1.15;
    const base = s.kind === "timeline" ? 74 : s.kind === "steps" ? 30 : 20;
    return base + (portrait ? 14 : 0) + (s.listCount > 6 ? 6 : 0);
  },
  build: (content, ctx) => {
    const k = createKit(content, ctx);
    k.decorate();
    const area = sideHeader(k);
    const source = timelineSource(content);
    if (source) {
      const rich = source.entries.some((e) => e.body);
      const res = labelRows(k, area, source, { leftW: rich ? Math.round(Math.min(area.w * 0.28, 210 * k.s)) : 0, axis: true });
      k.use(source.field);
      k.continueList(source.field, res.rest);
    }
    return k.done();
  },
});

export const SEQUENCE_LAYOUTS: LayoutDef[] = [stepsHorizontal, stepsVertical, timelineHorizontal, timelineVertical];
