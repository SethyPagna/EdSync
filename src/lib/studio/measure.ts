import type { TextMeasureRequest, TextMeasurer } from "./scene";

/**
 * Text measurement for the layout engine. `letterSpacing` in a request is in em
 * (fraction of the font size), matching `TextStyleDef.letterSpacing`.
 */

const NARROW = new Set("iIl|!.,:;'`ı");
const SEMI_NARROW = new Set("fjrt()[]{}/\\-\"*");
const WIDE = new Set("mwMW@%&");
const SPACE_EM = 0.28;
/** Approximate widths lean slightly wide so real fonts rarely overflow a fitted box. */
const APPROX_SAFETY = 1.03;

function charEm(char: string): number {
  if (char === " " || char === "\t") return SPACE_EM;
  if (NARROW.has(char)) return 0.27;
  if (SEMI_NARROW.has(char)) return 0.36;
  if (WIDE.has(char)) return 0.84;
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x2e80 || code > 0xffff) return 1;
  if (char >= "0" && char <= "9") return 0.56;
  if (char >= "A" && char <= "Z") return 0.66;
  if (char >= "a" && char <= "z") return 0.52;
  if (char.toLowerCase() !== char.toUpperCase()) return char === char.toUpperCase() ? 0.66 : 0.53;
  return 0.5;
}

function weightFactor(weight: number): number {
  return 1 + Math.max(0, weight - 400) * 0.0002;
}

/**
 * Width of each library family relative to the base model: the widest ratio of real
 * browser widths to the model over sample sentences at every served weight.
 */
const FAMILY_WIDTH: Readonly<Record<string, number>> = {
  geist: 1.02,
  inter: 1.04,
  fraunces: 1.08,
  "playfair display": 1.01,
  "source sans 3": 0.92,
  "dm serif display": 0.98,
  "dm sans": 1.02,
  "space grotesk": 1.08,
  poppins: 1.1,
  montserrat: 1.11,
  lora: 1.05,
  "bricolage grotesque": 1.04,
  "instrument sans": 1.04,
  "instrument serif": 0.75,
  nunito: 1,
  merriweather: 1.06,
  "open sans": 1.05,
  sora: 1.11,
  manrope: 1.03,
  lexend: 1.07,
  "atkinson hyperlegible": 0.99,
  caveat: 0.77,
  "patrick hand": 0.8,
  "roboto slab": 1.06,
  "jetbrains mono": 1.35,
};

/** Width factor for a family name or CSS stack (first family); 1 for unknown families. */
export function familyWidthFactor(fontFamily: string | undefined): number {
  const first = (fontFamily ?? "").split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  return FAMILY_WIDTH[first] ?? 1;
}

export function approxTextWidth(text: string, fontSize: number, fontWeight = 400, letterSpacing = 0, fontFamily?: string): number {
  let em = 0;
  let count = 0;
  for (const char of text) {
    em += charEm(char);
    count += 1;
  }
  return (em * weightFactor(fontWeight) * familyWidthFactor(fontFamily) * APPROX_SAFETY + letterSpacing * count) * fontSize;
}

/** Greedy word wrap; words wider than the line are broken by character. */
export function wrapText(text: string, maxWidth: number, widthOf: (value: string) => number): string[] {
  const lines: string[] = [];
  const limit = Math.max(1, maxWidth);
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/ +/).filter((word, index, all) => word.length > 0 || all.length === 1);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || widthOf(candidate) <= limit) {
        if (!line && widthOf(word) > limit) {
          const broken = breakWord(word, limit, widthOf);
          lines.push(...broken.slice(0, -1));
          line = broken[broken.length - 1] ?? "";
        } else {
          line = candidate;
        }
        continue;
      }
      lines.push(line);
      if (widthOf(word) > limit) {
        const broken = breakWord(word, limit, widthOf);
        lines.push(...broken.slice(0, -1));
        line = broken[broken.length - 1] ?? "";
      } else {
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function breakWord(word: string, limit: number, widthOf: (value: string) => number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const char of word) {
    if (current && widthOf(current + char) > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function toResult(request: TextMeasureRequest, lines: number) {
  const count = Math.max(1, lines);
  return { lines: count, height: count * request.fontSize * request.lineHeight };
}

/** Deterministic measurer based on per-character width factors (SSR, tests, fallback). */
export function createApproxMeasurer(): TextMeasurer {
  return (request) => {
    const spacing = request.letterSpacing ?? 0;
    const widthOf = (value: string) => approxTextWidth(value, request.fontSize, request.fontWeight, spacing, request.fontFamily);
    return toResult(request, wrapText(request.text, request.maxWidth, widthOf).length);
  };
}

type Context2d = Pick<CanvasRenderingContext2D, "measureText" | "font">;

function createContext2d(): Context2d | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const context = new OffscreenCanvas(1, 1).getContext("2d");
      if (context) return context as unknown as Context2d;
    }
    if (typeof document !== "undefined") {
      const context = document.createElement("canvas").getContext("2d");
      if (context && typeof context.measureText === "function") return context;
    }
  } catch {
    return null;
  }
  return null;
}

function cssFontFamily(family: string): string {
  if (family.includes(",")) return family;
  const clean = family.replace(/["']/g, "").trim();
  return `"${clean}", sans-serif`;
}

const CACHE_LIMIT = 4000;

/** False while a declared web font for `font` is still loading (canvas would measure a fallback face). */
function fontReady(font: string): boolean {
  try {
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    return !fonts || typeof fonts.check !== "function" || fonts.check(font);
  } catch {
    return true;
  }
}

/**
 * Browser measurer using canvas `measureText`; falls back to the approximate one without a DOM
 * and, per request, while the requested web font has not loaded yet.
 */
export function createCanvasMeasurer(): TextMeasurer {
  const context = createContext2d();
  const approx = createApproxMeasurer();
  if (!context) return approx;
  const cache = new Map<string, number>();
  return (request) => {
    const font = `${request.fontWeight} ${request.fontSize}px ${cssFontFamily(request.fontFamily)}`;
    if (!fontReady(font)) return approx(request);
    const spacing = (request.letterSpacing ?? 0) * request.fontSize;
    const widthOf = (value: string) => {
      const key = `${font}|${value}`;
      let width = cache.get(key);
      if (width === undefined) {
        if (context.font !== font) context.font = font;
        width = context.measureText(value).width;
        if (cache.size >= CACHE_LIMIT) cache.clear();
        cache.set(key, width);
      }
      return width + spacing * [...value].length;
    };
    return toResult(request, wrapText(request.text, request.maxWidth, widthOf).length);
  };
}
