import { describe, expect, it } from "vitest";
import type { ColorToken, SceneElement, ShapeKind, SlideContent } from "@/lib/studio/scene";
import {
  BACKGROUND_PRESETS,
  BRAND_PALETTES,
  CHART_KINDS,
  DECK_THEMES,
  DEFAULT_DECK_THEME_ID,
  DEFAULT_FONT_PAIR_ID,
  DEFAULT_FORMAT_ID,
  ELEMENT_CATEGORIES,
  ELEMENT_KITS,
  FONT_FAMILIES,
  FONT_PAIRS,
  FORMAT_GROUPS,
  FORMATS,
  ICON_CATEGORIES,
  ICONS,
  LAYOUT_HINT_IDS,
  SAMPLE_CHART_DATA,
  SHAPES,
  SWATCHES,
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  TEXT_STYLES,
  backgroundCss,
  backgroundStops,
  chartSvg,
  contrastRatio,
  findDeckTheme,
  findFontFamily,
  findFontPair,
  findFormat,
  fontStack,
  formatForSize,
  formatOrientation,
  getDeckTheme,
  getElementKit,
  getFontPair,
  getFormat,
  getIcon,
  getBackgroundPreset,
  getTemplate,
  googleFamilyQuery,
  googleFontsHref,
  iconDataUrl,
  iconSvg,
  isHexColor,
  mix,
  parseHex,
  patternTileSvg,
  presetIsLight,
  readableOn,
  resolvePaint,
  resolveTextStyle,
  searchElementKits,
  searchIcons,
  searchTemplates,
  seriesColors,
  servedWeights,
  shapePath,
  shapeSvg,
  themeColors,
  withAlpha,
  type ChartColors,
  type ChartKind,
  type PatternKind,
} from "./index";
import { composeTemplate } from "@/lib/studio/auto-layout";

function expectUnique(values: readonly string[], label: string) {
  const seen = new Set<string>();
  const dupes = values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
  expect(dupes, `duplicate ${label}`).toEqual([]);
}

const ALL_SHAPE_KINDS: Record<ShapeKind, true> = {
  rect: true,
  rounded: true,
  circle: true,
  ellipse: true,
  pill: true,
  triangle: true,
  diamond: true,
  pentagon: true,
  hexagon: true,
  star: true,
  arrow: true,
  chevron: true,
  speech: true,
  blob: true,
  line: true,
  "dashed-line": true,
  "arrow-line": true,
  ring: true,
};

const ALL_CHART_KINDS: Record<ChartKind, true> = {
  bar: true,
  column: true,
  line: true,
  area: true,
  donut: true,
  pie: true,
  progress: true,
};

const ALL_PATTERNS: Record<PatternKind, true> = { dots: true, grid: true, lines: true, diagonal: true, waves: true, confetti: true };

const CHART_COLORS: ChartColors = {
  accent: "#3D4ED7",
  accent2: "#0F9D8A",
  text: "#111418",
  muted: "#5B6472",
  surface2: "#EEF0F4",
};

function counter(prefix = "el") {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

function contentIcons(content: SlideContent): string[] {
  return [content.icon, ...(content.items ?? []).map((item) => item.icon)].filter((icon): icon is string => Boolean(icon));
}

describe("ids are unique", () => {
  it("across every collection", () => {
    expectUnique(FORMATS.map((format) => format.id), "format ids");
    expectUnique(FONT_FAMILIES.map((font) => font.family.toLowerCase()), "font families");
    expectUnique(FONT_PAIRS.map((fontPair) => fontPair.id), "font pair ids");
    expectUnique(DECK_THEMES.map((deckTheme) => deckTheme.id), "theme ids");
    expectUnique(BRAND_PALETTES.map((palette) => palette.id), "palette ids");
    expectUnique(SWATCHES.map((swatch) => swatch.id), "swatch ids");
    expectUnique(BACKGROUND_PRESETS.map((preset) => preset.id), "background ids");
    expectUnique(SHAPES.map((shape) => shape.kind), "shape kinds");
    expectUnique(ICONS.flatMap((icon) => [icon.id, ...(icon.aliases ?? [])]), "icon ids + aliases");
    expectUnique(ELEMENT_KITS.map((kit) => kit.id), "element kit ids");
    expectUnique(TEMPLATES.map((entry) => entry.id), "template ids");
    expectUnique([...LAYOUT_HINT_IDS], "layout hint ids");
    expectUnique(CHART_KINDS.map((kind) => kind.id), "chart kinds");
  });
});

describe("formats", () => {
  it("are sized, grouped and resolvable", () => {
    expect(FORMATS.length).toBeGreaterThanOrEqual(20);
    for (const format of FORMATS) {
      expect(format.width).toBeGreaterThan(0);
      expect(format.height).toBeGreaterThan(0);
      expect(Number.isInteger(format.width) && Number.isInteger(format.height)).toBe(true);
    }
    expect(FORMAT_GROUPS.flatMap((group) => group.formats)).toHaveLength(FORMATS.length);
    expect(getFormat("nope").id).toBe(DEFAULT_FORMAT_ID);
    expect(findFormat("nope")).toBeUndefined();
    expect(formatForSize(1080, 1920)?.id).toBe("ig-story");
    expect(formatOrientation(getFormat("doc-a4"))).toBe("portrait");
    expect(formatOrientation(getFormat("ig-square"))).toBe("square");
  });
});

describe("fonts", () => {
  it("pairs reference known families at served weights", () => {
    for (const fontPair of FONT_PAIRS) {
      const heading = findFontFamily(fontPair.heading);
      const body = findFontFamily(fontPair.body);
      expect(heading, fontPair.heading).toBeDefined();
      expect(body, fontPair.body).toBeDefined();
      expect(heading?.weights).toContain(fontPair.headingWeight);
      expect(body?.weights).toContain(fontPair.bodyWeight);
      expect(fontPair.googleFamilies.length).toBeGreaterThan(0);
      for (const query of fontPair.googleFamilies) {
        expect(query).toMatch(/^[A-Za-z0-9+]+(:wght@\d{3}(;\d{3})*)?$/);
        expect(query).not.toContain(" ");
      }
    }
  });

  it("builds css2 queries and never asks for unserved weights", () => {
    expect(googleFamilyQuery("Playfair Display", [600, 700])).toBe("Playfair+Display:wght@600;700");
    expect(googleFamilyQuery("DM Serif Display", [400, 700])).toBe("DM+Serif+Display");
    expect(servedWeights("Merriweather", [400, 500, 600, 700])).toEqual([400, 700]);
    expect(getFontPair("missing").id).toBe(DEFAULT_FONT_PAIR_ID);
    expect(googleFontsHref(["Inter:wght@400;600"])).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap",
    );
    expect(fontStack("Lora")).toMatch(/^"Lora", .*serif$/);
  });

  it("resolves text styles to the pair and page size", () => {
    const fontPair = getFontPair("elegant");
    const title = resolveTextStyle("title", fontPair, { width: 1280, height: 720 });
    expect(title.fontFamily).toBe("DM Serif Display");
    expect(title.fontWeight).toBe(400);
    expect(title.fontSize).toBe(TEXT_STYLES.title.size);
    const body = resolveTextStyle("body", fontPair, { width: 1080, height: 1080 });
    expect(body.fontFamily).toBe("DM Sans");
    expect(body.fontSize).toBeCloseTo(TEXT_STYLES.body.size * 1.5, 1);
  });
});

describe("contrast helper", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(parseHex("nope")).toBeNull();
    expect(isHexColor("#3D4ED7")).toBe(true);
    expect(readableOn("#111418")).toBe("#FFFFFF");
    expect(mix("#000000", "#ffffff", 0.5).toLowerCase()).toBe("#808080");
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });
});

describe("themes", () => {
  it("has 20 complete themes with valid references", () => {
    expect(DECK_THEMES).toHaveLength(20);
    expect(getDeckTheme("missing").id).toBe(DEFAULT_DECK_THEME_ID);
    for (const deckTheme of DECK_THEMES) {
      for (const [token, value] of Object.entries(deckTheme.colors)) {
        expect(isHexColor(value), `${deckTheme.id}.${token}`).toBe(true);
      }
      expect(findFontPair(deckTheme.fontPairId), `${deckTheme.id} font pair`).toBeDefined();
    }
  });

  it.each(DECK_THEMES.map((deckTheme) => [deckTheme.id, deckTheme] as const))("%s meets contrast minimums", (_, deckTheme) => {
    const c = deckTheme.colors;
    const check = (fg: ColorToken, bg: ColorToken, minimum: number) =>
      expect(contrastRatio(c[fg], c[bg]), `${deckTheme.id}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(minimum);
    check("text", "bg", 4.5);
    check("text", "surface", 4.5);
    check("text", "surface2", 4.5);
    check("muted", "bg", 4.5);
    check("muted", "surface", 4.5);
    check("onAccent", "accent", 4.5);
    check("accent", "bg", 3);
    check("accent", "surface", 3);
  });

  it.each(DECK_THEMES.map((deckTheme) => [deckTheme.id, deckTheme] as const))("%s backgrounds keep text readable", (_, deckTheme) => {
    for (const background of [deckTheme.background, deckTheme.heroBackground]) {
      if (!background) continue;
      for (const stop of backgroundStops(background)) {
        const color = resolvePaint(stop, deckTheme.colors);
        if (!isHexColor(color)) continue;
        expect(contrastRatio(deckTheme.colors.text, color), `${deckTheme.id}: text on ${stop}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("resolves paints", () => {
    const colors = getDeckTheme("porcelain").colors;
    expect(resolvePaint("accent", colors)).toBe(colors.accent);
    expect(resolvePaint("#123456", colors)).toBe("#123456");
    expect(resolvePaint(undefined, colors)).toBe("transparent");
  });
});

describe("palettes and backgrounds", () => {
  it("palettes and swatches are hex", () => {
    for (const palette of BRAND_PALETTES) {
      expect(palette.colors).toHaveLength(5);
      for (const color of palette.colors) expect(isHexColor(color), `${palette.id} ${color}`).toBe(true);
    }
    for (const swatch of SWATCHES) expect(isHexColor(swatch.hex), swatch.id).toBe(true);
  });

  it("produces CSS for every preset", () => {
    const colors = getDeckTheme("porcelain").colors;
    const resolve = (paint: string) => resolvePaint(paint, colors);
    for (const preset of BACKGROUND_PRESETS) {
      const css = backgroundCss(preset.background, resolve);
      expect(css.length, preset.id).toBeGreaterThan(0);
      expect(css).not.toMatch(/\b(bg|surface|accent|accentSoft|accent2)\b(?![-\w])/);
      if (preset.background.kind === "gradient") expect(css).toMatch(/^linear-gradient\(\d+deg, /);
      if (preset.background.kind === "pattern") expect(css).toMatch(/^url\("data:image\/svg\+xml;charset=utf-8,/);
      if (preset.background.kind === "solid") expect(isHexColor(css)).toBe(true);
    }
    expect(backgroundCss({ kind: "image", src: "https://example.com/a.jpg" }, resolve)).toContain('url("https://example.com/a.jpg")');
  });

  it("renders every pattern tile", () => {
    for (const kind of Object.keys(ALL_PATTERNS) as PatternKind[]) {
      const svg = patternTileSvg(kind, "#3D4ED7");
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });
});

describe("shapes", () => {
  it("covers every ShapeKind", () => {
    expect(SHAPES.map((shape) => shape.kind).sort()).toEqual(Object.keys(ALL_SHAPE_KINDS).sort());
  });

  it.each(Object.keys(ALL_SHAPE_KINDS) as ShapeKind[])("%s path starts with M", (kind) => {
    for (const [w, h] of [
      [120, 80],
      [80, 120],
      [10, 10],
    ]) {
      const path = shapePath(kind, w, h);
      expect(path.startsWith("M")).toBe(true);
      expect(path).not.toMatch(/NaN|Infinity/);
    }
    const svg = shapeSvg(kind, 100, 60, { fill: "#FF0000" });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.endsWith("</svg>")).toBe(true);
  });
});

describe("icons", () => {
  it("has a large, categorized set with paths", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(150);
    const categories = new Set(ICON_CATEGORIES.map((category) => category.id));
    for (const icon of ICONS) {
      expect(icon.paths.trim().length, icon.id).toBeGreaterThan(0);
      expect(icon.paths).toMatch(/^<(path|circle|rect|line|polyline|polygon|ellipse)\b/);
      expect(categories.has(icon.category), `${icon.id} category`).toBe(true);
      expect(icon.keywords.length, `${icon.id} keywords`).toBeGreaterThan(0);
    }
  });

  it.each(ICONS.map((icon) => icon.id))("%s renders as SVG", (id) => {
    const svg = iconSvg(id, { color: "#3D4ED7", strokeWidth: 1.5, size: 32 });
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 24 24"/);
    expect(svg?.endsWith("</svg>")).toBe(true);
  });

  it("looks up aliases and searches", () => {
    expect(getIcon("home")?.id).toBe("house");
    expect(getIcon("Check Circle")?.id).toBe("circle-check");
    expect(getIcon("definitely-not-an-icon")).toBeUndefined();
    expect(iconSvg("definitely-not-an-icon")).toBeNull();
    expect(iconDataUrl("book-open")).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    expect(searchIcons("book")[0]?.id).toBe("book");
    expect(searchIcons("graduation").some((icon) => icon.id === "graduation-cap")).toBe(true);
    expect(searchIcons("", 5)).toHaveLength(5);
  });
});

describe("charts", () => {
  it("lists every chart kind with sample data", () => {
    expect(CHART_KINDS.map((kind) => kind.id).sort()).toEqual(Object.keys(ALL_CHART_KINDS).sort());
    for (const kind of Object.keys(ALL_CHART_KINDS) as ChartKind[]) expect(SAMPLE_CHART_DATA[kind].length).toBeGreaterThan(0);
  });

  it.each(Object.keys(ALL_CHART_KINDS) as ChartKind[])("%s renders SVG", (kind) => {
    for (const [w, h] of [
      [480, 300],
      [160, 160],
    ]) {
      const svg = chartSvg({ chart: kind, data: [...SAMPLE_CHART_DATA[kind]], showLabels: true }, CHART_COLORS, w, h);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
    const empty = chartSvg({ chart: kind, data: [] }, CHART_COLORS, 300, 200);
    expect(empty.startsWith("<svg")).toBe(true);
    expect(empty).not.toMatch(/NaN|Infinity|undefined/);
    const zeros = chartSvg({ chart: kind, data: [{ label: "<b>", value: 0 }] }, CHART_COLORS, 300, 200);
    expect(zeros).not.toMatch(/NaN|Infinity|<b>/);
  });
});

describe("element kits", () => {
  it("cover every category", () => {
    const used = new Set(ELEMENT_KITS.map((kit) => kit.category));
    for (const category of ELEMENT_CATEGORIES) expect(used.has(category.id), category.id).toBe(true);
    expect(getElementKit("callout-tip")).toBeDefined();
    expect(searchElementKits("sticky").length).toBeGreaterThan(0);
  });

  const placements = [
    { x: 0.1, y: 0.1 },
    { x: 0.95, y: 0.95, scale: 2 },
    { x: 0, y: 0, width: 1080, height: 1350 },
    { x: 0.5, y: 0.5, scale: 3, width: 1600, height: 900 },
  ];

  it.each(ELEMENT_KITS.map((kit) => [kit.id, kit] as const))("%s builds valid elements", (_, kit) => {
    for (const placement of placements) {
      const elements: SceneElement[] = kit.build({ ...placement, newId: counter(kit.id) });
      expect(elements.length).toBeGreaterThan(0);
      expectUnique(
        elements.map((element) => element.id),
        `${kit.id} element ids`,
      );
      for (const element of elements) {
        expect(element.id).toBeTruthy();
        const label = `${kit.id}/${element.kind}`;
        for (const value of [element.x, element.y, element.w, element.h]) expect(Number.isFinite(value), label).toBe(true);
        expect(element.w, label).toBeGreaterThan(0);
        expect(element.h, label).toBeGreaterThan(0);
        expect(element.x, label).toBeGreaterThanOrEqual(0);
        expect(element.y, label).toBeGreaterThanOrEqual(0);
        expect(element.x + element.w, label).toBeLessThanOrEqual(1 + 1e-9);
        expect(element.y + element.h, label).toBeLessThanOrEqual(1 + 1e-9);
        if (element.kind === "icon") expect(getIcon(element.icon), `${kit.id} icon ${element.icon}`).toBeDefined();
      }
    }
  });
});

describe("templates", () => {
  it("has about 30 templates across every category", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(28);
    const used = new Set(TEMPLATES.map((entry) => entry.category));
    for (const category of TEMPLATE_CATEGORIES) expect(used.has(category), category).toBe(true);
  });

  it.each(TEMPLATES.map((entry) => [entry.id, entry] as const))("%s references resolve", (_, entry) => {
    expect(findFormat(entry.formatId), `${entry.id} format`).toBeDefined();
    expect(findDeckTheme(entry.themeId), `${entry.id} theme`).toBeDefined();
    if (entry.fontPairId) expect(findFontPair(entry.fontPairId), `${entry.id} font pair`).toBeDefined();
    expect(entry.pages.length).toBeGreaterThan(0);
    expect(entry.tags.length).toBeGreaterThan(0);
    if (entry.layoutHints) {
      expect(entry.layoutHints).toHaveLength(entry.pages.length);
      for (const hint of entry.layoutHints) if (hint) expect(LAYOUT_HINT_IDS).toContain(hint);
    }
    for (const page of entry.pages) {
      expect(page.title.trim().length).toBeGreaterThan(0);
      for (const icon of contentIcons(page)) expect(getIcon(icon), `${entry.id} icon ${icon}`).toBeDefined();
      if (page.question?.choices && typeof page.question.answer === "number") {
        expect(page.question.answer).toBeLessThan(page.question.choices.length);
      }
    }
  });

  it("finds and searches templates", () => {
    expect(getTemplate("lesson-intro")?.pages).toHaveLength(8);
    expect(getTemplate("missing")).toBeUndefined();
    expect(searchTemplates("flashcards")[0]?.id).toBe("flashcards");
    expect(searchTemplates("quiz").some((entry) => entry.id === "quiz-review")).toBe(true);
    expect(searchTemplates("", "Social").every((entry) => entry.category === "Social")).toBe(true);
    expect(searchTemplates("zzzz-nothing")).toEqual([]);
  });
});

function rgbDistance(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) throw new Error(`not hex: ${a} ${b}`);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
}

function svgTexts(svg: string): { x: number; y: number; fill: string; value: string }[] {
  return [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" fill="([^"]*)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    fill: m[3],
    value: m[4],
  }));
}

function svgRects(svg: string): { x: number; width: number; fill: string }[] {
  return [...svg.matchAll(/<rect x="([-\d.]+)" y="[-\d.]+" width="([-\d.]+)"[^>]*fill="([^"]*)"/g)].map((m) => ({
    x: Number(m[1]),
    width: Number(m[2]),
    fill: m[3],
  }));
}

function buildKit(id: string): SceneElement[] {
  const entry = getElementKit(id);
  if (!entry) throw new Error(`missing kit ${id}`);
  return entry.build({ x: 0.1, y: 0.1, newId: counter(id) });
}

describe("review fixes: element kits", () => {
  it("no kit emits an engine slot, so relayout never drops or re-reads kit elements", () => {
    for (const entry of ELEMENT_KITS) {
      for (const element of entry.build({ x: 0, y: 0, newId: counter(entry.id) })) {
        expect(element.slot, `${entry.id}/${element.id}`).toBeUndefined();
      }
    }
  });

  it("no kit shape is faded, so onAccent labels keep their contrast", () => {
    for (const entry of ELEMENT_KITS) {
      for (const element of entry.build({ x: 0.1, y: 0.1, newId: counter(entry.id) })) {
        if (element.kind === "shape") expect(element.opacity ?? 1, `${entry.id} shape opacity`).toBe(1);
      }
    }
    expect(buildKit("process-chevrons").filter((element) => element.kind === "shape")).toHaveLength(4);
  });

  it.each(DECK_THEMES.map((deckTheme) => [deckTheme.id, deckTheme] as const))("%s: themed kit text meets WCAG AA on its backing", (_, deckTheme) => {
    const colors = deckTheme.colors;
    for (const entry of ELEMENT_KITS) {
      const elements = entry.build({ x: 0.1, y: 0.1, newId: counter(entry.id) });
      elements.forEach((element, index) => {
        if (element.kind !== "text" || !element.color) return;
        const cx = element.x + element.w / 2;
        const cy = element.y + element.h / 2;
        const backing = elements
          .slice(0, index)
          .reverse()
          .find(
            (other) =>
              other.kind === "shape" &&
              Boolean(other.fill) &&
              other.fill !== "transparent" &&
              cx >= other.x &&
              cx <= other.x + other.w &&
              cy >= other.y &&
              cy <= other.y + other.h,
          );
        const backingPaint = backing?.kind === "shape" && backing.fill ? backing.fill : "bg";
        const size = element.fontSize ?? 0;
        const large = size >= 24 || (size >= 18.66 && (element.fontWeight ?? 400) >= 700);
        expect(
          contrastRatio(resolvePaint(element.color, colors), resolvePaint(backingPaint, colors)),
          `${entry.id}: "${element.text}" ${element.color} on ${backingPaint}`,
        ).toBeGreaterThanOrEqual(large ? 3 : 4.5);
      });
    }
  });

  it("answer choice letters use onAccent on accent, and the outline chip label uses text", () => {
    const letters = buildKit("quiz-choices").filter((element) => element.kind === "text" && element.role === "number");
    expect(letters).toHaveLength(4);
    for (const letter of letters) expect(letter.kind === "text" && letter.color).toBe("onAccent");
    const chip = buildKit("chip-outline").find((element) => element.kind === "text");
    expect(chip?.kind === "text" && chip.color).toBe("text");
  });

  it("match pairs has no pre-drawn connectors, only anchor dots", () => {
    const shapes = buildKit("quiz-match").filter((element) => element.kind === "shape");
    expect(shapes.some((element) => element.kind === "shape" && /line/.test(element.shape))).toBe(false);
    expect(shapes.filter((element) => element.kind === "shape" && element.shape === "circle")).toHaveLength(6);
  });

  it("fill-in-the-blank line sits on the sentence baseline, not through its middle", () => {
    const elements = buildKit("quiz-fill-blank");
    const sentence = elements.find((element) => element.kind === "text" && element.text === "Water freezes at");
    const line = elements.find((element) => element.kind === "shape" && element.shape === "line");
    if (!sentence || !line) throw new Error("fill-blank parts missing");
    const lineY = line.y + line.h / 2;
    expect(lineY).toBeGreaterThan(sentence.y + sentence.h * 0.6);
    expect(lineY).toBeLessThan(sentence.y + sentence.h);
  });

  it("photo card and sticky notes keep frame and content aligned (no rotation)", () => {
    for (const id of ["frame-polaroid", "sticky-yellow", "sticky-pink", "sticky-blue", "sticky-green", "sticky-orange"]) {
      for (const element of buildKit(id)) expect(element.rotation, `${id}/${element.kind}`).toBeUndefined();
    }
  });
});

describe("review fixes: templates", () => {
  it("quiz-review title matches its question count", () => {
    const quiz = getTemplate("quiz-review");
    const questions = quiz?.pages.filter((page) => page.question).length ?? 0;
    expect(questions).toBe(4);
    expect(quiz?.pages[0].subtitle).toBe(`${questions} questions`);
  });

  it.each(TEMPLATES.map((entry) => [entry.id, entry] as const))("%s composes to its own page count", (_, entry) => {
    const deck = composeTemplate(entry, { seed: 7 });
    expect(deck.pages.map((page) => page.layoutId)).toHaveLength(entry.pages.length);
  });
});

describe("review fixes: themes and backgrounds", () => {
  it("themeColors ignores undefined or empty overrides", () => {
    for (const deckTheme of DECK_THEMES) {
      const colors = themeColors(deckTheme, { accent: undefined, accent2: "", text: "#123456" });
      expect(resolvePaint("accent", colors)).toBe(deckTheme.colors.accent);
      expect(colors.accent2).toBe(deckTheme.colors.accent2);
      expect(colors.text).toBe("#123456");
    }
    expect(themeColors(DECK_THEMES[0])).toBe(DECK_THEMES[0].colors);
  });

  it("theme-dependent presets carry no fixed light flag, and presetIsLight follows the theme", () => {
    for (const preset of BACKGROUND_PRESETS) {
      const fixed = backgroundStops(preset.background).every((stop) => isHexColor(stop));
      if (fixed) expect(typeof preset.light, preset.id).toBe("boolean");
      else expect(preset.light, preset.id).toBeUndefined();
    }
    const themeBg = getBackgroundPreset("theme-bg");
    const ink = getBackgroundPreset("ink");
    if (!themeBg || !ink) throw new Error("presets missing");
    for (const deckTheme of DECK_THEMES) {
      expect(presetIsLight(themeBg, deckTheme.colors), deckTheme.id).toBe(deckTheme.mode === "light");
      expect(presetIsLight(ink, deckTheme.colors), deckTheme.id).toBe(false);
    }
  });
});

describe("review fixes: shapes and icons", () => {
  it("shapePath falls back to a rectangle for unknown kinds", () => {
    const path = shapePath("nope" as ShapeKind, 10, 10);
    expect(path.startsWith("M")).toBe(true);
    expect(path).not.toMatch(/undefined|NaN/);
  });

  it("resolves the spec's legacy icon names", () => {
    expect(getIcon("flask")?.id).toBe("flask-conical");
    expect(getIcon("tree")?.id).toBe("tree-deciduous");
  });
});

describe("review fixes: charts", () => {
  const themeChartColors = (colors: Record<ColorToken, string>): ChartColors => ({
    accent: colors.accent,
    accent2: colors.accent2,
    text: colors.text,
    muted: colors.muted,
    surface2: colors.surface2,
  });

  it.each(DECK_THEMES.map((deckTheme) => [deckTheme.id, deckTheme] as const))("%s series colours stay distinct", (_, deckTheme) => {
    const chartColors = themeChartColors(deckTheme.colors);
    const first = seriesColors(chartColors, 3);
    for (let i = 0; i < 3; i += 1) {
      for (let j = i + 1; j < 3; j += 1) expect(rgbDistance(first[i], first[j]), `${deckTheme.id} ${i}/${j}`).toBeGreaterThanOrEqual(40);
    }
    for (let n = 2; n <= 12; n += 1) {
      const series = seriesColors(chartColors, n);
      expect(series).toHaveLength(n);
      for (let i = 0; i < n - 1; i += 1) expect(rgbDistance(series[i], series[i + 1]), `${deckTheme.id} n=${n} ${i}`).toBeGreaterThanOrEqual(40);
      expect(rgbDistance(series[n - 1], series[0]), `${deckTheme.id} n=${n} wrap`).toBeGreaterThanOrEqual(40);
    }
  });

  it("plots negative values below zero instead of clamping them", () => {
    const lineData = [
      { label: "a", value: -5 },
      { label: "b", value: 10 },
      { label: "c", value: -20 },
    ];
    const line = chartSvg({ chart: "line", data: lineData }, CHART_COLORS, 400, 240);
    const cys = [...line.matchAll(/<circle cx="[-\d.]+" cy="([-\d.]+)"/g)].map((m) => Number(m[1]));
    expect(cys).toHaveLength(3);
    expect(new Set(cys).size).toBe(3);
    expect(cys[2]).toBeGreaterThan(cys[0]);
    expect(cys[0]).toBeGreaterThan(cys[1]);

    const barData = [
      { label: "Loss", value: -3 },
      { label: "Gain", value: 6 },
    ];
    const bar = chartSvg({ chart: "bar", data: barData, showLabels: true }, CHART_COLORS, 480, 300);
    expect(svgTexts(bar).some((t) => t.value === "-3")).toBe(true);
    const bars = svgRects(bar).filter((r) => r.fill === CHART_COLORS.accent);
    expect(bars).toHaveLength(2);
    expect(bars[0].x + bars[0].width).toBeCloseTo(bars[1].x, 1);

    const columnData = [
      { label: "a", value: -4 },
      { label: "b", value: 8 },
    ];
    const column = chartSvg({ chart: "column", data: columnData, showLabels: true }, CHART_COLORS, 480, 300);
    expect(svgTexts(column).some((t) => t.value === "-4")).toBe(true);
    expect(column).not.toMatch(/NaN|Infinity/);
  });

  it("bar chart draws no bar for zero and never outgrows its viewBox", () => {
    const zeroData = [
      { label: "None", value: 0 },
      { label: "All", value: 100 },
    ];
    const zero = chartSvg({ chart: "bar", data: zeroData, showLabels: true }, CHART_COLORS, 480, 300);
    expect(svgRects(zero).filter((r) => r.fill === CHART_COLORS.accent)).toHaveLength(1);
    const narrow = chartSvg({ chart: "bar", data: [...SAMPLE_CHART_DATA.bar], showLabels: true }, CHART_COLORS, 100, 400);
    for (const rect of svgRects(narrow)) {
      expect(rect.width).toBeLessThanOrEqual(100);
      expect(rect.x + rect.width).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it("bar chart leaves room for four-digit values", () => {
    const width = 480;
    const fs = 18;
    const data = [
      { label: "Pages", value: 1250 },
      { label: "Words", value: 300 },
    ];
    const svg = chartSvg({ chart: "bar", data, showLabels: true }, CHART_COLORS, width, 300);
    const value = svgTexts(svg).find((t) => t.value === "1250");
    expect(value).toBeDefined();
    expect(width - (value?.x ?? width)).toBeGreaterThanOrEqual(4 * 0.6 * fs);
  });

  it.each(["column", "line"] as const)("%s axis labels never overlap when there are many points", (kind) => {
    const data = Array.from({ length: 12 }, (_, i) => ({ label: `Week ${i + 1}`, value: 10 + i }));
    const svg = chartSvg({ chart: kind, data, showLabels: true }, CHART_COLORS, 480, 270);
    const fs = 16;
    const axis = svgTexts(svg)
      .filter((t) => t.fill === CHART_COLORS.muted)
      .sort((a, b) => a.x - b.x);
    expect(axis.length).toBeGreaterThan(1);
    for (let i = 1; i < axis.length; i += 1) {
      const needed = ((axis[i - 1].value.length + axis[i].value.length) / 2) * fs * 0.58;
      expect(axis[i].x - axis[i - 1].x, `${kind} ${axis[i - 1].value} to ${axis[i].value}`).toBeGreaterThanOrEqual(needed);
    }
  });

  it("donut, pie and progress treat negative values as zero everywhere they print", () => {
    const data = [
      { label: "Lost", value: -10 },
      { label: "Kept", value: 20 },
    ];
    const donut = chartSvg({ chart: "donut", data, showLabels: true }, CHART_COLORS, 480, 240);
    const printed = svgTexts(donut).map((t) => t.value);
    expect(printed).toContain("0%");
    expect(printed).toContain("Lost · 0%");
    expect(printed.some((value) => value.includes("-"))).toBe(false);
    const pie = chartSvg({ chart: "pie", data, showLabels: true }, CHART_COLORS, 480, 240);
    expect(svgTexts(pie).map((t) => t.value)).toContain("Kept · 100%");

    const progress = chartSvg({ chart: "progress", data: [{ label: "Done", value: -5 }, { label: "Goal", value: -10 }] }, CHART_COLORS, 200, 200);
    expect(svgTexts(progress).map((t) => t.value)).toContain("0%");
  });
});
