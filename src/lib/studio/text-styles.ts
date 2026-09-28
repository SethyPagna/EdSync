/**
 * Engine view of the text styles. The style tables and `resolveTextStyle` live in the
 * studio library (single source of truth); this module adds per-element resolution.
 */
import { resolveTextStyle, type ResolvedTextStyle } from "@/lib/studio/library";
import type { DeckKind, FontPair, TextElement } from "./scene";

export {
  DOC_TEXT_STYLES,
  TEXT_STYLES,
  resolveTextStyle,
  textScale,
  textStylesFor,
  type ResolvedTextStyle,
} from "@/lib/studio/library";

/** Text styles are sized for a page whose shorter side is this many px. */
export const TEXT_BASE_SIZE = 720;

export interface TextPage {
  width: number;
  height: number;
  kind?: DeckKind;
}

/** Style of a concrete text element: its style token plus per-element overrides. */
export function resolveTextElementStyle(
  element: Pick<
    TextElement,
    "style" | "fontFamily" | "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "italic" | "uppercase"
  >,
  fontPair: FontPair,
  page: TextPage,
): ResolvedTextStyle {
  const base = resolveTextStyle(element.style, fontPair, page);
  const family =
    element.fontFamily === "heading"
      ? fontPair.heading
      : element.fontFamily === "body"
        ? fontPair.body
        : element.fontFamily || base.fontFamily;
  const fontSize = element.fontSize ?? base.fontSize;
  return {
    fontFamily: family,
    fontSize,
    fontWeight: element.fontWeight ?? base.fontWeight,
    lineHeight: element.lineHeight ?? base.lineHeight,
    letterSpacing: element.letterSpacing ?? base.letterSpacing,
    italic: element.italic ?? base.italic,
    uppercase: element.uppercase ?? base.uppercase,
    minSize: Math.min(fontSize, base.minSize),
  };
}
