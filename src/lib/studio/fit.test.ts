import { describe, expect, it } from "vitest";
import { commonFontSize, fitTextToBox, measureTextAt, refitTextElement, splitBulletsToFit, splitTextToFit, splitToFit, widestWords, wordsFit } from "./fit";
import { FONT_PAIR } from "./layouts/test-fixtures";
import { approxTextWidth, createApproxMeasurer } from "./measure";
import type { TextElement } from "./scene";
import { resolveTextElementStyle, resolveTextStyle } from "./text-styles";

const measure = createApproxMeasurer();
const body = resolveTextStyle("body", FONT_PAIR, { width: 1280, height: 720 });
const LONG = "Energy from the sun drives evaporation and gravity brings the water back down again. ".repeat(12).trim();

describe("fitTextToBox", () => {
  it("keeps the full size when the text fits", () => {
    const result = fitTextToBox("Short text", body, 600, 200, measure);
    expect(result.fontSize).toBe(body.fontSize);
    expect(result.overflow).toBe(false);
    expect(result.lines).toBe(1);
  });

  it("shrinks toward the minimum before overflowing", () => {
    const text = "A sentence that needs to wrap a couple of times in this box.";
    const full = measure({ text, fontFamily: body.fontFamily, fontSize: body.fontSize, fontWeight: body.fontWeight, lineHeight: body.lineHeight, maxWidth: 260 });
    const result = fitTextToBox(text, body, 260, full.height - 10, measure);
    expect(result.fontSize).toBeLessThan(body.fontSize);
    expect(result.fontSize).toBeGreaterThanOrEqual(body.minSize);
    expect(result.overflow).toBe(false);
    expect(result.height).toBeLessThanOrEqual(full.height - 10 + 0.5);
  });

  it("shrinks a long word until it is no longer broken mid-word", () => {
    const word = "Photosynthesis";
    const perPx = approxTextWidth(word, 1, body.fontWeight, body.letterSpacing, body.fontFamily);
    const width = perPx * ((body.fontSize + body.minSize) / 2);
    expect(wordsFit(word, body, body.fontSize, width, measure)).toBe(false);
    const result = fitTextToBox(`${word} happens in leaves`, body, width, 1000, measure);
    expect(result.fontSize).toBeLessThan(body.fontSize);
    expect(result.fontSize).toBeGreaterThanOrEqual(body.minSize);
    expect(wordsFit(word, body, result.fontSize, width, measure)).toBe(true);
  });

  it("keeps the largest size when no size keeps the words whole", () => {
    expect(fitTextToBox("Photosynthesis", body, 10, 1000, measure).fontSize).toBe(body.fontSize);
  });

  it("reports overflow (never hides it) when even the minimum does not fit", () => {
    const result = fitTextToBox(LONG, body, 200, 40, measure);
    expect(result.overflow).toBe(true);
    expect(result.fontSize).toBe(body.minSize);
    expect(result.height).toBeGreaterThan(40);
  });
});

describe("widestWords / wordsFit", () => {
  it("picks the widest distinct words", () => {
    expect(widestWords("a bb ccc bb dddd", 2)).toEqual(["dddd", "ccc"]);
    expect(widestWords("   ")).toEqual([]);
  });

  it("checks every candidate word against the width", () => {
    expect(wordsFit("tiny words", body, body.fontSize, 400, measure)).toBe(true);
    expect(wordsFit("Incomprehensibilities", body, body.fontSize, 60, measure)).toBe(false);
    expect(wordsFit("", body, body.fontSize, 1, measure)).toBe(true);
  });
});

describe("commonFontSize", () => {
  it("returns the size at which every text fits", () => {
    const texts = ["Short", "A much longer label that needs more room to fit"];
    const size = commonFontSize(texts, body, 200, 60, measure);
    for (const text of texts) expect(fitTextToBox(text, { ...body, fontSize: size }, 200, 60, measure).fontSize).toBe(size);
    expect(size).toBeLessThanOrEqual(body.fontSize);
  });
});

describe("splitTextToFit", () => {
  it("returns the whole text when it fits", () => {
    const result = splitTextToFit("Fits easily.", body, 600, 200, measure);
    expect(result).toMatchObject({ fit: "Fits easily.", rest: "", overflow: false });
  });

  it("splits long text at a boundary without losing words", () => {
    const result = splitTextToFit(LONG, body, 500, 160, measure);
    expect(result.rest.length).toBeGreaterThan(0);
    expect(result.fit.length).toBeGreaterThan(0);
    expect(result.overflow).toBe(false);
    expect(`${result.fit} ${result.rest}`.split(/\s+/)).toEqual(LONG.split(/\s+/));
  });

  it("keeps at least one word even in a tiny box", () => {
    const result = splitTextToFit("Supercalifragilistic words everywhere", body, 30, 5, measure);
    expect(result.fit.length).toBeGreaterThan(0);
    expect(`${result.fit} ${result.rest}`.trim().split(/\s+/)).toEqual(["Supercalifragilistic", "words", "everywhere"]);
  });
});

describe("splitToFit", () => {
  const heightAt = (list: number[], scale: number) => list.length * 10 * scale;

  it("fits everything at full scale when possible", () => {
    expect(splitToFit([1, 2, 3], heightAt, 100, 0.5)).toEqual({ fit: [1, 2, 3], rest: [], scale: 1 });
  });

  it("scales down before splitting", () => {
    const result = splitToFit([1, 2, 3, 4], heightAt, 30, 0.5);
    expect(result.rest).toEqual([]);
    expect(result.scale).toBeLessThan(1);
    expect(heightAt(result.fit, result.scale)).toBeLessThanOrEqual(30.5);
  });

  it("balances pages by default and fills greedily when asked", () => {
    const entries = Array.from({ length: 7 }, (_, i) => i);
    const balanced = splitToFit(entries, heightAt, 25, 0.5);
    expect(balanced.fit.length).toBe(4);
    expect([...balanced.fit, ...balanced.rest]).toEqual(entries);
    const greedy = splitToFit(entries, heightAt, 25, 0.5, 0.05, false);
    expect(greedy.fit.length).toBe(5);
    expect([...greedy.fit, ...greedy.rest]).toEqual(entries);
  });

  it("always places at least one entry", () => {
    const result = splitToFit([1, 2], () => 1000, 10, 0.5);
    expect(result.fit).toEqual([1]);
    expect(result.rest).toEqual([2]);
  });
});

describe("splitBulletsToFit", () => {
  const bullets = Array.from({ length: 14 }, (_, i) => `Bullet ${i + 1}: a fairly long point that wraps over more than one line in a narrow column of text.`);

  it("keeps every bullet in fit + rest, in order", () => {
    const result = splitBulletsToFit(bullets, body, 500, 300, measure);
    expect(result.fit.length).toBeGreaterThan(0);
    expect(result.rest.length).toBeGreaterThan(0);
    expect([...result.fit, ...result.rest]).toEqual(bullets);
    expect(result.heights).toHaveLength(result.fit.length);
    expect(result.fontSize).toBeGreaterThanOrEqual(body.minSize);
  });

  it("fits a short list at full size", () => {
    const result = splitBulletsToFit(["One", "Two", "Three"], body, 500, 300, measure);
    expect(result).toMatchObject({ fit: ["One", "Two", "Three"], rest: [], fontSize: body.fontSize });
  });

  it("splits a single oversized bullet by words", () => {
    const result = splitBulletsToFit([LONG], body, 400, 120, measure);
    expect(result.fit).toHaveLength(1);
    expect(result.rest).toHaveLength(1);
    expect(`${result.fit[0]} ${result.rest[0]}`.split(/\s+/)).toEqual(LONG.split(/\s+/));
  });
});

describe("refitTextElement", () => {
  const page = { width: 1280, height: 720 };
  const element = (text: string, h: number, extra: Partial<TextElement> = {}): TextElement => ({
    id: "t",
    kind: "text",
    role: "title",
    slot: "title",
    style: "title",
    text,
    x: 0.1,
    y: 0.1,
    w: 0.4,
    h,
    ...extra,
  });
  const needs = (el: TextElement) => {
    const style = resolveTextElementStyle(el, FONT_PAIR, page);
    return measureTextAt(el.text, style, style.fontSize, el.w * page.width, measure).height;
  };

  it("returns text that already fits unchanged", () => {
    const el = element("Short title", 0.2);
    expect(refitTextElement(el, FONT_PAIR, page, measure)).toBe(el);
  });

  it("shrinks the font until the text fits its box", () => {
    const el = element("A title long enough to wrap onto a few lines in this box", 0.2, { fontSize: 60 });
    expect(needs(el)).toBeGreaterThan(el.h * page.height);
    const fitted = refitTextElement(el, FONT_PAIR, page, measure);
    expect(fitted.fontSize).toBeLessThan(60);
    expect(fitted.h).toBe(el.h);
    expect(needs(fitted)).toBeLessThanOrEqual(fitted.h * page.height + 0.5);
  });

  it("grows the box (never past the page bottom) when even the minimum size is too tall", () => {
    const el = element(LONG, 0.1);
    const fitted = refitTextElement(el, FONT_PAIR, page, measure);
    expect(fitted.fontSize).toBe(Math.round(resolveTextStyle("title", FONT_PAIR, page).minSize));
    expect(fitted.h).toBeGreaterThan(el.h);
    expect(fitted.y + fitted.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("never enlarges text", () => {
    const el = element("Tiny", 0.5, { fontSize: 12 });
    expect(refitTextElement(el, FONT_PAIR, page, measure).fontSize).toBe(12);
  });
});
