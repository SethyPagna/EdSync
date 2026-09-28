import { afterEach, describe, expect, it, vi } from "vitest";
import { approxTextWidth, createApproxMeasurer, createCanvasMeasurer, familyWidthFactor, wrapText } from "./measure";
import type { TextMeasureRequest } from "./scene";

const request = (text: string, maxWidth: number, extra: Partial<TextMeasureRequest> = {}): TextMeasureRequest => ({
  text,
  fontFamily: "Inter",
  fontSize: 20,
  fontWeight: 400,
  lineHeight: 1.5,
  maxWidth,
  ...extra,
});

describe("approxTextWidth", () => {
  it("grows with text length, font size, weight and letter spacing", () => {
    const base = approxTextWidth("hello world", 20);
    expect(base).toBeGreaterThan(0);
    expect(approxTextWidth("hello world, again", 20)).toBeGreaterThan(base);
    expect(approxTextWidth("hello world", 40)).toBeCloseTo(base * 2);
    expect(approxTextWidth("hello world", 20, 700)).toBeGreaterThan(base);
    expect(approxTextWidth("hello world", 20, 400, 0.1)).toBeGreaterThan(base);
  });

  it("treats wide glyphs as wider than narrow ones", () => {
    expect(approxTextWidth("MMMM", 20)).toBeGreaterThan(approxTextWidth("iiii", 20));
  });

  it("calibrates widths per font family", () => {
    const text = "Science Fair Night";
    expect(familyWidthFactor("Poppins")).toBeGreaterThan(1);
    expect(familyWidthFactor("Caveat")).toBeLessThan(1);
    expect(familyWidthFactor('"Poppins", sans-serif')).toBe(familyWidthFactor("poppins"));
    expect(familyWidthFactor("Unknown Sans")).toBe(1);
    expect(familyWidthFactor(undefined)).toBe(1);
    expect(approxTextWidth(text, 20, 600, 0, "Poppins")).toBeGreaterThan(approxTextWidth(text, 20, 600, 0, "Geist"));
    expect(approxTextWidth(text, 20, 400, 0, "Unknown Sans")).toBe(approxTextWidth(text, 20));
  });

  it("wraps wide families earlier in the measurer", () => {
    const measure = createApproxMeasurer();
    const at = (fontFamily: string) => measure(request("Science Fair Night", 750, { fontFamily, fontSize: 81, fontWeight: 600, lineHeight: 1 })).lines;
    expect(at("Geist")).toBe(1);
    expect(at("Poppins")).toBe(2);
  });
});

describe("wrapText", () => {
  const widthOf = (value: string) => value.length * 10;

  it("wraps greedily on spaces", () => {
    expect(wrapText("aa bb cc dd", 50, widthOf)).toEqual(["aa bb", "cc dd"]);
  });

  it("keeps explicit line breaks", () => {
    expect(wrapText("one\ntwo", 1000, widthOf)).toEqual(["one", "two"]);
  });

  it("breaks words longer than the line and loses no characters", () => {
    const lines = wrapText("abcdefghij", 40, widthOf);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("abcdefghij");
    for (const line of lines) expect(widthOf(line)).toBeLessThanOrEqual(40);
  });
});

describe("createApproxMeasurer", () => {
  const measure = createApproxMeasurer();

  it("reports one line for short text", () => {
    const result = measure(request("Hi", 500));
    expect(result.lines).toBe(1);
    expect(result.height).toBeCloseTo(30);
  });

  it("wraps long text into more lines in a narrow box", () => {
    const text = "The quick brown fox jumps over the lazy dog ".repeat(4).trim();
    const wide = measure(request(text, 2000));
    const narrow = measure(request(text, 200));
    expect(narrow.lines).toBeGreaterThan(wide.lines);
    expect(narrow.height).toBe(narrow.lines * 20 * 1.5);
  });

  it("is deterministic", () => {
    const text = "Deterministic measurement for server rendering and tests.";
    expect(measure(request(text, 180))).toEqual(measure(request(text, 180)));
  });

  it("counts an empty string as one line", () => {
    expect(measure(request("", 100)).lines).toBe(1);
  });
});

describe("createCanvasMeasurer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the approximate measurer without a canvas", () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const canvas = createCanvasMeasurer();
    const approx = createApproxMeasurer();
    const req = request("A sentence long enough to wrap in a small box.", 150);
    expect(canvas(req)).toEqual(approx(req));
  });

  it("measures with canvas measureText when available", () => {
    const fonts: string[] = [];
    const context = {
      font: "",
      measureText: (value: string) => ({ width: value.length * 10 }),
    };
    class FakeOffscreenCanvas {
      getContext() {
        return new Proxy(context, {
          set(target, key, value) {
            if (key === "font") fonts.push(String(value));
            return Reflect.set(target, key, value);
          },
        });
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    const measure = createCanvasMeasurer();
    const result = measure(request("aa bb cc dd", 50, { fontWeight: 600 }));
    expect(result.lines).toBe(2);
    expect(result.height).toBe(2 * 20 * 1.5);
    expect(fonts[0]).toBe('600 20px "Inter", sans-serif');
  });

  it("uses the approximate measurer while the web font is still loading", () => {
    const loaded = new Set<string>();
    class FakeOffscreenCanvas {
      getContext() {
        return { font: "", measureText: (value: string) => ({ width: value.length * 100 }) };
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("document", { fonts: { check: (font: string) => loaded.has(font) } });
    const measure = createCanvasMeasurer();
    const req = request("A sentence long enough to wrap in a small box.", 150);
    expect(measure(req)).toEqual(createApproxMeasurer()(req));
    loaded.add('400 20px "Inter", sans-serif');
    expect(measure(req).lines).toBeGreaterThan(createApproxMeasurer()(req).lines);
  });

  it("adds letter spacing (em) per character", () => {
    class FakeOffscreenCanvas {
      getContext() {
        return { font: "", measureText: (value: string) => ({ width: value.length * 10 }) };
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    const measure = createCanvasMeasurer();
    // 5 chars * 10px = 50px fits a 50px box; +0.1em * 20px * 5 chars = 60px does not.
    expect(measure(request("aaaaa bbbbb", 50)).lines).toBe(2);
    expect(measure(request("aaaaa", 50, { letterSpacing: 0.1 })).lines).toBe(2);
  });
});
