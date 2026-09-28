import type { ShapeKind } from "@/lib/studio/scene";

export type ShapeCategory = "basic" | "arrows" | "lines" | "callouts" | "decor";

export interface ShapeDef {
  kind: ShapeKind;
  name: string;
  category: ShapeCategory;
  /** Default width / height ratio when inserted. */
  aspect: number;
  keywords: readonly string[];
  /** Stroke-only shapes (lines) have no fill. */
  line?: boolean;
  dash?: readonly number[];
  fillRule?: "evenodd";
  /** Default corner radius at 720px base, when the shape uses one. */
  radius?: number;
}

export const SHAPES: readonly ShapeDef[] = [
  { kind: "rect", name: "Square", category: "basic", aspect: 1, keywords: ["square", "box", "rectangle"] },
  { kind: "rounded", name: "Rounded square", category: "basic", aspect: 1, keywords: ["card", "box", "rounded"], radius: 16 },
  { kind: "circle", name: "Circle", category: "basic", aspect: 1, keywords: ["round", "dot", "bubble"] },
  { kind: "ellipse", name: "Oval", category: "basic", aspect: 1.5, keywords: ["ellipse", "oval"] },
  { kind: "pill", name: "Pill", category: "basic", aspect: 3, keywords: ["button", "chip", "tag"] },
  { kind: "triangle", name: "Triangle", category: "basic", aspect: 1.15, keywords: ["geometry", "pyramid"] },
  { kind: "diamond", name: "Diamond", category: "basic", aspect: 1, keywords: ["rhombus", "decision"] },
  { kind: "pentagon", name: "Pentagon", category: "basic", aspect: 1.05, keywords: ["geometry", "five"] },
  { kind: "hexagon", name: "Hexagon", category: "basic", aspect: 1.15, keywords: ["geometry", "six", "honeycomb"] },
  { kind: "arrow", name: "Arrow", category: "arrows", aspect: 2, keywords: ["direction", "next", "point"] },
  { kind: "chevron", name: "Chevron", category: "arrows", aspect: 1.4, keywords: ["step", "process", "next"] },
  { kind: "line", name: "Line", category: "lines", aspect: 8, keywords: ["divider", "rule"], line: true },
  { kind: "dashed-line", name: "Dashed line", category: "lines", aspect: 8, keywords: ["divider", "dash", "blank"], line: true, dash: [10, 8] },
  { kind: "arrow-line", name: "Arrow line", category: "lines", aspect: 6, keywords: ["connector", "pointer", "flow"], line: true },
  { kind: "speech", name: "Speech bubble", category: "callouts", aspect: 1.4, keywords: ["talk", "dialog", "comment", "say"], radius: 18 },
  { kind: "star", name: "Star", category: "decor", aspect: 1.05, keywords: ["rating", "favorite", "award"] },
  { kind: "blob", name: "Blob", category: "decor", aspect: 1.1, keywords: ["organic", "shape", "background"] },
  { kind: "ring", name: "Ring", category: "decor", aspect: 1, keywords: ["donut", "circle", "outline"], fillRule: "evenodd" },
];

export const SHAPE_CATEGORIES: readonly { id: ShapeCategory; name: string }[] = [
  { id: "basic", name: "Basic" },
  { id: "arrows", name: "Arrows" },
  { id: "lines", name: "Lines" },
  { id: "callouts", name: "Callouts" },
  { id: "decor", name: "Decor" },
];

export function getShape(kind: ShapeKind): ShapeDef {
  return SHAPES.find((shape) => shape.kind === kind) ?? SHAPES[0];
}

const n = (value: number) => String(Math.round(value * 100) / 100);
const attr = (value: string) => value.replace(/["<>]/g, "");

type Point = [number, number];

/** Scales unit points to fill the w×h box exactly (by their bounding box). */
function fitPolygon(points: Point[], w: number, h: number): string {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  const scaled = points.map(([x, y]): Point => [((x - minX) / spanX) * w, ((y - minY) / spanY) * h]);
  return polygon(scaled);
}

function polygon(points: Point[]): string {
  return `${points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ")} Z`;
}

function regular(sides: number, startDeg: number): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((startDeg + (360 / sides) * index) * Math.PI) / 180;
    return [Math.cos(angle), Math.sin(angle)];
  });
}

function roundedRect(w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r === 0) return `M0 0 H${n(w)} V${n(h)} H0 Z`;
  return [
    `M${n(r)} 0`,
    `H${n(w - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w)} ${n(r)}`,
    `V${n(h - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(h)}`,
    `H${n(r)}`,
    `A${n(r)} ${n(r)} 0 0 1 0 ${n(h - r)}`,
    `V${n(r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0`,
    "Z",
  ].join(" ");
}

function ellipse(cx: number, cy: number, rx: number, ry: number, clockwise = true): string {
  const sweep = clockwise ? 1 : 0;
  return `M${n(cx - rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 ${sweep} ${n(cx + rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 ${sweep} ${n(cx - rx)} ${n(cy)} Z`;
}

const BLOB_RADII = [1, 0.84, 0.96, 0.8, 0.98, 0.86, 0.94, 0.82];

/** Smooth closed curve (Catmull-Rom through 8 points) that fills the box. */
function blob(w: number, h: number): string {
  const points = BLOB_RADII.map((radius, index): Point => {
    const angle = (index / BLOB_RADII.length) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const sx = w / (Math.max(...xs) - minX);
  const sy = h / (Math.max(...ys) - minY);
  const p = points.map(([x, y]): Point => [(x - minX) * sx, (y - minY) * sy]);
  const count = p.length;
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = p[(i - 1 + count) % count];
    const p1 = p[i];
    const p2 = p[(i + 1) % count];
    const p3 = p[(i + 2) % count];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d} Z`;
}

function speech(w: number, h: number, radius: number): string {
  const bodyH = h * 0.8;
  const r = Math.max(0, Math.min(radius, w / 2, bodyH / 2));
  const tailX = Math.max(r, w * 0.18);
  const tailW = Math.min(w * 0.16, w - tailX - r);
  return [
    `M${n(r)} 0`,
    `H${n(w - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w)} ${n(r)}`,
    `V${n(bodyH - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(bodyH)}`,
    `H${n(tailX + tailW)}`,
    `L${n(tailX)} ${n(h)}`,
    `L${n(tailX)} ${n(bodyH)}`,
    `H${n(r)}`,
    `A${n(r)} ${n(r)} 0 0 1 0 ${n(bodyH - r)}`,
    `V${n(r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(r)} 0`,
    "Z",
  ].join(" ");
}

/**
 * SVG path (origin top-left, filling w×h) for any shape kind.
 * `radius` applies to rounded shapes and speech bubbles; lines run through the vertical center.
 */
export function shapePath(kind: ShapeKind, w: number, h: number, radius?: number): string {
  const r = radius ?? getShape(kind).radius ?? 0;
  const midY = h / 2;
  switch (kind) {
    case "rect":
      return roundedRect(w, h, radius ?? 0);
    case "rounded":
      return roundedRect(w, h, r || Math.min(w, h) * 0.18);
    case "pill":
      return roundedRect(w, h, Math.min(w, h) / 2);
    case "circle":
    case "ellipse":
      return ellipse(w / 2, h / 2, w / 2, h / 2);
    case "ring": {
      const thickness = Math.min(w, h) * 0.16;
      return `${ellipse(w / 2, h / 2, w / 2, h / 2)} ${ellipse(w / 2, h / 2, w / 2 - thickness, h / 2 - thickness, false)}`;
    }
    case "triangle":
      return polygon([[w / 2, 0], [w, h], [0, h]]);
    case "diamond":
      return polygon([[w / 2, 0], [w, midY], [w / 2, h], [0, midY]]);
    case "pentagon":
      return fitPolygon(regular(5, -90), w, h);
    case "hexagon":
      return fitPolygon(regular(6, 0), w, h);
    case "star": {
      const points = Array.from({ length: 10 }, (_, index): Point => {
        const angle = ((-90 + index * 36) * Math.PI) / 180;
        const radiusAt = index % 2 === 0 ? 1 : 0.45;
        return [Math.cos(angle) * radiusAt, Math.sin(angle) * radiusAt];
      });
      return fitPolygon(points, w, h);
    }
    case "arrow": {
      const head = Math.min(w * 0.45, h);
      return polygon([[0, h * 0.28], [w - head, h * 0.28], [w - head, 0], [w, midY], [w - head, h], [w - head, h * 0.72], [0, h * 0.72]]);
    }
    case "chevron": {
      const depth = Math.min(w * 0.35, h * 0.5);
      return polygon([[0, 0], [w - depth, 0], [w, midY], [w - depth, h], [0, h], [depth, midY]]);
    }
    case "speech":
      return speech(w, h, r || Math.min(w, h) * 0.2);
    case "blob":
      return blob(w, h);
    case "line":
    case "dashed-line":
      return `M0 ${n(midY)} L${n(w)} ${n(midY)}`;
    case "arrow-line": {
      const head = Math.min(w * 0.2, Math.max(8, h * 0.45));
      return `M0 ${n(midY)} L${n(w)} ${n(midY)} M${n(w - head)} ${n(midY - head)} L${n(w)} ${n(midY)} L${n(w - head)} ${n(midY + head)}`;
    }
    default:
      return roundedRect(w, h, radius ?? 0);
  }
}

export interface ShapeSvgOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  dash?: readonly number[];
}

/** Standalone SVG for previews and exports (colors must already be resolved). */
export function shapeSvg(kind: ShapeKind, w: number, h: number, options: ShapeSvgOptions = {}): string {
  const def = getShape(kind);
  const strokeWidth = options.strokeWidth ?? (def.line ? 3 : 0);
  const stroke = options.stroke ?? (def.line ? "#111418" : "none");
  const fill = def.line ? "none" : (options.fill ?? "#3D4ED7");
  const pad = strokeWidth / 2;
  const dash = options.dash ?? def.dash;
  const attrs = [
    `d="${shapePath(kind, w, h, options.radius)}"`,
    `fill="${attr(fill)}"`,
    `stroke="${strokeWidth > 0 ? attr(stroke) : "none"}"`,
    strokeWidth > 0 ? `stroke-width="${n(strokeWidth)}"` : "",
    def.line ? `stroke-linecap="round" stroke-linejoin="round"` : "",
    dash?.length ? `stroke-dasharray="${dash.join(" ")}"` : "",
    def.fillRule ? `fill-rule="${def.fillRule}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w + pad * 2)}" height="${n(h + pad * 2)}" viewBox="${n(-pad)} ${n(-pad)} ${n(w + pad * 2)} ${n(h + pad * 2)}"><path ${attrs}/></svg>`;
}
