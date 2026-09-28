/**
 * Engine color helpers. Token resolution, theme colors, background stops and CSS come from
 * the studio library (single source of truth); this module adds theme-level shortcuts and
 * tolerant color math (hex and rgb[a], never throwing) for layout decisions.
 */
import { backgroundCss, backgroundStops, contrastRatio, mix, resolvePaint, themeColors, toHex } from "@/lib/studio/library";
import type { Background, ColorToken, DeckTheme, Paint } from "./scene";

export { isColorToken, resolvePaint, themeColors } from "@/lib/studio/library";

export type ColorOverrides = Partial<Record<ColorToken, string>>;

export const COLOR_TOKENS: readonly ColorToken[] = [
  "bg",
  "surface",
  "surface2",
  "text",
  "muted",
  "accent",
  "accent2",
  "accentSoft",
  "onAccent",
  "border",
  "success",
  "warning",
  "danger",
];

/** Resolves a paint (theme token, hex/rgb color or "transparent") against a theme plus deck overrides. */
export function resolveThemePaint(paint: Paint | undefined, theme: DeckTheme, overrides?: ColorOverrides): string {
  return resolvePaint(paint, themeColors(theme, overrides));
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(color: string): Rgba | null {
  const value = color.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(value);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((d) => d + d).join("");
    if (digits.length !== 6 && digits.length !== 8) return null;
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (part: string) => (part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const result = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
    return Object.values(result).some((n) => Number.isNaN(n)) ? null : result;
  }
  return null;
}

/** Opaque hex for a hex/rgb color (alpha dropped); null for unparseable or fully transparent colors. */
export function toHexColor(color: string): string | null {
  const parsed = parseColor(color);
  return parsed && parsed.a > 0 ? toHex(parsed) : null;
}

function clampByte(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}

/** Applies an alpha (0..1) to a hex/rgb color, multiplying any existing alpha; other CSS colors are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  if (color.trim().toLowerCase() === "transparent") return "transparent";
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * parsed.a * 1000) / 1000;
  return `rgba(${clampByte(parsed.r)}, ${clampByte(parsed.g)}, ${clampByte(parsed.b)}, ${a})`;
}

/** WCAG contrast ratio for any hex/rgb colors; 1 when either color cannot be parsed. */
export function colorContrast(a: string, b: string): number {
  const x = toHexColor(a);
  const y = toHexColor(b);
  return x && y ? contrastRatio(x, y) : 1;
}

/** Color assumed under text on a photo without an overlay. */
const PHOTO_BASE = "#1f2937";

/** A single representative color for a background (the average of its stops), for text contrast decisions. */
export function backgroundBaseColor(background: Background, theme: DeckTheme, overrides?: ColorOverrides): string {
  const stops = backgroundStops(background)
    .map((paint) => toHexColor(resolveThemePaint(paint, theme, overrides)))
    .filter((color): color is string => color !== null);
  if (!stops.length) return background.kind === "image" ? PHOTO_BASE : resolveThemePaint("bg", theme, overrides);
  return stops.slice(1).reduce((average, color, i) => mix(average, color, 1 / (i + 2)), stops[0]);
}

/** CSS `background` value for DOM previews. */
export function backgroundToCss(background: Background, theme: DeckTheme, overrides?: ColorOverrides): string {
  return backgroundCss(background, (paint) => resolveThemePaint(paint, theme, overrides));
}

/** The theme token that reads best on a given CSS color. */
export function readableToken(
  on: string,
  theme: DeckTheme,
  candidates: readonly ColorToken[] = ["text", "onAccent", "bg"],
  overrides?: ColorOverrides,
): ColorToken {
  let best = candidates[0];
  let bestRatio = -1;
  for (const token of candidates) {
    const ratio = colorContrast(resolveThemePaint(token, theme, overrides), on);
    if (ratio > bestRatio) {
      best = token;
      bestRatio = ratio;
    }
  }
  return best;
}
