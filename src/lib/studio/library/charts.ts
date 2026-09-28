import type { ChartDatum, ChartElement } from "@/lib/studio/scene";
import { parseHex } from "./contrast";
import { mix } from "./palettes";

export type ChartKind = ChartElement["chart"];

export interface ChartColors {
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  surface2: string;
}

export interface ChartSvgOptions {
  fontFamily?: string;
}

export const CHART_KINDS: readonly { id: ChartKind; name: string }[] = [
  { id: "column", name: "Column" },
  { id: "bar", name: "Bar" },
  { id: "line", name: "Line" },
  { id: "area", name: "Area" },
  { id: "donut", name: "Donut" },
  { id: "pie", name: "Pie" },
  { id: "progress", name: "Progress" },
];

export const SAMPLE_CHART_DATA: Readonly<Record<ChartKind, readonly ChartDatum[]>> = {
  bar: [
    { label: "Reading", value: 42 },
    { label: "Math", value: 35 },
    { label: "Science", value: 28 },
    { label: "History", value: 18 },
  ],
  column: [
    { label: "Wk 1", value: 62 },
    { label: "Wk 2", value: 71 },
    { label: "Wk 3", value: 68 },
    { label: "Wk 4", value: 84 },
    { label: "Wk 5", value: 90 },
  ],
  line: [
    { label: "Mon", value: 20 },
    { label: "Tue", value: 35 },
    { label: "Wed", value: 30 },
    { label: "Thu", value: 45 },
    { label: "Fri", value: 55 },
  ],
  area: [
    { label: "Sep", value: 12 },
    { label: "Oct", value: 28 },
    { label: "Nov", value: 41 },
    { label: "Dec", value: 57 },
    { label: "Jan", value: 76 },
  ],
  donut: [
    { label: "Mastered", value: 55 },
    { label: "Practicing", value: 30 },
    { label: "New", value: 15 },
  ],
  pie: [
    { label: "Lecture", value: 25 },
    { label: "Practice", value: 45 },
    { label: "Discussion", value: 30 },
  ],
  progress: [
    { label: "Course complete", value: 72 },
    { label: "Goal", value: 100 },
  ],
};

const r2 = (value: number) => Math.round(value * 100) / 100;
const escapeText = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const attr = (value: string) => value.replace(/["<>]/g, "");

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, Math.max(1, max - 1))}…` : label;
}

/** Minimum RGB distance between two series colours that sit next to each other. */
const MIN_SERIES_DISTANCE = 40;

/** Used only when a theme's own colours collapse to fewer than three distinct ones. */
const FALLBACK_SERIES = ["#E8590C", "#0E8F7E", "#7C3AED", "#C2255C", "#2F6FEB"];

function colorDistance(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 0 : Infinity;
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
}

/**
 * Series colours derived from the theme (accent first). Near-duplicates are dropped, and
 * neighbours never match, including the last and first slice of a pie.
 */
export function seriesColors(colors: ChartColors, count: number): string[] {
  const candidates = [
    colors.accent,
    colors.accent2,
    mix(colors.accent, colors.surface2, 0.45),
    mix(colors.accent2, colors.surface2, 0.45),
    colors.muted,
    mix(colors.accent, colors.text, 0.35),
    mix(colors.accent2, colors.text, 0.35),
    mix(colors.accent, colors.surface2, 0.7),
    mix(colors.accent2, colors.surface2, 0.7),
  ];
  const kept: string[] = [];
  const keep = (color: string) => {
    if (kept.every((other) => colorDistance(other, color) >= MIN_SERIES_DISTANCE)) kept.push(color);
  };
  candidates.forEach(keep);
  if (kept.length < 3) FALLBACK_SERIES.forEach(keep);
  const out = Array.from({ length: Math.max(0, count) }, (_, index) => kept[index % kept.length]);
  if (count > kept.length && out[count - 1] === kept[0]) out[count - 1] = kept[1];
  return out;
}

function arcPath(cx: number, cy: number, r: number, inner: number, start: number, end: number): string {
  const point = (radius: number, angle: number) => [r2(cx + radius * Math.cos(angle)), r2(cy + radius * Math.sin(angle))];
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(r, start);
  const [x2, y2] = point(r, end);
  if (inner <= 0) return `M${r2(cx)} ${r2(cy)} L${x1} ${y1} A${r2(r)} ${r2(r)} 0 ${large} 1 ${x2} ${y2} Z`;
  const [x3, y3] = point(inner, end);
  const [x4, y4] = point(inner, start);
  return `M${x1} ${y1} A${r2(r)} ${r2(r)} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r2(inner)} ${r2(inner)} 0 ${large} 0 ${x4} ${y4} Z`;
}

function ringPath(cx: number, cy: number, r: number, inner: number): string {
  const circle = (radius: number) =>
    `M${r2(cx - radius)} ${r2(cy)} A${r2(radius)} ${r2(radius)} 0 1 1 ${r2(cx + radius)} ${r2(cy)} A${r2(radius)} ${r2(radius)} 0 1 1 ${r2(cx - radius)} ${r2(cy)} Z`;
  return inner > 0 ? `${circle(r)} ${circle(inner)}` : circle(r);
}

/**
 * Standalone SVG for a chart element. Colors must be resolved CSS colors (hex preferred,
 * so series tints can be mixed). Minimal styling: no axes chrome, optional labels.
 */
export function chartSvg(
  chart: Pick<ChartElement, "chart" | "data" | "showLabels">,
  colors: ChartColors,
  w: number,
  h: number,
  options: ChartSvgOptions = {},
): string {
  const width = Math.max(1, w);
  const height = Math.max(1, h);
  const data = chart.data.map((datum) => ({ label: String(datum.label ?? ""), value: Number(datum.value) || 0 }));
  const labels = chart.showLabels !== false;
  const fs = Math.max(10, Math.min(18, Math.round(Math.min(width, height) * 0.06)));
  const font = attr(options.fontFamily ?? "Inter, system-ui, sans-serif");
  const c = {
    accent: attr(colors.accent),
    accent2: attr(colors.accent2),
    text: attr(colors.text),
    muted: attr(colors.muted),
    track: attr(colors.surface2),
  };
  const text = (x: number, y: number, value: string, fill: string, anchor = "middle", size = fs, weight = 500) =>
    `<text x="${r2(x)}" y="${r2(y)}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="middle">${escapeText(value)}</text>`;
  const parts: string[] = [];
  const count = Math.max(1, data.length);
  const lo = Math.min(0, ...data.map((d) => d.value));
  const hi = Math.max(0, ...data.map((d) => d.value));
  const span = hi - lo || 1;
  /** Every `step`-th axis label, cut to what fits in `step` slots, so neighbours never overlap. */
  const axisLabels = (slot: number) => {
    const charW = fs * 0.58;
    const longest = Math.min(10, Math.max(1, ...data.map((d) => d.label.length)));
    const step = Math.max(1, Math.ceil((longest * charW) / Math.max(1, slot)));
    const chars = Math.max(3, Math.floor((slot * step) / charW));
    return (i: number) => (i % step === 0 ? truncate(data[i].label, chars) : null);
  };

  switch (chart.chart) {
    case "bar": {
      const longestValue = Math.max(1, ...data.map((d) => formatValue(d.value).length));
      const labelW = labels ? width * 0.28 : 0;
      const valueW = labels ? Math.min(width * 0.3, fs * Math.max(2.6, 0.7 + 0.62 * longestValue)) : 0;
      const rowH = height / count;
      const barH = Math.max(2, rowH * 0.56);
      const barMax = Math.max(1, width - labelW - valueW);
      const x0 = labelW + (-lo / span) * barMax;
      data.forEach((d, i) => {
        const y = i * rowH + (rowH - barH) / 2;
        const barW = Math.min(barMax, (Math.abs(d.value) / span) * barMax);
        const barX = d.value < 0 ? x0 - barW : x0;
        parts.push(`<rect x="${r2(labelW)}" y="${r2(y)}" width="${r2(barMax)}" height="${r2(barH)}" rx="${r2(Math.min(barH / 2, barMax / 2))}" fill="${c.track}"/>`);
        if (barW > 0) {
          parts.push(`<rect x="${r2(barX)}" y="${r2(y)}" width="${r2(barW)}" height="${r2(barH)}" rx="${r2(Math.min(barH / 2, barW / 2))}" fill="${c.accent}"/>`);
        }
        if (labels) {
          parts.push(text(labelW - fs * 0.6, y + barH / 2, truncate(d.label, 14), c.muted, "end"));
          parts.push(text(labelW + barMax + fs * 0.5, y + barH / 2, formatValue(d.value), c.text, "start", fs, 600));
        }
      });
      break;
    }
    case "column": {
      const labelH = labels ? fs * 2 : 0;
      const valueH = labels ? fs * 1.8 : fs * 0.4;
      const below = lo < 0 ? valueH : 0;
      const plotH = Math.max(1, height - labelH - valueH - below);
      const slot = width / count;
      const colW = slot * 0.56;
      const y0 = valueH + (hi / span) * plotH;
      const axisY = valueH + plotH + below + labelH / 2 + 1;
      const axisLabel = axisLabels(slot);
      parts.push(`<rect x="0" y="${r2(y0)}" width="${r2(width)}" height="1" fill="${c.track}"/>`);
      data.forEach((d, i) => {
        const colH = (Math.abs(d.value) / span) * plotH;
        const x = i * slot + (slot - colW) / 2;
        const top = d.value < 0 ? y0 : y0 - colH;
        if (colH > 0) {
          parts.push(`<rect x="${r2(x)}" y="${r2(top)}" width="${r2(colW)}" height="${r2(colH)}" rx="${r2(Math.min(colW / 4, colH / 2, 8))}" fill="${c.accent}"/>`);
        }
        if (labels) {
          const valueY = d.value < 0 ? y0 + colH + fs * 0.8 : y0 - colH - fs * 0.8;
          parts.push(text(x + colW / 2, valueY, formatValue(d.value), c.text, "middle", fs, 600));
          const label = axisLabel(i);
          if (label !== null) parts.push(text(x + colW / 2, axisY, label, c.muted));
        }
      });
      break;
    }
    case "line":
    case "area": {
      const labelH = labels ? fs * 2 : fs * 0.5;
      const top = fs * 0.8;
      const padX = Math.max(fs, width * 0.04);
      const plotW = Math.max(1, width - padX * 2);
      const plotH = Math.max(1, height - labelH - top);
      const base = top + plotH;
      const yOf = (value: number) => base - ((value - lo) / span) * plotH;
      const y0 = yOf(0);
      const axisLabel = axisLabels(plotW / Math.max(1, count - 1));
      const points = data.map((d, i) => [
        r2(data.length === 1 ? width / 2 : padX + (i / (data.length - 1)) * plotW),
        r2(yOf(d.value)),
      ]);
      for (const f of [0, 0.5, 1]) {
        parts.push(`<rect x="${r2(padX)}" y="${r2(top + plotH * f)}" width="${r2(plotW)}" height="1" fill="${c.track}"/>`);
      }
      if (lo < 0) parts.push(`<rect x="${r2(padX)}" y="${r2(y0)}" width="${r2(plotW)}" height="1" fill="${c.muted}" fill-opacity="0.5"/>`);
      const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
      if (chart.chart === "area" && points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        parts.push(`<path d="${line} L${last[0]} ${r2(y0)} L${first[0]} ${r2(y0)} Z" fill="${c.accent}" fill-opacity="0.18"/>`);
      }
      if (points.length > 1) {
        parts.push(`<path d="${line}" fill="none" stroke="${c.accent}" stroke-width="${r2(Math.max(2, fs * 0.2))}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
      points.forEach(([x, y], i) => {
        parts.push(`<circle cx="${x}" cy="${y}" r="${r2(Math.max(2.5, fs * 0.3))}" fill="${c.accent}"/>`);
        const label = labels ? axisLabel(i) : null;
        if (label !== null) parts.push(text(x, base + labelH / 2 + 1, label, c.muted));
      });
      break;
    }
    case "donut":
    case "pie": {
      const slices = data.map((d) => ({ label: d.label, value: Math.max(0, d.value) }));
      const total = slices.reduce((sum, d) => sum + d.value, 0) || 1;
      const legend = labels && width > height * 1.3;
      const size = legend ? Math.min(height, width * 0.5) : Math.min(width, height);
      const cx = legend ? size / 2 : width / 2;
      const cy = height / 2;
      const r = size / 2 - 1;
      const inner = chart.chart === "donut" ? r * 0.62 : 0;
      const palette = seriesColors(colors, data.length).map(attr);
      let angle = -Math.PI / 2;
      slices.forEach((d, i) => {
        const sweep = (d.value / total) * Math.PI * 2;
        if (sweep <= 0) return;
        if (sweep >= Math.PI * 2 - 1e-6) {
          parts.push(`<path d="${ringPath(cx, cy, r, inner)}" fill="${palette[i]}" fill-rule="evenodd"/>`);
        } else {
          parts.push(`<path d="${arcPath(cx, cy, r, inner, angle, angle + sweep)}" fill="${palette[i]}"/>`);
        }
        angle += sweep;
      });
      if (inner > 0 && slices.length > 0) {
        const lead = slices[0];
        parts.push(text(cx, cy - (labels ? fs * 0.5 : 0), `${Math.round((lead.value / total) * 100)}%`, c.text, "middle", Math.round(fs * 1.5), 700));
        if (labels) parts.push(text(cx, cy + fs * 0.9, truncate(lead.label, 12), c.muted, "middle", Math.round(fs * 0.85)));
      }
      if (legend) {
        const x = size + fs * 1.2;
        const rowH = fs * 1.9;
        const startY = cy - ((slices.length - 1) * rowH) / 2;
        slices.forEach((d, i) => {
          const y = startY + i * rowH;
          parts.push(`<circle cx="${r2(x + fs * 0.4)}" cy="${r2(y)}" r="${r2(fs * 0.4)}" fill="${palette[i]}"/>`);
          parts.push(text(x + fs * 1.2, y, `${truncate(d.label, 16)} · ${Math.round((d.value / total) * 100)}%`, c.text, "start"));
        });
      }
      break;
    }
    case "progress": {
      const value = Math.max(0, data[0]?.value ?? 0);
      const target = Math.max(0, data[1]?.value ?? 0) || 100;
      const pct = Math.min(1, Math.max(0, value / target));
      const size = Math.min(width, height);
      const stroke = Math.max(4, size * 0.1);
      const r = size / 2 - stroke / 2;
      const circumference = 2 * Math.PI * r;
      const cx = width / 2;
      const cy = height / 2;
      parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="none" stroke="${c.track}" stroke-width="${r2(stroke)}"/>`);
      if (pct > 0) {
        parts.push(
          `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="none" stroke="${c.accent}" stroke-width="${r2(stroke)}" stroke-linecap="round" stroke-dasharray="${r2(circumference * pct)} ${r2(circumference)}" transform="rotate(-90 ${r2(cx)} ${r2(cy)})"/>`,
        );
      }
      const big = Math.round(Math.max(fs, size * 0.2));
      parts.push(text(cx, cy - (labels ? big * 0.2 : 0), `${Math.round(pct * 100)}%`, c.text, "middle", big, 700));
      if (labels && data[0]) parts.push(text(cx, cy + big * 0.6, truncate(data[0].label, 16), c.muted, "middle", Math.round(fs * 0.85)));
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(width)}" height="${r2(height)}" viewBox="0 0 ${r2(width)} ${r2(height)}" font-family="${font}">${parts.join("")}</svg>`;
}
