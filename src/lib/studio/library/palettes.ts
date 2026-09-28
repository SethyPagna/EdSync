import { contrastRatio, parseHex, toHex } from "./contrast";

export interface BrandPalette {
  id: string;
  name: string;
  colors: readonly [string, string, string, string, string];
  tags: readonly string[];
}

export const BRAND_PALETTES: readonly BrandPalette[] = [
  { id: "clear-classroom", name: "Clear classroom", colors: ["#2563EB", "#10B981", "#0F172A", "#F8FAFC", "#F59E0B"], tags: ["classroom", "light"] },
  { id: "warm-workshop", name: "Warm workshop", colors: ["#EA580C", "#0F766E", "#1F2937", "#FFF7ED", "#FACC15"], tags: ["warm", "workshop"] },
  { id: "focus-dark", name: "Focus dark", colors: ["#111827", "#60A5FA", "#FBBF24", "#F9FAFB", "#374151"], tags: ["dark", "focus"] },
  { id: "evidence-lab", name: "Evidence lab", colors: ["#0E7490", "#7C3AED", "#0F172A", "#ECFEFF", "#22D3EE"], tags: ["science", "cool"] },
  { id: "library", name: "Library", colors: ["#0F766E", "#0F172A", "#F8FAFC", "#CBD5E1", "#B45309"], tags: ["calm", "reading"] },
  { id: "field-notes", name: "Field notes", colors: ["#65A30D", "#1A2E05", "#F7FEE7", "#A3E635", "#854D0E"], tags: ["nature", "biology"] },
  { id: "research", name: "Research", colors: ["#7C3AED", "#2E1065", "#FAF5FF", "#C4B5FD", "#DB2777"], tags: ["purple", "academic"] },
  { id: "warm-brief", name: "Warm brief", colors: ["#C2410C", "#431407", "#FFF7ED", "#FDBA74", "#0F766E"], tags: ["warm", "report"] },
  { id: "crayon-box", name: "Crayon box", colors: ["#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#A855F7"], tags: ["kids", "bright"] },
  { id: "primary-school", name: "Primary school", colors: ["#E63946", "#F1C40F", "#1D70B8", "#2A9D8F", "#F8F9FA"], tags: ["kids", "primary"] },
  { id: "chalk", name: "Chalk", colors: ["#1F3A2E", "#F4F1E8", "#F6D776", "#F2A7B5", "#8ECAE6"], tags: ["classroom", "dark"] },
  { id: "scholar", name: "Scholar", colors: ["#1D3557", "#457B9D", "#A8DADC", "#F1FAEE", "#E63946"], tags: ["academic", "cool"] },
  { id: "ocean-breeze", name: "Ocean breeze", colors: ["#03045E", "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8"], tags: ["blue", "calm"] },
  { id: "forest-walk", name: "Forest walk", colors: ["#081C15", "#1B4332", "#40916C", "#95D5B2", "#D8F3DC"], tags: ["green", "nature"] },
  { id: "campfire", name: "Campfire", colors: ["#370617", "#D00000", "#FF5400", "#FF7B00", "#FFBA08"], tags: ["warm", "bold"] },
  { id: "pastel-dream", name: "Pastel dream", colors: ["#FFADAD", "#FFD6A5", "#FDFFB6", "#CAFFBF", "#9BF6FF"], tags: ["pastel", "soft"] },
  { id: "berry", name: "Berry", colors: ["#590D22", "#A4133C", "#FF4D6D", "#FFB3C1", "#FFF0F3"], tags: ["pink", "bold"] },
  { id: "nordic", name: "Nordic", colors: ["#2E3440", "#4C566A", "#88C0D0", "#D8DEE9", "#ECEFF4"], tags: ["cool", "minimal"] },
  { id: "earth", name: "Earth", colors: ["#582F0E", "#7F4F24", "#A68A64", "#C2C5AA", "#656D4A"], tags: ["earthy", "history"] },
  { id: "citrus", name: "Citrus", colors: ["#003049", "#D62828", "#F77F00", "#FCBF49", "#EAE2B7"], tags: ["bright", "warm"] },
  { id: "lavender-fields", name: "Lavender fields", colors: ["#5A189A", "#7B2CBF", "#9D4EDD", "#C77DFF", "#E0AAFF"], tags: ["purple", "soft"] },
  { id: "terracotta", name: "Terracotta", colors: ["#3D405B", "#B5502E", "#E07A5F", "#81B29A", "#F2CC8F"], tags: ["earthy", "arts"] },
  { id: "neon", name: "Neon", colors: ["#0A0A12", "#FF4FB1", "#3CF0FF", "#B4FF39", "#F5F5FF"], tags: ["dark", "gaming"] },
  { id: "monochrome", name: "Monochrome", colors: ["#0A0A0A", "#404040", "#8A8A8A", "#D4D4D4", "#FAFAFA"], tags: ["minimal", "print"] },
];

export interface Swatch {
  id: string;
  name: string;
  hex: string;
}

export const SWATCHES: readonly Swatch[] = [
  { id: "ink", name: "Ink", hex: "#111418" },
  { id: "slate", name: "Slate", hex: "#5B6472" },
  { id: "mist", name: "Mist", hex: "#E3E6EB" },
  { id: "white", name: "White", hex: "#FFFFFF" },
  { id: "indigo", name: "Indigo", hex: "#3D4ED7" },
  { id: "blue", name: "Blue", hex: "#2563EB" },
  { id: "teal", name: "Teal", hex: "#0E7490" },
  { id: "green", name: "Green", hex: "#15803D" },
  { id: "lime", name: "Lime", hex: "#65A30D" },
  { id: "gold", name: "Gold", hex: "#CA8A04" },
  { id: "orange", name: "Orange", hex: "#EA580C" },
  { id: "red", name: "Red", hex: "#DC2626" },
  { id: "pink", name: "Pink", hex: "#DB2777" },
  { id: "violet", name: "Violet", hex: "#7C3AED" },
  { id: "brown", name: "Brown", hex: "#92400E" },
  { id: "butter", name: "Butter", hex: "#FDE68A" },
];

export function getPalette(id: string): BrandPalette | undefined {
  return BRAND_PALETTES.find((palette) => palette.id === id);
}

/** Mixes two hex colors in sRGB; `weight` is the share of `b` (0..1). Non-hex input returns `a`. */
export function mix(a: string, b: string, weight = 0.5): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  const t = Math.min(1, Math.max(0, weight));
  return toHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  });
}

export function lighten(color: string, amount = 0.2): string {
  return mix(color, "#ffffff", amount);
}

export function darken(color: string, amount = 0.2): string {
  return mix(color, "#000000", amount);
}

/** Picks whichever of `light`/`dark` reads better on `background`. */
export function readableOn(background: string, light = "#FFFFFF", dark = "#111418"): string {
  if (!parseHex(background)) return dark;
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

/** `rgba()` string for a hex color; non-hex input is returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}
