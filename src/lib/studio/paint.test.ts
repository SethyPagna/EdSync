import { describe, expect, it } from "vitest";
import * as library from "@/lib/studio/library";
import { DARK_THEME, LIGHT_THEME } from "./layouts/test-fixtures";
import {
  COLOR_TOKENS,
  backgroundBaseColor,
  backgroundToCss,
  colorContrast,
  isColorToken,
  parseColor,
  readableToken,
  resolvePaint,
  resolveThemePaint,
  toHexColor,
  withAlpha,
} from "./paint";

describe("paint resolution", () => {
  it("re-exports the library resolver", () => {
    expect(resolvePaint).toBe(library.resolvePaint);
    expect(isColorToken).toBe(library.isColorToken);
  });

  it("resolves theme tokens", () => {
    expect(resolveThemePaint("accent", LIGHT_THEME)).toBe(LIGHT_THEME.colors.accent);
    expect(resolveThemePaint("bg", DARK_THEME)).toBe(DARK_THEME.colors.bg);
  });

  it("prefers deck overrides for tokens", () => {
    expect(resolveThemePaint("accent", LIGHT_THEME, { accent: "#ff0000" })).toBe("#ff0000");
  });

  it("passes custom colors through and maps missing paint to transparent", () => {
    expect(resolveThemePaint("#123456", LIGHT_THEME, { accent: "#ff0000" })).toBe("#123456");
    expect(resolveThemePaint("rgb(1, 2, 3)", LIGHT_THEME)).toBe("rgb(1, 2, 3)");
    expect(resolveThemePaint("transparent", LIGHT_THEME)).toBe("transparent");
    expect(resolveThemePaint(undefined, LIGHT_THEME)).toBe("transparent");
  });

  it("knows every color token", () => {
    for (const token of COLOR_TOKENS) {
      expect(isColorToken(token)).toBe(true);
      expect(resolveThemePaint(token, LIGHT_THEME)).toMatch(/^#/);
    }
    expect(isColorToken("#fff")).toBe(false);
  });
});

describe("withAlpha", () => {
  it("applies alpha to hex colors like the library", () => {
    expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha("#0f0", 1)).toBe("rgba(0, 255, 0, 1)");
    expect(withAlpha("#123456", 0.25)).toBe(library.withAlpha("#123456", 0.25));
  });

  it("multiplies an existing alpha", () => {
    expect(withAlpha("rgba(0, 0, 255, 0.5)", 0.5)).toBe("rgba(0, 0, 255, 0.25)");
    expect(withAlpha("#00000080", 1)).toBe(`rgba(0, 0, 0, ${Math.round((128 / 255) * 1000) / 1000})`);
  });

  it("clamps alpha and leaves unknown colors alone", () => {
    expect(withAlpha("#ffffff", 2)).toBe("rgba(255, 255, 255, 1)");
    expect(withAlpha("#ffffff", -1)).toBe("rgba(255, 255, 255, 0)");
    expect(withAlpha("hsl(0 0% 0%)", 0.5)).toBe("hsl(0 0% 0%)");
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
  });
});

describe("color helpers", () => {
  it("parses hex and rgb colors", () => {
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseColor("rgba(10, 20, 30, 0.4)")).toEqual({ r: 10, g: 20, b: 30, a: 0.4 });
    expect(parseColor("not a color")).toBeNull();
    expect(toHexColor("rgb(255, 0, 0)")).toBe("#ff0000");
    expect(toHexColor("transparent")).toBeNull();
  });

  it("computes contrast without throwing on odd input", () => {
    expect(colorContrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(colorContrast("rgb(0, 0, 0)", "#fff")).toBeCloseTo(21);
    expect(colorContrast("hsl(0 0% 0%)", "#ffffff")).toBe(1);
    expect(readableToken("#000000", LIGHT_THEME, ["text", "bg"])).toBe("bg");
    expect(readableToken("#ffffff", LIGHT_THEME, ["text", "bg"])).toBe("text");
  });

  it("finds a representative background color", () => {
    expect(backgroundBaseColor({ kind: "pattern", pattern: "dots", color: "border", on: "surface2" }, LIGHT_THEME)).toBe(
      LIGHT_THEME.colors.surface2.toLowerCase(),
    );
    expect(backgroundBaseColor({ kind: "gradient", from: "#000000", to: "#ffffff", angle: 0 }, LIGHT_THEME)).toBe("#808080");
    expect(backgroundBaseColor({ kind: "solid", color: "transparent" }, LIGHT_THEME)).toBe(LIGHT_THEME.colors.bg);
    expect(backgroundBaseColor({ kind: "image", src: "x" }, LIGHT_THEME)).toMatch(/^#/);
  });

  it("renders backgrounds to CSS through the library", () => {
    expect(backgroundToCss({ kind: "solid", color: "bg" }, LIGHT_THEME)).toBe(LIGHT_THEME.colors.bg);
    expect(backgroundToCss({ kind: "gradient", from: "accent", to: "#000000", angle: 90 }, LIGHT_THEME)).toBe(
      `linear-gradient(90deg, ${LIGHT_THEME.colors.accent}, #000000)`,
    );
    expect(backgroundToCss({ kind: "image", src: "https://x.test/a.png" }, LIGHT_THEME)).toContain('url("https://x.test/a.png")');
    const pattern = { kind: "pattern", pattern: "grid", color: "border", on: "bg" } as const;
    expect(backgroundToCss(pattern, DARK_THEME)).toBe(library.backgroundCss(pattern, (p) => resolveThemePaint(p, DARK_THEME)));
    expect(backgroundToCss(pattern, DARK_THEME)).toContain(DARK_THEME.colors.bg);
  });
});
