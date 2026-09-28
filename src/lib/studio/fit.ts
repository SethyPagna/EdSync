import { approxTextWidth } from "./measure";
import type { DeckKind, FontPair, TextElement, TextMeasurer } from "./scene";
import { resolveTextElementStyle, type ResolvedTextStyle } from "./text-styles";

/**
 * Text fitting. Text shrinks toward the style's minimum size; whatever still does
 * not fit is returned as a remainder so callers can continue it elsewhere.
 * Nothing is ever dropped silently.
 */

export interface FitResult {
  fontSize: number;
  lines: number;
  height: number;
  overflow: boolean;
}

const EPSILON = 0.5;

export function measureTextAt(
  text: string,
  style: ResolvedTextStyle,
  fontSize: number,
  width: number,
  measure: TextMeasurer,
): { height: number; lines: number } {
  return measure({
    text: style.uppercase ? text.toUpperCase() : text,
    fontFamily: style.fontFamily,
    fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    maxWidth: Math.max(1, width),
  });
}

function sizeRange(style: ResolvedTextStyle): [number, number] {
  const max = Math.max(1, Math.round(style.fontSize));
  const min = Math.max(1, Math.min(max, Math.round(style.minSize)));
  return [min, max];
}

/** Largest integer size in [min, max] for which `fits(size)` holds, or null. */
function largestFitting(min: number, max: number, fits: (size: number) => boolean): number | null {
  if (fits(max)) return max;
  let lo = min;
  let hi = max - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** The few widest words of a text (by the approximate model), the ones a narrow box would break first. */
export function widestWords(text: string, count = 3): string[] {
  const words = [...new Set(text.split(/\s+/).filter(Boolean))];
  return words
    .map((word) => ({ word, width: approxTextWidth(word, 1) }))
    .sort((a, b) => b.width - a.width)
    .slice(0, count)
    .map((entry) => entry.word);
}

/** True when no word of `text` is wider than `width` at `fontSize` (so the renderer never breaks one mid-word). */
export function wordsFit(
  text: string,
  style: ResolvedTextStyle,
  fontSize: number,
  width: number,
  measure: TextMeasurer,
): boolean {
  return widestWords(text).every((word) => measureTextAt(word, style, fontSize, width, measure).lines <= 1);
}

/**
 * Largest size in [minSize, fontSize] at which the text fits the box, preferring sizes that
 * keep every word whole; `overflow` when even the minimum size is too tall.
 */
export function fitTextToBox(
  text: string,
  style: ResolvedTextStyle,
  boxW: number,
  boxH: number,
  measure: TextMeasurer,
): FitResult {
  const [min, max] = sizeRange(style);
  const at = (size: number) => measureTextAt(text, style, size, boxW, measure);
  const fitsBox = (candidate: number) => at(candidate).height <= boxH + EPSILON;
  const size =
    largestFitting(min, max, (candidate) => fitsBox(candidate) && wordsFit(text, style, candidate, boxW, measure)) ??
    largestFitting(min, max, fitsBox);
  const fontSize = size ?? min;
  const result = at(fontSize);
  return { fontSize, lines: result.lines, height: result.height, overflow: size === null };
}

/** Largest common size at which every text fits its box on its own. */
export function commonFontSize(
  texts: string[],
  style: ResolvedTextStyle,
  boxW: number,
  boxH: number,
  measure: TextMeasurer,
): number {
  let size = Math.round(style.fontSize);
  for (const text of texts) {
    if (!text) continue;
    size = Math.min(size, fitTextToBox(text, { ...style, fontSize: size }, boxW, boxH, measure).fontSize);
  }
  return size;
}

export interface SplitResult<T> {
  fit: T[];
  rest: T[];
  /** Scale factor (<= 1) applied to the base sizes. */
  scale: number;
}

/**
 * Generic list splitter. `heightAt(entries, scale)` measures a stack of entries at
 * a type scale. Picks the largest scale in [minScale, 1] that fits every entry;
 * otherwise splits into balanced pages (at least one entry per page).
 */
export function splitToFit<T>(
  entries: T[],
  heightAt: (entries: T[], scale: number) => number,
  maxH: number,
  minScale: number,
  step = 0.05,
  /** Spread entries evenly over the pages they need (slides); false fills greedily (documents). */
  balance = true,
): SplitResult<T> {
  if (entries.length === 0) return { fit: [], rest: [], scale: 1 };
  const scales: number[] = [];
  for (let s = 1; s > minScale + 1e-6; s -= step) scales.push(Math.round(s * 1000) / 1000);
  scales.push(minScale);
  const fits = (list: T[], scale: number) => heightAt(list, scale) <= maxH + EPSILON;
  const best = (list: T[]) => scales.find((scale) => fits(list, scale));

  const all = best(entries);
  if (all !== undefined) return { fit: entries, rest: [], scale: all };

  let capacity = 0;
  while (capacity < entries.length && fits(entries.slice(0, capacity + 1), minScale)) capacity += 1;
  if (capacity === 0) return { fit: entries.slice(0, 1), rest: entries.slice(1), scale: minScale };
  const pages = Math.ceil(entries.length / capacity);
  const perPage = balance ? Math.min(capacity, Math.ceil(entries.length / pages)) : capacity;
  const fit = entries.slice(0, perPage);
  return { fit, rest: entries.slice(perPage), scale: best(fit) ?? minScale };
}

export interface BulletSplit {
  fit: string[];
  rest: string[];
  fontSize: number;
  /** Height of each fitted bullet at `fontSize`. */
  heights: number[];
}

/**
 * Fits a bullet stack into a box: shrinks toward the style minimum, then splits
 * the remainder off. A single bullet too long for the box is split by words.
 * `gapEm` is the space between bullets as a fraction of the font size.
 */
export function splitBulletsToFit(
  bullets: string[],
  style: ResolvedTextStyle,
  boxW: number,
  boxH: number,
  measure: TextMeasurer,
  gapEm = 0.6,
): BulletSplit {
  const [min, max] = sizeRange(style);
  const sizeAt = (scale: number) => Math.max(min, Math.round(max * scale));
  const heightOf = (text: string, size: number) => measureTextAt(text, style, size, boxW, measure).height;
  const stackHeight = (list: string[], scale: number) => {
    const size = sizeAt(scale);
    return list.reduce((sum, text) => sum + heightOf(text, size), 0) + Math.max(0, list.length - 1) * gapEm * size;
  };
  const split = splitToFit(bullets, stackHeight, boxH, min / max, 0.04);
  let fit = split.fit;
  let rest = split.rest;
  const fontSize = sizeAt(split.scale);
  if (fit.length === 1 && heightOf(fit[0], fontSize) > boxH + EPSILON) {
    const part = splitTextToFit(fit[0], { ...style, fontSize }, boxW, boxH, measure);
    fit = [part.fit];
    rest = part.rest ? [part.rest, ...rest] : rest;
  }
  return { fit, rest, fontSize, heights: fit.map((text) => heightOf(text, fontSize)) };
}

export interface TextSplit {
  fit: string;
  rest: string;
  fontSize: number;
  lines: number;
  height: number;
  overflow: boolean;
}

/**
 * Fits a paragraph into a box, shrinking to the minimum size first. If it still
 * overflows, cuts at the last paragraph/sentence/word boundary that fits and
 * returns the remainder. At least one word is always kept.
 */
export function splitTextToFit(
  source: string,
  style: ResolvedTextStyle,
  boxW: number,
  boxH: number,
  measure: TextMeasurer,
): TextSplit {
  const text = source.trim();
  const whole = fitTextToBox(text, style, boxW, boxH, measure);
  if (!whole.overflow) return { fit: text, rest: "", ...whole };
  const size = whole.fontSize;
  const cuts: number[] = [];
  const pattern = /\s+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) cuts.push(match.index);
  cuts.push(text.length);
  const fitsAt = (end: number) => measureTextAt(text.slice(0, end).trimEnd(), style, size, boxW, measure).height <= boxH + EPSILON;
  let lo = 0;
  let hi = cuts.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fitsAt(cuts[mid])) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  let end = cuts[Math.max(0, best)];
  const prefix = text.slice(0, end);
  const sentenceEnd = Math.max(prefix.lastIndexOf("\n"), ...[". ", "! ", "? ", "; "].map((mark) => prefix.lastIndexOf(mark) + 1));
  if (sentenceEnd > 0 && sentenceEnd >= end * 0.6) end = sentenceEnd;
  const fit = text.slice(0, end).trim();
  const rest = text.slice(end).trim();
  const measured = measureTextAt(fit, style, size, boxW, measure);
  return {
    fit,
    rest,
    fontSize: size,
    lines: measured.lines,
    height: measured.height,
    overflow: measured.height > boxH + EPSILON,
  };
}

/**
 * Fits an existing text element to its box on a page (after a format or font-pair change):
 * shrinks its font size toward the style minimum, and when even that is too tall grows the
 * box down to the page bottom. Never enlarges text; returns the element itself when it fits.
 */
export function refitTextElement(
  el: TextElement,
  fontPair: FontPair,
  page: { width: number; height: number; kind?: DeckKind },
  measure: TextMeasurer,
): TextElement {
  if (!el.text.trim()) return el;
  const style = resolveTextElementStyle(el, fontPair, page);
  const pad = Math.max(0, el.padding ?? 0) * 2;
  const boxW = el.w * page.width - pad;
  const fit = fitTextToBox(el.text, style, boxW, el.h * page.height - pad, measure);
  let out = el;
  if (fit.fontSize < Math.round(style.fontSize)) out = { ...out, fontSize: fit.fontSize };
  if (fit.overflow) {
    const need = (fit.height + pad) / page.height;
    const h = Math.min(Math.max(el.h, need), Math.max(el.h, 1 - el.y));
    if (h > el.h) out = { ...out, h: Math.round(h * 1e5) / 1e5 };
  }
  return out;
}
