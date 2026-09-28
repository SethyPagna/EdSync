import { describe, expect, it } from "vitest";
import { TEMPLATES, getDeckTheme, getFontPair } from "@/lib/studio/library";
import { composeDeck, composeTemplate } from "./auto-layout";
import { measureTextAt } from "./fit";
import { DARK_THEME, FONT_PAIR, LIGHT_THEME, SAMPLES, SQUARE_THEME } from "./layouts/test-fixtures";
import { createApproxMeasurer } from "./measure";
import type { FontPair, SceneDeck, ScenePage } from "./scene";
import { resolveTextElementStyle } from "./text-styles";
import {
  applyDeckTheme,
  buildThemeVars,
  isDefaultBackground,
  isGeneratedBackground,
  isTokenBackground,
  sameBackground,
  themedBackground,
} from "./theme-apply";

function page(id: string, overrides: Partial<ScenePage> = {}): ScenePage {
  return {
    id,
    layoutId: "bullets-simple",
    background: { kind: "solid", color: "bg" },
    elements: [
      { id: `${id}-title`, kind: "text", role: "title", slot: "title", x: 0.1, y: 0.1, w: 0.8, h: 0.1, text: "Title", style: "title", color: "text" },
      { id: `${id}-custom`, kind: "shape", role: "shape", x: 0.1, y: 0.3, w: 0.2, h: 0.2, shape: "rect", fill: "#ff00aa", stroke: "#123456" },
      { id: `${id}-card`, kind: "shape", role: "card", slot: "card-0", x: 0.4, y: 0.3, w: 0.4, h: 0.4, shape: "rounded", radius: 16, fill: "surface" },
    ],
    ...overrides,
  };
}

function deck(pages: ScenePage[]): SceneDeck {
  return {
    v: 2,
    id: "deck-1",
    title: "Deck",
    kind: "slides",
    formatId: "slides-16x9",
    width: 1280,
    height: 720,
    themeId: LIGHT_THEME.id,
    fontPairId: FONT_PAIR.id,
    pages,
  };
}

describe("applyDeckTheme", () => {
  const custom = page("p2", { background: { kind: "solid", color: "#fafafa" } });
  const image = page("p3", { background: { kind: "image", src: "https://example.com/bg.jpg" } });
  const hero = page("p4", { layoutId: "title-center", background: LIGHT_THEME.heroBackground ?? LIGHT_THEME.background });
  const source = deck([page("p1"), custom, image, hero]);

  it("updates the theme and font pair ids", () => {
    const next = applyDeckTheme(source, DARK_THEME);
    expect(next.themeId).toBe(DARK_THEME.id);
    expect(next.fontPairId).toBe(DARK_THEME.fontPairId);
    const pair: FontPair = { ...FONT_PAIR, id: "other-pair" };
    expect(applyDeckTheme(source, DARK_THEME, pair).fontPairId).toBe("other-pair");
  });

  it("keeps custom hex colors on elements and custom backgrounds", () => {
    const next = applyDeckTheme(source, DARK_THEME, undefined, LIGHT_THEME);
    for (const p of next.pages) {
      const shape = p.elements.find((el) => el.id.endsWith("-custom"));
      expect(shape).toMatchObject({ fill: "#ff00aa", stroke: "#123456" });
      const title = p.elements.find((el) => el.slot === "title");
      expect(title).toMatchObject({ color: "text" });
    }
    expect(next.pages[1].background).toEqual({ kind: "solid", color: "#fafafa" });
    expect(next.pages[2].background).toEqual({ kind: "image", src: "https://example.com/bg.jpg" });
  });

  it("swaps theme-default backgrounds", () => {
    const next = applyDeckTheme(source, DARK_THEME, undefined, LIGHT_THEME);
    expect(next.pages[0].background).toEqual(DARK_THEME.background);
    expect(next.pages[3].background).toEqual(DARK_THEME.heroBackground);
  });

  it("defaults the previous theme to the deck's library theme", () => {
    const withoutPrevious = applyDeckTheme(source, DARK_THEME);
    expect(withoutPrevious.pages[0].background).toEqual(DARK_THEME.background);
    expect(withoutPrevious.pages[1].background).toEqual({ kind: "solid", color: "#fafafa" });
    expect(withoutPrevious.pages[3].background).toEqual(DARK_THEME.heroBackground);
    expect(withoutPrevious.pages[0].elements[2]).toMatchObject({ radius: DARK_THEME.radius });
  });

  it("retunes theme-radius cards but not edited ones", () => {
    const edited = page("p5");
    edited.elements[2] = { ...edited.elements[2], edited: true };
    const next = applyDeckTheme(deck([page("p1"), edited]), SQUARE_THEME, undefined, LIGHT_THEME);
    expect(SQUARE_THEME.radius).toBe(0);
    expect(next.pages[0].elements[2]).toMatchObject({ shape: "rect" });
    expect(next.pages[0].elements[2]).not.toHaveProperty("radius");
    expect(next.pages[1].elements[2]).toMatchObject({ shape: "rounded", radius: 16 });
  });

  it("does not mutate the input deck", () => {
    const before = JSON.stringify(source);
    applyDeckTheme(source, DARK_THEME, undefined, LIGHT_THEME);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("refits text to its box when the font pair changes", () => {
    const template = TEMPLATES.find((t) => t.id === "course-launch");
    if (!template) throw new Error("missing course-launch");
    const base = composeTemplate(template);
    const graphite = getDeckTheme("graphite");
    expect(graphite.fontPairId).not.toBe(base.fontPairId);
    const next = applyDeckTheme(base, graphite);
    const pair = getFontPair(next.fontPairId);
    const measure = createApproxMeasurer();
    const size = { width: next.width, height: next.height, kind: next.kind };
    next.pages.forEach((p, i) => {
      p.elements.forEach((el, j) => {
        if (el.kind !== "text" || !el.text.trim()) return;
        const style = resolveTextElementStyle(el, pair, size);
        const need = measureTextAt(el.text, style, style.fontSize, el.w * next.width, measure).height;
        expect(need, `${p.layoutId} ${el.slot}`).toBeLessThanOrEqual(el.h * next.height + 4);
        const before = base.pages[i].elements[j];
        if (before.kind === "text" && before.fontSize && el.fontSize) expect(el.fontSize).toBeLessThanOrEqual(before.fontSize);
      });
    });
  });

  it("leaves text alone when the font pair stays the same", () => {
    const template = TEMPLATES.find((t) => t.id === "course-launch");
    if (!template) throw new Error("missing course-launch");
    const base = composeTemplate(template);
    const next = applyDeckTheme(base, getDeckTheme("graphite"), getFontPair(base.fontPairId));
    expect(next.pages.map((p) => p.elements.filter((el) => el.kind === "text"))).toEqual(base.pages.map((p) => p.elements.filter((el) => el.kind === "text")));
  });

  it("keeps a certificate on the content background", () => {
    const format = { id: "slides-16x9", width: 1280, height: 720, kind: "slides" as const };
    const composed = composeDeck([SAMPLES.certificate], { format, theme: LIGHT_THEME, fontPair: FONT_PAIR, title: "c", seed: 1, layoutHints: ["certificate"] });
    expect(composed.pages[0].layoutId).toBe("certificate");
    expect(applyDeckTheme(composed, DARK_THEME).pages[0].background).toEqual(DARK_THEME.background);
  });
});

describe("isGeneratedBackground", () => {
  it("is true only for theme backgrounds and the layout's own background", () => {
    expect(isGeneratedBackground(LIGHT_THEME.background, LIGHT_THEME)).toBe(true);
    expect(isGeneratedBackground(LIGHT_THEME.heroBackground ?? LIGHT_THEME.background, LIGHT_THEME)).toBe(true);
    const accent = { kind: "solid", color: "accent" } as const;
    expect(isGeneratedBackground(accent, LIGHT_THEME)).toBe(false);
    expect(isGeneratedBackground(accent, LIGHT_THEME, accent)).toBe(true);
    expect(isGeneratedBackground({ kind: "pattern", pattern: "dots", color: "border", on: "bg" }, LIGHT_THEME)).toBe(false);
  });
});

describe("background helpers", () => {
  it("compares backgrounds structurally", () => {
    expect(sameBackground({ kind: "solid", color: "bg" }, { kind: "solid", color: "bg" })).toBe(true);
    expect(sameBackground({ kind: "solid", color: "bg" }, { kind: "solid", color: "surface" })).toBe(false);
    expect(sameBackground(undefined, { kind: "solid", color: "bg" })).toBe(false);
  });

  it("detects token-only and default backgrounds", () => {
    expect(isTokenBackground({ kind: "gradient", from: "accent", to: "bg", angle: 0 })).toBe(true);
    expect(isTokenBackground({ kind: "gradient", from: "#000000", to: "bg", angle: 0 })).toBe(false);
    expect(isTokenBackground({ kind: "image", src: "x" })).toBe(false);
    expect(isDefaultBackground(LIGHT_THEME.background, LIGHT_THEME)).toBe(true);
    expect(isDefaultBackground({ kind: "solid", color: "#010101" }, LIGHT_THEME)).toBe(false);
  });

  it("keeps a custom background without a previous theme", () => {
    const bg = { kind: "solid", color: "#010101" } as const;
    expect(themedBackground(bg, "bullets-simple", DARK_THEME)).toBe(bg);
    expect(themedBackground({ kind: "solid", color: "bg" }, "title-center", DARK_THEME)).toEqual(DARK_THEME.heroBackground);
  });
});

describe("buildThemeVars", () => {
  it("emits one variable per color token plus radius", () => {
    const vars = buildThemeVars(LIGHT_THEME);
    expect(vars["--deck-bg"]).toBe(LIGHT_THEME.colors.bg);
    expect(vars["--deck-accent-soft"]).toBe(LIGHT_THEME.colors.accentSoft);
    expect(vars["--deck-surface-2"]).toBe(LIGHT_THEME.colors.surface2);
    expect(vars["--deck-on-accent"]).toBe(LIGHT_THEME.colors.onAccent);
    expect(vars["--deck-radius"]).toBe("16px");
    expect(vars["--deck-font-heading"]).toBeUndefined();
  });

  it("applies overrides and fonts", () => {
    const vars = buildThemeVars(LIGHT_THEME, { accent: "#ff0000" }, FONT_PAIR);
    expect(vars["--deck-accent"]).toBe("#ff0000");
    expect(vars["--deck-font-heading"]).toContain(FONT_PAIR.heading);
    expect(vars["--deck-font-body"]).toContain(FONT_PAIR.body);
    expect(vars["--deck-weight-heading"]).toBe(String(FONT_PAIR.headingWeight));
  });
});
