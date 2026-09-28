import { describe, expect, it } from "vitest";
import { DECK_THEMES, LAYOUT_HINT_IDS, TEMPLATES, getDeckTheme, getFontPair, getFormat, getIcon } from "@/lib/studio/library";
import { composeDeck, composeTemplate, createLayoutContext, layoutPage } from "../auto-layout";
import { measureTextAt, wordsFit } from "../fit";
import { createApproxMeasurer } from "../measure";
import { backgroundBaseColor, colorContrast, resolveThemePaint } from "../paint";
import type { DeckKind, DeckTheme, SceneDeck, SceneElement, ScenePage, SlideContent } from "../scene";
import { resolveTextElementStyle, resolveTextStyle } from "../text-styles";
import { FALLBACK_LAYOUT_ID, FLOW_LAYOUT_ID, HERO_LAYOUT_IDS, LAYOUTS, LAYOUT_IDS, getLayout } from "./index";
import { DARK_THEME, FONT_PAIR, FORMATS, KITCHEN_SINK, LIGHT_THEME, SAMPLES } from "./test-fixtures";

const EPS = 1.0001;

function problems(elements: SceneElement[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const el of elements) {
    const where = `${el.id} (${el.kind}/${el.role}/${el.slot ?? "-"})`;
    if (ids.has(el.id)) out.push(`duplicate id ${where}`);
    ids.add(el.id);
    for (const key of ["x", "y", "w", "h"] as const) {
      if (!Number.isFinite(el[key])) out.push(`${where}: ${key} is not finite`);
    }
    if (el.x < -1e-4 || el.y < -1e-4) out.push(`${where}: negative position ${el.x},${el.y}`);
    if (el.w < 0 || el.h < 0) out.push(`${where}: negative size ${el.w}x${el.h}`);
    if (el.x + el.w > EPS) out.push(`${where}: x+w=${el.x + el.w}`);
    if (el.y + el.h > EPS) out.push(`${where}: y+h=${el.y + el.h}`);
    if (el.kind === "text") {
      if (!el.text.trim()) out.push(`${where}: empty text`);
      if (el.fontSize !== undefined && !(el.fontSize > 0)) out.push(`${where}: fontSize ${el.fontSize}`);
    }
    if (el.kind === "icon" && getIcon(el.icon)?.id !== el.icon) out.push(`${where}: unknown icon "${el.icon}"`);
  }
  return out;
}

const FORMAT_LIST = Object.entries(FORMATS);
const THEMES: [string, DeckTheme][] = [
  ["light", LIGHT_THEME],
  ["dark", DARK_THEME],
];

describe("layout registry", () => {
  it("registers 47 unique layouts", () => {
    expect(LAYOUTS).toHaveLength(47);
    expect(new Set(LAYOUT_IDS).size).toBe(LAYOUTS.length);
  });

  it("registers exactly the library's layout hint ids", () => {
    expect([...LAYOUT_IDS].sort()).toEqual([...LAYOUT_HINT_IDS].sort());
  });

  it("has a sample content for every layout", () => {
    expect([...LAYOUT_IDS].sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it("resolves ids and the special layouts", () => {
    for (const id of LAYOUT_IDS) expect(getLayout(id)?.id).toBe(id);
    expect(getLayout("nope")).toBeUndefined();
    expect(getLayout(undefined)).toBeUndefined();
    expect(getLayout(FALLBACK_LAYOUT_ID)).toBeDefined();
    expect(getLayout(FLOW_LAYOUT_ID)).toBeDefined();
    for (const id of HERO_LAYOUT_IDS) expect(getLayout(id), id).toBeDefined();
  });

  it("gives every layout a name and at least one content kind", () => {
    for (const layout of LAYOUTS) {
      expect(layout.name.length, layout.id).toBeGreaterThan(0);
      expect(layout.kinds.length, layout.id).toBeGreaterThan(0);
    }
  });
});

describe.each(FORMAT_LIST)("layouts in %s", (_name, format) => {
  describe.each(THEMES)("%s theme", (_themeName, theme) => {
    const ctxFor = () =>
      createLayoutContext({ width: format.width, height: format.height, theme, fontPair: FONT_PAIR, deckKind: format.kind, seed: 7 });

    it.each(LAYOUTS.map((layout) => [layout.id]))("%s builds valid elements from its sample", (id) => {
      const layout = getLayout(id);
      if (!layout) throw new Error(`missing ${id}`);
      const content = SAMPLES[id];
      const result = layout.build(content, ctxFor());
      expect(result.elements.length).toBeGreaterThan(0);
      expect(problems(result.elements)).toEqual([]);
      expect(result.elements.some((el) => el.kind === "text" && el.slot === "title" && el.text.length > 0) || !content.title).toBe(true);
    });

    it.each(LAYOUTS.map((layout) => [layout.id]))("%s builds valid elements from kitchen-sink content", (id) => {
      const layout = getLayout(id);
      if (!layout) throw new Error(`missing ${id}`);
      const result = layout.build(KITCHEN_SINK, ctxFor());
      expect(result.elements.length).toBeGreaterThan(0);
      expect(problems(result.elements)).toEqual([]);
    });
  });
});

describe.each(DECK_THEMES.map((theme) => [theme.id, theme] as const))("every layout on the %s theme", (_id, theme) => {
  it("builds valid elements from every sample", () => {
    const ctx = createLayoutContext({ width: FORMATS.wide.width, height: FORMATS.wide.height, theme, fontPair: FONT_PAIR, seed: 5 });
    for (const layout of LAYOUTS) {
      const result = layout.build(SAMPLES[layout.id], ctx);
      expect(problems(result.elements), layout.id).toEqual([]);
      expect(result.background, layout.id).toBeDefined();
    }
  });
});

describe("layout behaviour", () => {
  const ctx = () => createLayoutContext({ width: 1280, height: 720, theme: LIGHT_THEME, fontPair: FONT_PAIR });

  it("scores samples above zero for their own layout in a suitable format", () => {
    for (const layout of LAYOUTS) {
      const format = layout.orientation === "portrait" ? FORMATS.a4 : FORMATS.wide;
      const c = createLayoutContext({ width: format.width, height: format.height, theme: LIGHT_THEME, fontPair: FONT_PAIR });
      expect(layout.score(SAMPLES[layout.id], c), layout.id).toBeGreaterThan(0);
    }
  });

  it("returns overflow instead of dropping bullets", () => {
    const bullets = Array.from({ length: 20 }, (_, i) => `Point number ${i + 1} with enough words to take a full line of text on the slide.`);
    const content: SlideContent = { kind: "bullets", title: "Many points", bullets };
    const layout = getLayout("bullets-simple");
    if (!layout) throw new Error("missing bullets-simple");
    const result = layout.build(content, ctx());
    expect(result.overflow).toBeDefined();
    const shown = result.elements.filter((el) => el.kind === "text" && /^bullet-\d+$/.test(el.slot ?? ""));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length + (result.overflow?.bullets?.length ?? 0)).toBeGreaterThanOrEqual(bullets.length);
    expect(result.overflow?.title).toBe(content.title);
  });

  it("builds deterministically", () => {
    for (const id of ["cards-3", "mindmap", "doc-article", "question-choices", "title-center"]) {
      const layout = getLayout(id);
      if (!layout) throw new Error(`missing ${id}`);
      const a = layout.build(SAMPLES[id], createLayoutContext({ width: 1280, height: 720, theme: LIGHT_THEME, fontPair: FONT_PAIR, seed: 3, newId: counter() }));
      const b = layout.build(SAMPLES[id], createLayoutContext({ width: 1280, height: 720, theme: LIGHT_THEME, fontPair: FONT_PAIR, seed: 3, newId: counter() }));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it("spreads a long list over pages instead of shrinking it into one", () => {
    const bullets = Array.from({ length: 14 }, (_, i) => `Short point ${i + 1}`);
    const result = getLayout("bullets-simple")?.build({ kind: "bullets", title: "Fourteen points", bullets }, ctx());
    const shown = (result?.elements ?? []).filter((el) => el.kind === "text" && /^bullet-\d+$/.test(el.slot ?? ""));
    expect(shown).toHaveLength(7);
    expect(result?.overflow?.bullets).toEqual(bullets.slice(7));
  });

  it("keeps words whole unless the text is already at its minimum size", () => {
    const measure = createApproxMeasurer();
    const broken: string[] = [];
    for (const [name, format] of FORMAT_LIST) {
      const page = { width: format.width, height: format.height, kind: format.kind };
      for (const layout of LAYOUTS) {
        const ctx = createLayoutContext({ ...page, theme: LIGHT_THEME, fontPair: FONT_PAIR, deckKind: format.kind, measure });
        for (const el of layout.build(SAMPLES[layout.id], ctx).elements) {
          if (el.kind !== "text") continue;
          const style = resolveTextElementStyle(el, FONT_PAIR, page);
          const atMin = style.fontSize <= resolveTextStyle(el.style, FONT_PAIR, page).minSize;
          if (!atMin && !wordsFit(el.text, style, style.fontSize, el.w * format.width, measure)) broken.push(`${name} ${layout.id} ${el.slot}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("shrinks square step labels instead of breaking their words", () => {
    const format = FORMATS.square;
    const page = { width: format.width, height: format.height, kind: format.kind };
    const measure = createApproxMeasurer();
    const ctx = createLayoutContext({ ...page, theme: LIGHT_THEME, fontPair: FONT_PAIR, deckKind: format.kind, measure });
    const content: SlideContent = { kind: "steps", title: "Stages", steps: ["Evaporation", "Condensation", "Precipitation", "Accumulation", "Infiltration"] };
    const labels = (getLayout("steps-horizontal")?.build(content, ctx).elements ?? []).filter((el) => el.kind === "text" && /^step-\d+$/.test(el.slot ?? ""));
    expect(labels).toHaveLength(5);
    for (const el of labels) {
      if (el.kind !== "text") continue;
      const style = resolveTextElementStyle(el, FONT_PAIR, page);
      expect(wordsFit(el.text, style, style.fontSize, el.w * format.width, measure), el.text).toBe(true);
    }
  });

  it("stores canonical library icon ids and gives unknown ones a neutral icon", () => {
    const content: SlideContent = {
      kind: "concept",
      title: "Icons",
      items: [
        { title: "Alias", body: "Old lucide name", icon: "check-circle" },
        { title: "Unknown", body: "Not in the library", icon: "no-such-icon" },
        { title: "Known", body: "Canonical", icon: "lightbulb" },
      ],
    };
    const result = getLayout("cards-3")?.build(content, ctx());
    const icons = (result?.elements ?? []).flatMap((el) => (el.kind === "icon" ? [el.icon] : []));
    expect(icons).toEqual(["circle-check", "sparkles", "lightbulb"]);
    expect((result?.elements ?? []).some((el) => el.role === "number")).toBe(false);
  });

  it("uses theme tokens rather than hex colors for generated elements", () => {
    const result = getLayout("cards-3")?.build(SAMPLES["cards-3"], ctx());
    const paints = (result?.elements ?? []).flatMap((el) => {
      const values: unknown[] = [];
      if ("color" in el) values.push(el.color);
      if ("fill" in el) values.push(el.fill);
      if ("stroke" in el) values.push(el.stroke);
      return values.filter((v): v is string => typeof v === "string");
    });
    expect(paints.length).toBeGreaterThan(0);
    for (const paint of paints) expect(paint.startsWith("#"), paint).toBe(false);
  });
});

describe("cards, badges and labels", () => {
  const porcelain = getDeckTheme("porcelain");
  const pair = getFontPair(porcelain.fontPairId);
  const measure = createApproxMeasurer();
  const ctx = (theme: DeckTheme = porcelain, format: { width: number; height: number; kind: DeckKind } = FORMATS.wide) =>
    createLayoutContext({ width: format.width, height: format.height, theme, fontPair: pair, deckKind: format.kind, seed: 2 });
  const textsOf = (elements: SceneElement[], slot: RegExp) =>
    elements.flatMap((el) => (el.kind === "text" && slot.test(el.slot ?? "") ? [el] : []));

  /** Texts whose measured bottom falls below the card they sit on. */
  function spills(deck: SceneDeck, page: ScenePage): string[] {
    const size = { width: deck.width, height: deck.height, kind: deck.kind };
    const out: string[] = [];
    for (const el of page.elements) {
      if (el.kind !== "text" || !el.slot) continue;
      const card = page.elements.find((c) => c.slot === `${el.slot?.replace(/-(title|body)$/, "")}-card`);
      if (!card) continue;
      const style = resolveTextElementStyle(el, getFontPair(deck.fontPairId), size);
      const need = measureTextAt(el.text, style, style.fontSize, el.w * deck.width, measure).height;
      if (el.y * deck.height + need > (card.y + card.h) * deck.height + 2) out.push(`${page.layoutId} ${el.slot}`);
    }
    return out;
  }

  it("moves whole cards to the next page instead of letting their text spill out", () => {
    const bullets = [
      "Arrive on time and have your notebook, pencil and calculator ready",
      "Listen carefully while others are speaking and wait for your turn",
      "Raise your hand when you want to ask or answer a question",
      "Keep your phone switched off and inside your bag during the lesson",
      "Treat the lab equipment with care and tidy up before you leave",
      "Ask for help as soon as something does not make sense to you",
    ];
    const content: SlideContent = {
      kind: "agenda",
      title: "Classroom agreements",
      subtitle: "What we expect from each other this year, written together on the first day",
      body: "Read them aloud with your partner and add one idea of your own at the bottom of the page.",
      bullets,
    };
    for (const format of [FORMATS.square, getFormat("slides-1x1")]) {
      const deck = composeDeck([content], { format, theme: porcelain, fontPair: pair, title: "a", layoutHints: ["agenda-cards"] });
      expect(deck.pages[0].layoutId).toBe("agenda-cards");
      for (const page of deck.pages) expect(spills(deck, page), format.id).toEqual([]);
      expect(deck.pages.flatMap((page) => textsOf(page.elements, /^bullet-\d+$/).map((el) => el.text))).toEqual(bullets);
    }
  });

  it("keeps every glossary definition whole on one page", () => {
    const terms = [
      ["Osmosis", "The movement of water molecules across a partially permeable membrane from a dilute solution to a more concentrated solution until balance is reached"],
      ["Diffusion", "The net movement of particles from an area where they are at a higher concentration to an area where they are at a lower concentration over time"],
      ["Active transport", "The movement of substances against a concentration gradient using energy released by respiration inside the cell membrane proteins"],
      ["Enzyme", "A biological catalyst made of protein that speeds up a chemical reaction in living cells without being used up in the reaction itself"],
      ["Mitosis", "Cell division that produces two genetically identical daughter cells used for growth and repair of tissues in multicellular organisms"],
      ["Respiration", "The chemical process in every living cell that releases energy from glucose so the organism can move, grow and keep warm"],
    ].map(([term, definition]) => ({ term, definition }));
    const content: SlideContent = { kind: "glossary", title: "Key words: cells", subtitle: "Learn these before the test", body: "Cover the definitions and test yourself. Then swap with a partner.", terms };
    for (const format of [FORMATS.square, getFormat("slides-1x1"), FORMATS.wide]) {
      const deck = composeDeck([content], { format, theme: porcelain, fontPair: pair, title: "g", layoutHints: ["glossary-grid"] });
      const shown = deck.pages.flatMap((page) => textsOf(page.elements, /^term-\d+-def$/).map((el) => el.text));
      expect(shown, format.id).toEqual(terms.map((t) => t.definition));
    }
  });

  it("never paints a badge in the fill of its card", () => {
    const same: string[] = [];
    for (const theme of DECK_THEMES) {
      for (const id of ["cards-2", "cards-3", "cards-4", "agenda-cards", "social-tip", "question-choices", "question-true-false"]) {
        const elements = getLayout(id)?.build(SAMPLES[id], ctx(theme)).elements ?? [];
        const bySlot = new Map(elements.map((el) => [el.slot, el]));
        for (const el of elements) {
          if (el.kind !== "shape" || !el.slot?.endsWith("-badge")) continue;
          const card = bySlot.get(`${el.slot.slice(0, -"-badge".length)}-card`);
          if (card?.kind !== "shape" || !card.fill || !el.fill) continue;
          if (resolveThemePaint(card.fill, theme) === resolveThemePaint(el.fill, theme)) same.push(`${theme.id} ${id} ${el.slot}`);
        }
      }
    }
    expect(same).toEqual([]);
  });

  it("keeps badge numbers at 10px (720 base) or larger", () => {
    const small: string[] = [];
    const check = (name: string, width: number, height: number, elements: SceneElement[]) => {
      const base = Math.min(width, height) / 720;
      for (const el of elements) {
        if (el.kind === "text" && el.role === "number" && el.fontSize && el.fontSize / base < 10) small.push(`${name} ${el.slot} ${el.fontSize}px`);
      }
    };
    for (const format of [FORMATS.a4, FORMATS.wide]) {
      for (const layout of LAYOUTS) check(`${format.id} ${layout.id}`, format.width, format.height, layout.build(SAMPLES[layout.id], ctx(porcelain, format)).elements);
    }
    for (const id of ["essay-outline", "exit-ticket"]) {
      const template = TEMPLATES.find((t) => t.id === id);
      if (!template) throw new Error(`missing ${id}`);
      const deck = composeTemplate(template);
      for (const page of deck.pages) check(`${id} ${page.layoutId}`, deck.width, deck.height, page.elements);
    }
    expect(small).toEqual([]);
  });

  it("gives small accent text (kickers, badge numbers) at least 4.5:1 contrast", () => {
    const low: string[] = [];
    const accentOn = (theme: DeckTheme, color: string) => colorContrast(resolveThemePaint("accent", theme), color);
    for (const theme of DECK_THEMES) {
      for (const layout of LAYOUTS) {
        const result = layout.build(SAMPLES[layout.id], ctx(theme));
        const bg = backgroundBaseColor(result.background ?? theme.background, theme);
        const bySlot = new Map(result.elements.map((el) => [el.slot, el]));
        for (const el of result.elements) {
          if (el.kind !== "text" || el.color !== "accent") continue;
          if (el.role === "kicker" && accentOn(theme, bg) < 4.5) low.push(`${theme.id} ${layout.id} kicker`);
          const badge = el.role === "number" ? bySlot.get(el.slot?.replace(/-number$/, "-badge")) : undefined;
          if (badge?.kind !== "shape") continue;
          const fill = badge.fill && badge.fill !== "transparent" ? resolveThemePaint(badge.fill, theme) : bg;
          if (accentOn(theme, fill) < 4.5) low.push(`${theme.id} ${layout.id} ${el.slot}`);
        }
      }
    }
    expect(low).toEqual([]);
  });

  it("gives every entry of an icon grid an icon when one icon id is unknown", () => {
    const content: SlideContent = {
      kind: "concept",
      title: "Inside a cell",
      items: [
        { title: "Nucleus", body: "Holds DNA", icon: "dna" },
        { title: "Mitochondria", body: "Release energy", icon: "zap" },
        { title: "Ribosomes", body: "Make proteins", icon: "cog" },
      ],
    };
    for (const id of ["bullets-icon-grid", "cards-3"]) {
      const elements = getLayout(id)?.build(content, ctx()).elements ?? [];
      expect(elements.filter((el) => el.kind === "icon" && /^item-\d+-icon$/.test(el.slot ?? "")), id).toHaveLength(3);
      expect(textsOf(elements, /^item-\d+-number$/), id).toEqual([]);
    }
  });

  it("shrinks timeline labels until no word breaks mid-word", () => {
    const content: SlideContent = {
      kind: "timeline",
      title: "Ages of Europe",
      items: [
        { title: "Renaissance", body: "Art and science revive in Italian city states" },
        { title: "Reformation", body: "Luther challenges the church and Europe splits" },
        { title: "Enlightenment", body: "Reason, rights and new ideas about government" },
        { title: "Industrialization", body: "Factories, railways and cities grow fast" },
      ],
    };
    for (const format of [FORMATS.wide, FORMATS.square]) {
      const page = { width: format.width, height: format.height, kind: format.kind };
      const labels = textsOf(getLayout("timeline-vertical")?.build(content, ctx(porcelain, format)).elements ?? [], /^item-\d+-title$/);
      expect(labels).toHaveLength(4);
      for (const el of labels) {
        const style = resolveTextElementStyle(el, pair, page);
        expect(wordsFit(el.text, style, style.fontSize, el.w * format.width, measure), `${format.id} ${el.text}`).toBe(true);
      }
    }
  });

  it("offers a mind map only for list fields it draws", () => {
    const mindmap = getLayout("mindmap");
    const stats: SlideContent = { kind: "concept", title: "Numbers", stats: [{ value: "1", label: "a" }, { value: "2", label: "b" }, { value: "3", label: "c" }] };
    expect(mindmap?.score(stats, ctx())).toBe(0);
    expect(mindmap?.score(SAMPLES.mindmap, ctx())).toBeGreaterThan(0);
  });

  it("shows the caption under each certificate signature and keeps it in the content", () => {
    const items = [
      { title: "Ms. Rivera", body: "Class teacher" },
      { title: "June 2026", body: "Date awarded" },
    ];
    const [page] = layoutPage({ kind: "title", kicker: "Certificate of achievement", title: "Ada Lovelace", items }, ctx(), "certificate");
    expect(page.layoutId).toBe("certificate");
    const shown = textsOf(page.elements, /^item-\d+-(title|body)$/).map((el) => el.text);
    expect(shown).toEqual(["Ms. Rivera", "Class teacher", "June 2026", "Date awarded"]);
    expect(page.content?.items).toEqual(items);
  });

  it("puts the certificate on the content background", () => {
    expect(HERO_LAYOUT_IDS).not.toContain("certificate");
    expect(getLayout("certificate")?.build(SAMPLES.certificate, ctx()).background).toEqual(porcelain.background);
  });
});

function counter(): () => string {
  let n = 0;
  return () => `t-${n++}`;
}
