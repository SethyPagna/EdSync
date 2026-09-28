import { describe, expect, it } from "vitest";
import * as library from "@/lib/studio/library";
import { FONT_PAIR } from "./layouts/test-fixtures";
import type { TextStyleToken } from "./scene";
import {
  DOC_TEXT_STYLES,
  TEXT_BASE_SIZE,
  TEXT_STYLES,
  resolveTextElementStyle,
  resolveTextStyle,
  textScale,
  textStylesFor,
} from "./text-styles";

const TOKENS: TextStyleToken[] = ["display", "title", "heading", "subheading", "body", "small", "caption", "quote", "stat", "label"];
const WIDE = { width: 1280, height: TEXT_BASE_SIZE };

describe("text style tables", () => {
  it("are the library's tables (single source of truth)", () => {
    expect(TEXT_STYLES).toBe(library.TEXT_STYLES);
    expect(DOC_TEXT_STYLES).toBe(library.DOC_TEXT_STYLES);
    expect(resolveTextStyle).toBe(library.resolveTextStyle);
    expect(textStylesFor("doc")).toBe(DOC_TEXT_STYLES);
    expect(textStylesFor("slides")).toBe(TEXT_STYLES);
  });

  it("define every token with a sane size range", () => {
    for (const styles of [TEXT_STYLES, DOC_TEXT_STYLES]) {
      for (const token of TOKENS) {
        const def = styles[token];
        expect(def, token).toBeDefined();
        expect(def.minSize).toBeGreaterThan(0);
        expect(def.minSize).toBeLessThanOrEqual(def.size);
        expect(def.lineHeight).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("resolveTextStyle", () => {
  it("uses base sizes on a 1280x720 page", () => {
    const style = resolveTextStyle("title", FONT_PAIR, WIDE);
    expect(style.fontSize).toBe(TEXT_STYLES.title.size);
    expect(style.fontFamily).toBe(FONT_PAIR.heading);
    expect(style.fontWeight).toBe(FONT_PAIR.headingWeight);
  });

  it("scales by the shorter page side", () => {
    expect(textScale(1080, 1080)).toBeCloseTo(1.5);
    expect(textScale(794, 1123)).toBeCloseTo(794 / TEXT_BASE_SIZE);
    const style = resolveTextStyle("body", FONT_PAIR, { width: 1080, height: 1080 });
    expect(style.fontSize).toBeCloseTo(TEXT_STYLES.body.size * 1.5);
    expect(style.fontFamily).toBe(FONT_PAIR.body);
  });

  it("uses denser reading sizes for documents", () => {
    const slide = resolveTextStyle("body", FONT_PAIR, { width: 794, height: 1123, kind: "slides" });
    const doc = resolveTextStyle("body", FONT_PAIR, { width: 794, height: 1123, kind: "doc" });
    expect(doc.fontSize).toBeLessThan(slide.fontSize);
  });

  it("resolves the label flags", () => {
    expect(resolveTextStyle("label", FONT_PAIR, WIDE).uppercase).toBe(true);
    expect(resolveTextStyle("body", FONT_PAIR, WIDE).letterSpacing).toBe(0);
  });
});

describe("resolveTextElementStyle", () => {
  it("applies element overrides over the style", () => {
    const style = resolveTextElementStyle({ style: "body", fontSize: 12, fontFamily: "heading", fontWeight: 700, italic: true }, FONT_PAIR, WIDE);
    expect(style.fontSize).toBe(12);
    expect(style.fontFamily).toBe(FONT_PAIR.heading);
    expect(style.fontWeight).toBe(700);
    expect(style.italic).toBe(true);
    expect(style.minSize).toBeLessThanOrEqual(12);
  });

  it("falls back to the style and accepts a literal font family", () => {
    const base = resolveTextStyle("small", FONT_PAIR, WIDE);
    expect(resolveTextElementStyle({ style: "small" }, FONT_PAIR, WIDE)).toEqual(base);
    expect(resolveTextElementStyle({ style: "body", fontFamily: "Lora" }, FONT_PAIR, WIDE).fontFamily).toBe("Lora");
    expect(resolveTextElementStyle({ style: "body", fontFamily: "body" }, FONT_PAIR, WIDE).fontFamily).toBe(FONT_PAIR.body);
  });
});
