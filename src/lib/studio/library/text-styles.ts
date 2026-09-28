import type { DeckKind, FontPair, TextStyleDef, TextStyleToken } from "@/lib/studio/scene";

/** Slide/social/design text styles; sizes are px for a page whose shorter side is 720px. */
export const TEXT_STYLES: Readonly<Record<TextStyleToken, TextStyleDef>> = {
  display: { size: 68, minSize: 36, weight: 700, lineHeight: 1.04, letterSpacing: -0.02, font: "heading" },
  title: { size: 46, minSize: 26, weight: 600, lineHeight: 1.1, letterSpacing: -0.015, font: "heading" },
  heading: { size: 30, minSize: 18, weight: 600, lineHeight: 1.18, letterSpacing: -0.01, font: "heading" },
  subheading: { size: 22, minSize: 15, weight: 500, lineHeight: 1.3, font: "body" },
  body: { size: 20, minSize: 13, weight: 400, lineHeight: 1.45, font: "body" },
  small: { size: 16, minSize: 11, weight: 400, lineHeight: 1.45, font: "body" },
  caption: { size: 13, minSize: 10, weight: 400, lineHeight: 1.4, font: "body" },
  quote: { size: 34, minSize: 20, weight: 500, lineHeight: 1.25, letterSpacing: -0.01, font: "heading" },
  stat: { size: 76, minSize: 32, weight: 700, lineHeight: 1, letterSpacing: -0.02, font: "heading" },
  label: { size: 13, minSize: 10, weight: 600, lineHeight: 1.2, letterSpacing: 0.08, font: "body", uppercase: true },
};

/** Document/worksheet styles: denser, reading-sized type. */
export const DOC_TEXT_STYLES: Readonly<Record<TextStyleToken, TextStyleDef>> = {
  display: { size: 40, minSize: 26, weight: 700, lineHeight: 1.1, letterSpacing: -0.02, font: "heading" },
  title: { size: 30, minSize: 20, weight: 600, lineHeight: 1.15, letterSpacing: -0.01, font: "heading" },
  heading: { size: 20, minSize: 15, weight: 600, lineHeight: 1.25, font: "heading" },
  subheading: { size: 16, minSize: 12, weight: 500, lineHeight: 1.35, font: "body" },
  body: { size: 13.5, minSize: 10, weight: 400, lineHeight: 1.55, font: "body" },
  small: { size: 12, minSize: 9, weight: 400, lineHeight: 1.5, font: "body" },
  caption: { size: 10.5, minSize: 8, weight: 400, lineHeight: 1.4, font: "body" },
  quote: { size: 18, minSize: 13, weight: 500, lineHeight: 1.4, font: "heading" },
  stat: { size: 40, minSize: 22, weight: 700, lineHeight: 1, letterSpacing: -0.02, font: "heading" },
  label: { size: 10.5, minSize: 8, weight: 600, lineHeight: 1.2, letterSpacing: 0.08, font: "body", uppercase: true },
};

export function textStylesFor(kind: DeckKind): Readonly<Record<TextStyleToken, TextStyleDef>> {
  return kind === "doc" || kind === "worksheet" ? DOC_TEXT_STYLES : TEXT_STYLES;
}

/** Scale factor from the 720px base to a page. */
export function textScale(width: number, height: number): number {
  return Math.min(width, height) / 720;
}

export interface ResolvedTextStyle {
  fontFamily: string;
  fontSize: number;
  minSize: number;
  fontWeight: number;
  lineHeight: number;
  /** em units */
  letterSpacing: number;
  uppercase: boolean;
  italic: boolean;
}

/**
 * Concrete font settings for a style on a page. Heading-font styles use the pair's heading
 * weight (so single-weight display faces stay valid); body styles keep their own weight.
 */
export function resolveTextStyle(
  token: TextStyleToken,
  fontPair: FontPair,
  page: { width: number; height: number; kind?: DeckKind },
): ResolvedTextStyle {
  const def = textStylesFor(page.kind ?? "slides")[token];
  const scale = textScale(page.width, page.height);
  const heading = def.font === "heading";
  return {
    fontFamily: heading ? fontPair.heading : fontPair.body,
    fontSize: Math.round(def.size * scale * 10) / 10,
    minSize: Math.round(def.minSize * scale * 10) / 10,
    fontWeight: heading ? fontPair.headingWeight : def.weight === 400 ? fontPair.bodyWeight : def.weight,
    lineHeight: def.lineHeight,
    letterSpacing: def.letterSpacing ?? 0,
    uppercase: def.uppercase ?? false,
    italic: def.italic ?? false,
  };
}

/** Quick-add presets for the Text panel. */
export const TEXT_PRESETS: readonly { id: string; name: string; style: TextStyleToken; sample: string }[] = [
  { id: "add-title", name: "Title", style: "title", sample: "Add a title" },
  { id: "add-heading", name: "Heading", style: "heading", sample: "Add a heading" },
  { id: "add-subheading", name: "Subheading", style: "subheading", sample: "Add a subheading" },
  { id: "add-body", name: "Body", style: "body", sample: "Add body text" },
  { id: "add-quote", name: "Quote", style: "quote", sample: "“Add a quote”" },
  { id: "add-stat", name: "Big number", style: "stat", sample: "87%" },
  { id: "add-label", name: "Label", style: "label", sample: "Label" },
  { id: "add-caption", name: "Caption", style: "caption", sample: "Add a caption" },
];
