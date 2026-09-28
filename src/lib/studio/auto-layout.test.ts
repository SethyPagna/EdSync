import { describe, expect, it } from "vitest";
import { TEMPLATES, getBackgroundPreset, getDeckTheme, getFontPair, getFormat } from "@/lib/studio/library";
import {
  candidateLayouts,
  composeDeck,
  composeTemplate,
  contentFromElements,
  contentWeight,
  createIdFactory,
  createLayoutContext,
  layoutPage,
  mergeContent,
  pageFromContent,
  reflowDeck,
  relayoutPage,
  scaleElement,
  shuffleLayout,
  type ComposeOptions,
} from "./auto-layout";
import { measureTextAt } from "./fit";
import { DARK_THEME, FONT_PAIR, FORMATS, KITCHEN_SINK, LIGHT_THEME, SAMPLES } from "./layouts/test-fixtures";
import { createApproxMeasurer } from "./measure";
import type { SceneDeck, SceneElement, ScenePage, SlideContent, TextElement, TextMeasurer } from "./scene";
import { resolveTextElementStyle } from "./text-styles";

const wide = (extra: Partial<Parameters<typeof createLayoutContext>[0]> = {}) =>
  createLayoutContext({ width: 1280, height: 720, theme: LIGHT_THEME, fontPair: FONT_PAIR, ...extra });

const LONG_BULLETS = Array.from(
  { length: 14 },
  (_, i) => `Bullet ${i + 1}: a long point about the water cycle that explains one idea in enough detail to wrap over two lines.`,
);

function inBounds(elements: SceneElement[]): boolean {
  return elements.every((el) => el.x >= -1e-4 && el.y >= -1e-4 && el.x + el.w <= 1.0001 && el.y + el.h <= 1.0001);
}

function mergedContent(pages: ScenePage[]): SlideContent {
  return pages.map((page) => page.content as SlideContent).reduce((a, b) => mergeContent(a, b));
}

const texts = (page: ScenePage) => page.elements.filter((el): el is TextElement => el.kind === "text");

describe("createIdFactory", () => {
  it("produces deterministic, unique ids", () => {
    const a = createIdFactory("el", 42);
    const b = createIdFactory("el", 42);
    const first = [a(), a(), a()];
    expect(first).toEqual([b(), b(), b()]);
    expect(new Set(first).size).toBe(3);
    expect(first[0]).toBe(`el-${(42).toString(36)}-0`);
  });

  it("gives separate contexts separate id prefixes", () => {
    expect(wide().newId()).not.toBe(wide().newId());
  });
});

describe("candidateLayouts (scoring)", () => {
  it("returns positive scores, best first", () => {
    const ranked = candidateLayouts(SAMPLES["bullets-simple"], wide());
    expect(ranked.length).toBeGreaterThan(1);
    for (let i = 1; i < ranked.length; i += 1) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    for (const c of ranked) expect(c.score).toBeGreaterThan(0);
  });

  it("prefers cards-3 or a bullets layout for 3 bullets", () => {
    const content: SlideContent = { kind: "bullets", title: "Three ideas", bullets: ["Plan the work", "Work the plan", "Review the results"] };
    expect(candidateLayouts(content, wide())[0].id).toMatch(/^(cards-3|bullets-)/);
  });

  it("prefers stats-row for several stats", () => {
    const content: SlideContent = {
      kind: "stats",
      title: "By the numbers",
      stats: [
        { value: "71%", label: "of Earth is covered by water" },
        { value: "3%", label: "is fresh water" },
        { value: "9 days", label: "average vapor lifetime" },
      ],
    };
    expect(candidateLayouts(content, wide())[0].id).toBe("stats-row");
  });

  it("prefers question-choices for a 4-choice question", () => {
    const content: SlideContent = {
      kind: "question",
      title: "Check",
      question: { prompt: "Which gas do plants absorb?", choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], answer: 1 },
    };
    expect(candidateLayouts(content, wide())[0].id).toBe("question-choices");
  });

  it("prefers a doc layout for document content on A4 portrait", () => {
    const content: SlideContent = {
      kind: "concept",
      title: "Photosynthesis",
      body: "Plants use sunlight, water and carbon dioxide to make glucose and oxygen. ".repeat(6),
      bullets: ["Happens in chloroplasts", "Needs light energy", "Releases oxygen"],
    };
    const docCtx = createLayoutContext({ width: 794, height: 1123, theme: LIGHT_THEME, fontPair: FONT_PAIR, deckKind: "doc" });
    expect(candidateLayouts(content, docCtx)[0].id).toMatch(/^doc-/);
    const plain = createLayoutContext({ width: 794, height: 1123, theme: LIGHT_THEME, fontPair: FONT_PAIR });
    expect(candidateLayouts(content, plain)[0].id).toMatch(/^doc-/);
  });

  it("never offers landscape-only layouts on a portrait page", () => {
    const portrait = createLayoutContext({ width: 794, height: 1123, theme: LIGHT_THEME, fontPair: FONT_PAIR });
    const ids = candidateLayouts(SAMPLES["steps-horizontal"], portrait).map((c) => c.id);
    expect(ids).not.toContain("steps-horizontal");
  });

  it("penalizes the most recent layout", () => {
    const content = SAMPLES["cards-3"];
    const fresh = candidateLayouts(content, wide()).find((c) => c.id === "cards-3")?.score ?? 0;
    const repeated = candidateLayouts(content, wide({ recent: ["cards-3"] })).find((c) => c.id === "cards-3")?.score ?? 0;
    expect(repeated).toBeLessThan(fresh);
  });
});

describe("layoutPage", () => {
  const content: SlideContent = { kind: "bullets", title: "The water cycle in detail", bullets: LONG_BULLETS };

  it("splits 14 long bullets over several pages without losing any", () => {
    const pages = layoutPage(content, wide());
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].content?.continued).toBeFalsy();
    for (const page of pages.slice(1)) expect(page.content?.continued).toBe(true);
    expect(mergedContent(pages).bullets).toEqual(LONG_BULLETS);
    for (const page of pages) {
      expect(page.content?.title).toBe(content.title);
      const title = texts(page).find((el) => el.slot === "title");
      expect(title?.text).toBe(content.title);
      for (const el of texts(page)) expect(el.text).not.toMatch(/\(cont/i);
      expect(inBounds(page.elements)).toBe(true);
    }
    const shown = pages.flatMap((page) => texts(page).filter((el) => /^bullet-\d+$/.test(el.slot ?? "")).map((el) => el.text));
    for (const bullet of LONG_BULLETS) expect(shown.join(" ")).toContain(bullet.slice(0, 20));
  });

  it("keeps every bullet on A4 portrait and square pages too", () => {
    for (const format of [FORMATS.a4, FORMATS.square]) {
      const ctx = createLayoutContext({ width: format.width, height: format.height, theme: LIGHT_THEME, fontPair: FONT_PAIR, deckKind: format.kind });
      const pages = layoutPage(content, ctx);
      expect(mergedContent(pages).bullets).toEqual(LONG_BULLETS);
    }
  });

  it("uses the requested layout and page id", () => {
    const pages = layoutPage(SAMPLES["cards-3"], wide(), "cards-3", "page-x");
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: "page-x", layoutId: "cards-3" });
  });

  it("continues long body text without dropping words", () => {
    const body = "Sentence about evaporation and clouds forming over the sea. ".repeat(60).trim();
    const pages = layoutPage({ kind: "concept", title: "Long read", body }, wide(), "bullets-simple");
    expect(pages.length).toBeGreaterThan(1);
    expect(mergedContent(pages).body?.split(/\s+/)).toEqual(body.split(/\s+/));
  });

  it("gives every page unique element ids", () => {
    const pages = layoutPage(content, wide());
    const ids = pages.flatMap((page) => page.elements.map((el) => el.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("pageFromContent", () => {
  it("returns the page content that was rendered and the overflow", () => {
    const { page, overflow } = pageFromContent({ kind: "bullets", title: "Many", bullets: LONG_BULLETS }, wide(), "bullets-simple", "p1");
    expect(page.id).toBe("p1");
    expect(overflow?.bullets?.length).toBeGreaterThan(0);
    const shown = page.content?.bullets ?? [];
    expect(shown.length + (overflow?.bullets?.length ?? 0)).toBeGreaterThanOrEqual(LONG_BULLETS.length);
    expect(page.elements.every((el) => el.slot)).toBe(true);
  });
});

describe("contentWeight / mergeContent / contentFromElements", () => {
  it("weights content by its visible text", () => {
    expect(contentWeight({ kind: "title", title: "Only a title" })).toBe(0);
    expect(contentWeight({ kind: "bullets", title: "T", bullets: ["abc", "de"] })).toBe(7);
  });

  it("merges a continuation back into the original", () => {
    const a = { kind: "bullets", title: "T", bullets: ["one", "two"], body: "Start." } as SlideContent;
    const b = { kind: "bullets", title: "T", bullets: ["three"], body: "End.", continued: true } as SlideContent;
    const merged = mergeContent(a, b);
    expect(merged.bullets).toEqual(["one", "two", "three"]);
    expect(merged.body).toBe("Start. End.");
    expect(merged.continued).toBeUndefined();
  });

  it("rejoins a bullet split across pages", () => {
    const a = { kind: "bullets", title: "T", bullets: ["one", "two first half"] } as SlideContent;
    const b = { kind: "bullets", title: "T", bullets: ["second half", "three"], listStart: 1 } as SlideContent;
    expect(mergeContent(a, b).bullets).toEqual(["one", "two first half second half", "three"]);
  });

  it("rebuilds content from slotted elements", () => {
    const base: SlideContent = { kind: "compare", title: "Old", imageQuery: "q" };
    const el = (slot: string, text: string): SceneElement => ({ id: slot, kind: "text", role: "body", slot, text, style: "body", x: 0, y: 0, w: 1, h: 0.1 });
    const content = contentFromElements(
      [el("title", "New"), el("a-label", "A"), el("a-point-0", "a1"), el("b-label", "B"), el("b-point-0", "b1"), el("quote", "Q"), el("author", "— Ann")],
      base,
    );
    expect(content).toMatchObject({
      title: "New",
      imageQuery: "q",
      compare: { a: { label: "A", points: ["a1"] }, b: { label: "B", points: ["b1"] } },
      quote: { text: "Q", author: "Ann" },
    });
  });
});

const CONTENTS: SlideContent[] = [
  SAMPLES["title-center"],
  SAMPLES["agenda-list"],
  { kind: "bullets", title: "Why it matters", bullets: ["Weather", "Farming", "Drinking water"] },
  { kind: "bullets", title: "What drives it", bullets: ["The sun", "Gravity", "Wind"] },
  { kind: "bullets", title: "Where water is", bullets: ["Oceans", "Ice caps", "Groundwater", "Lakes"] },
  SAMPLES["steps-horizontal"],
  SAMPLES["stats-row"],
  SAMPLES["compare-columns"],
  SAMPLES["question-choices"],
  { kind: "bullets", title: "Many points", bullets: LONG_BULLETS },
  SAMPLES["closing-thanks"],
];

const composeOptions = (extra: Partial<ComposeOptions> = {}): ComposeOptions => ({
  format: FORMATS.wide,
  theme: LIGHT_THEME,
  fontPair: FONT_PAIR,
  title: "The water cycle",
  seed: 1234,
  ...extra,
});

describe("composeDeck", () => {
  it("builds a v2 deck", () => {
    const deck = composeDeck(CONTENTS, composeOptions());
    expect(deck).toMatchObject({ v: 2, kind: "slides", formatId: FORMATS.wide.id, width: 1280, height: 720, themeId: LIGHT_THEME.id, fontPairId: FONT_PAIR.id, seed: 1234 });
    expect(deck.pages.length).toBeGreaterThan(CONTENTS.length);
    const pageIds = deck.pages.map((page) => page.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    const elementIds = deck.pages.flatMap((page) => page.elements.map((el) => el.id));
    expect(new Set(elementIds).size).toBe(elementIds.length);
    for (const page of deck.pages) expect(inBounds(page.elements)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    expect(JSON.stringify(composeDeck(CONTENTS, composeOptions()))).toBe(JSON.stringify(composeDeck(CONTENTS, composeOptions())));
    const noSeed = composeOptions({ seed: undefined });
    expect(JSON.stringify(composeDeck(CONTENTS, noSeed))).toBe(JSON.stringify(composeDeck(CONTENTS, noSeed)));
  });

  it("rotates layouts between consecutive pages", () => {
    for (const seed of [1, 2, 3, 99]) {
      const deck = composeDeck(CONTENTS, composeOptions({ seed }));
      const heads = deck.pages.filter((page) => !page.content?.continued);
      for (let i = 1; i < heads.length; i += 1) {
        const prev = deck.pages[deck.pages.indexOf(heads[i]) - 1];
        expect(heads[i].layoutId, `seed ${seed} page ${i}`).not.toBe(prev.layoutId);
      }
    }
  });

  it("honors layout hints", () => {
    const hints = CONTENTS.map(() => undefined as string | undefined);
    hints[2] = "bullets-simple";
    hints[3] = "unknown-layout";
    const deck = composeDeck(CONTENTS, composeOptions({ layoutHints: hints }));
    const heads = deck.pages.filter((page) => !page.content?.continued);
    expect(heads[2].layoutId).toBe("bullets-simple");
    expect(heads[3].layoutId).toBeDefined();
  });

  it("ignores hints that do not suit the page", () => {
    const deck = composeDeck([SAMPLES["bullets-simple"]], composeOptions({ layoutHints: ["doc-article"] }));
    expect(deck.pages[0].layoutId).not.toBe("doc-article");
  });

  it("prefers doc layouts for documents", () => {
    const deck = composeDeck([SAMPLES["doc-article"]], composeOptions({ format: FORMATS.a4 }));
    expect(deck.kind).toBe("doc");
    expect(deck.pages[0].layoutId).toMatch(/^doc-/);
  });
});

describe("relayoutPage", () => {
  const ctx = () => wide({ newId: createIdFactory("rl", 5) });

  function editedPage(): ScenePage {
    const [page] = layoutPage(SAMPLES["cards-3"], wide(), "cards-3", "page-1");
    const elements = page.elements.map((el) =>
      el.slot === "title" && el.kind === "text" ? { ...el, x: 0.2, y: 0.05, text: "My own title", edited: true } : el,
    );
    const note: SceneElement = { id: "user-note", kind: "text", role: "body", x: 0.7, y: 0.85, w: 0.25, h: 0.08, text: "Added by me", style: "small" };
    return { ...page, elements: [...elements, note] };
  }

  it("keeps edited elements and user additions", () => {
    const page = editedPage();
    const [next] = relayoutPage(page, ctx(), "bullets-simple");
    expect(next.id).toBe("page-1");
    expect(next.layoutId).toBe("bullets-simple");
    const titles = next.elements.filter((el) => el.slot === "title");
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatchObject({ x: 0.2, y: 0.05, text: "My own title", edited: true });
    expect(next.elements.find((el) => el.id === "user-note")).toMatchObject({ text: "Added by me" });
    expect(next.content?.title).toBe("My own title");
    const ids = next.elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not duplicate content when relaid out repeatedly", () => {
    let page = editedPage();
    for (let i = 0; i < 3; i += 1) [page] = relayoutPage(page, ctx());
    const itemTitles = texts(page).filter((el) => /^item-\d+-title$/.test(el.slot ?? ""));
    expect(itemTitles).toHaveLength(3);
  });

  it("keeps a custom background", () => {
    const page = { ...editedPage(), background: { kind: "solid", color: "#ff0000" } as const };
    expect(relayoutPage(page, ctx())[0].background).toEqual({ kind: "solid", color: "#ff0000" });
  });

  it("picks up edited text from generated elements", () => {
    const [page] = layoutPage(SAMPLES["cards-3"], wide(), "cards-3", "page-1");
    const elements = page.elements.map((el) => (el.slot === "item-0-title" && el.kind === "text" ? { ...el, text: "Tone" } : el));
    const [next] = relayoutPage({ ...page, elements }, ctx(), "bullets-simple");
    expect(next.content?.items?.[0]?.title).toBe("Tone");
    expect(texts(next).some((el) => el.text.includes("Tone"))).toBe(true);
  });
});

describe("shuffleLayout", () => {
  it("cycles deterministically through suitable layouts", () => {
    const [start] = layoutPage(SAMPLES["cards-3"], wide(), "cards-3", "page-1");
    const seen: string[] = [start.layoutId as string];
    let page = start;
    for (let i = 0; i < 12; i += 1) {
      [page] = shuffleLayout(page, wide());
      seen.push(page.layoutId as string);
      expect(page.id).toBe("page-1");
    }
    expect(seen[1]).not.toBe(seen[0]);
    expect(new Set(seen).size).toBeGreaterThan(2);
    const [again] = shuffleLayout(start, wide());
    expect(again.layoutId).toBe(seen[1]);
  });
});

describe("scaleElement", () => {
  it("scales font sizes and keeps round shapes round", () => {
    const text: SceneElement = { id: "t", kind: "text", role: "body", x: 0, y: 0, w: 0.5, h: 0.1, text: "x", style: "body", fontSize: 20 };
    expect(scaleElement(text, { width: 1280, height: 720 }, { width: 1080, height: 1080 })).toMatchObject({ fontSize: 30 });
    const circle: SceneElement = { id: "c", kind: "shape", role: "shape", shape: "circle", x: 0.4, y: 0.4, w: 0.1, h: 0.1 * (1280 / 720) };
    const scaled = scaleElement(circle, { width: 1280, height: 720 }, { width: 1080, height: 1080 });
    expect(scaled.w * 1080).toBeCloseTo(scaled.h * 1080, 1);
  });
});

describe("reflowDeck", () => {
  const source = (): SceneDeck => composeDeck(CONTENTS, composeOptions());

  it("reflows to A4 portrait without losing bullets", () => {
    const deck = source();
    const next = reflowDeck(deck, { theme: LIGHT_THEME, fontPair: FONT_PAIR, format: { ...FORMATS.a4 } });
    expect(next).toMatchObject({ width: 794, height: 1123, formatId: FORMATS.a4.id, kind: "doc" });
    for (const page of next.pages) expect(inBounds(page.elements)).toBe(true);
    const groups = (pages: ScenePage[]) => {
      const out: ScenePage[][] = [];
      for (const page of pages) {
        if (page.content?.continued && out.length) out[out.length - 1].push(page);
        else out.push([page]);
      }
      return out.map((group) => mergedContent(group).bullets ?? []);
    };
    expect(groups(next.pages)).toEqual(groups(deck.pages));
  });

  it("is deterministic", () => {
    const opts = { theme: DARK_THEME, fontPair: FONT_PAIR, format: { ...FORMATS.square }, previousTheme: LIGHT_THEME };
    expect(JSON.stringify(reflowDeck(source(), opts))).toBe(JSON.stringify(reflowDeck(source(), opts)));
  });

  it("defaults to the deck's library theme and font pair", () => {
    const deck = source();
    const same = reflowDeck(deck);
    expect(same).toMatchObject({ themeId: deck.themeId, fontPairId: deck.fontPairId, width: deck.width });
    expect(same.pages.map((page) => page.layoutId)).toEqual(deck.pages.map((page) => page.layoutId));
    const themed = reflowDeck(deck, { theme: DARK_THEME });
    expect(themed).toMatchObject({ themeId: DARK_THEME.id, fontPairId: DARK_THEME.fontPairId });
    expect(themed.pages[1].background).toEqual(DARK_THEME.background);
  });

  it("applies the new theme and keeps edited elements", () => {
    const deck = source();
    const target = deck.pages[2];
    const edited = target.elements.map((el) => (el.slot === "title" ? { ...el, edited: true, x: 0.3 } : el));
    const custom: SceneElement = { id: "custom-shape", kind: "shape", role: "shape", shape: "rect", x: 0.1, y: 0.1, w: 0.1, h: 0.1, fill: "#00ff00" };
    deck.pages[2] = { ...target, elements: [...edited, custom] };
    const next = reflowDeck(deck, { theme: DARK_THEME, fontPair: FONT_PAIR, previousTheme: LIGHT_THEME });
    expect(next.themeId).toBe(DARK_THEME.id);
    const page = next.pages.find((p) => p.id === target.id);
    expect(page?.elements.find((el) => el.id === "custom-shape")).toMatchObject({ fill: "#00ff00" });
    expect(page?.elements.filter((el) => el.slot === "title")).toHaveLength(1);
    expect(page?.elements.find((el) => el.slot === "title")).toMatchObject({ edited: true, x: 0.3 });
    expect(next.pages[0].background).not.toEqual(LIGHT_THEME.background);
  });

  it("swaps a hex theme background on edited pages too", () => {
    const sunrise = getDeckTheme("sunrise");
    const deck = composeDeck(CONTENTS, composeOptions({ theme: sunrise, layoutHints: ["title-center"] }));
    expect(deck.pages[0].background).toEqual(sunrise.heroBackground);
    const plain = reflowDeck(deck, { theme: LIGHT_THEME });
    deck.pages[0] = { ...deck.pages[0], elements: deck.pages[0].elements.map((el) => (el.slot === "title" ? { ...el, edited: true } : el)) };
    const edited = reflowDeck(deck, { theme: LIGHT_THEME });
    expect(edited.pages[0].background).toEqual(plain.pages[0].background);
    expect(edited.pages[0].background).not.toEqual(sunrise.heroBackground);
  });

  it("keeps a custom background on edited pages", () => {
    const deck = source();
    const custom = { kind: "solid", color: "#123456" } as const;
    deck.pages[1] = {
      ...deck.pages[1],
      background: custom,
      elements: deck.pages[1].elements.map((el) => (el.slot === "title" ? { ...el, edited: true } : el)),
    };
    expect(reflowDeck(deck, { theme: DARK_THEME }).pages[1].background).toEqual(custom);
  });
});

describe("relayout and reflow keep the user's work", () => {
  const theme = getDeckTheme("porcelain");
  const pair = getFontPair(theme.fontPairId);
  const approx = createApproxMeasurer();
  const ctx = () => createLayoutContext({ width: 1280, height: 720, theme, fontPair: pair, deckKind: "slides" });
  const compose = (contents: SlideContent[], extra: Partial<ComposeOptions> = {}) =>
    composeDeck(contents, { format: FORMATS.wide, theme, fontPair: pair, title: "d", seed: 1, ...extra });
  const editSlot = (deck: SceneDeck, slot: string, patch: Partial<TextElement> = {}, pageIndex?: number): SceneDeck => ({
    ...deck,
    pages: deck.pages.map((page, i) =>
      pageIndex !== undefined && i !== pageIndex
        ? page
        : { ...page, elements: page.elements.map((el) => (el.slot === slot && el.kind === "text" ? { ...el, ...patch, edited: true } : el)) },
    ),
  });
  const template = (id: string) => {
    const found = TEMPLATES.find((t) => t.id === id);
    if (!found) throw new Error(`missing template ${id}`);
    return found;
  };

  /** Text boxes with the height their text needs at their own size. */
  function textBoxes(deck: SceneDeck, page: ScenePage) {
    const fontPair = getFontPair(deck.fontPairId);
    return texts(page)
      .filter((el) => el.text.trim() && !el.hidden)
      .map((el) => {
        const style = resolveTextElementStyle(el, fontPair, { width: deck.width, height: deck.height, kind: deck.kind });
        const pad = (el.padding ?? 0) * 2;
        const needH = measureTextAt(el.text, style, style.fontSize, el.w * deck.width - pad, approx).height + pad;
        return { el, x: el.x * deck.width, y: el.y * deck.height, w: el.w * deck.width, boxH: el.h * deck.height, needH };
      });
  }

  /** Pairs of texts, one of them edited, whose drawn extents overlap by more than 3px both ways. */
  function editedOverlaps(deck: SceneDeck, page: ScenePage): string[] {
    const boxes = textBoxes(deck, page).filter((t) => t.el.role !== "deco");
    const hits: string[] = [];
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        if (!a.el.edited && !b.el.edited) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + Math.max(a.boxH, a.needH), b.y + Math.max(b.boxH, b.needH)) - Math.max(a.y, b.y);
        if (ox > 3 && oy > 3) hits.push(`${page.layoutId}: ${a.el.slot} x ${b.el.slot}`);
      }
    });
    return hits;
  }

  const duplicateIds = (deck: SceneDeck) => {
    const ids = deck.pages.flatMap((page) => [page.id, ...page.elements.map((el) => el.id)]);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  };

  it("keeps a long edited text on its page instead of copying its overflow onto new pages", () => {
    const extra = Array.from({ length: 80 }, (_, i) => `Extra bullet line number ${i} typed by the teacher`).join("\n");
    const deck = editSlot(compose([{ kind: "bullets", title: "Sleep", bullets: ["Memory", "Mood", "Growth"] }], { layoutHints: ["bullets-simple"] }), "bullet-0", {
      text: `Memory\n${extra}`,
    });
    const count = (pages: ScenePage[]) => pages.flatMap((page) => texts(page).map((el) => el.text)).join("\n").split("Extra bullet line number 60 ").length - 1;
    const reflowed = reflowDeck(deck, { fontPair: FONT_PAIR });
    expect(reflowed.pages).toHaveLength(1);
    expect(count(reflowed.pages)).toBe(1);
    const relaid = relayoutPage(deck.pages[0], ctx());
    expect(relaid).toHaveLength(1);
    expect(count(relaid)).toBe(1);
    expect(relaid[0].content?.bullets?.[0]).toContain("Extra bullet line number 79");
  });

  it("makes room for an edited text that grew but still fits its page", () => {
    /** Edits a slot of the first page, growing its box to the height the new text needs. */
    const grow = (deck: SceneDeck, slot: string, text: string): SceneDeck => {
      const edited = editSlot(deck, slot, { text }, 0);
      const box = textBoxes(edited, edited.pages[0]).find((t) => t.el.slot === slot);
      if (!box) throw new Error(`missing ${slot}`);
      return editSlot(edited, slot, { h: Math.max(box.el.h, box.needH / edited.height) }, 0);
    };
    const bullets = grow(
      compose([{ kind: "bullets", title: "Sleep", bullets: ["Memory", "Mood", "Growth", "Focus"] }], { layoutHints: ["bullets-simple"] }),
      "bullet-0",
      "Memory: during deep sleep the brain replays the day and moves new facts into long-term storage\nThat is why a night's sleep after studying helps recall\nTeens need 8-10 hours",
    );
    const relaid = relayoutPage(bullets.pages[0], ctx());
    expect(relaid).toHaveLength(1);
    expect(relaid[0].layoutId).toBe("bullets-simple");
    expect(editedOverlaps(bullets, relaid[0])).toEqual([]);

    const a4 = reflowDeck(bullets, { format: FORMATS.a4 });
    expect(a4.pages).toHaveLength(1);
    expect(editedOverlaps(a4, a4.pages[0])).toEqual([]);

    const docCtx = createLayoutContext({ width: FORMATS.a4.width, height: FORMATS.a4.height, theme, fontPair: pair, deckKind: "doc" });
    const doc = grow(
      compose([{ kind: "concept", title: "Report", body: "Short body.", bullets: ["One", "Two", "Three"] }], { format: FORMATS.a4, layoutHints: ["doc-article"] }),
      "body",
      "A much longer body the teacher typed.\nIt has several paragraphs.\nEach paragraph is a line of its own and together they need a lot more room than the stand-in.",
    );
    const [docPage] = relayoutPage(doc.pages[0], docCtx);
    expect(docPage.layoutId).toBe("doc-article");
    expect(editedOverlaps(doc, docPage)).toEqual([]);
  });

  it("keeps the speaker notes of continuation pages", () => {
    const bullets = Array.from({ length: 14 }, (_, i) => `Point number ${i + 1} explains one more idea about the topic in a full sentence`);
    const composed = compose([{ kind: "bullets", title: "Many points", bullets }]);
    expect(composed.pages.length).toBeGreaterThan(1);
    const deck = { ...composed, pages: composed.pages.map((page, i) => ({ ...page, notes: `Notes for page ${i + 1}` })) };
    for (const next of [reflowDeck(deck), reflowDeck(deck, { format: FORMATS.square }), reflowDeck(deck, { format: FORMATS.a4 })]) {
      const notes = next.pages.map((page) => page.notes ?? "").join("\n\n");
      deck.pages.forEach((_, i) => expect(notes, next.formatId).toContain(`Notes for page ${i + 1}`));
    }
    expect(reflowDeck(deck).pages[1].notes).toBe("Notes for page 2");
  });

  it("keeps a page background the user chose when the format or font pair changes", () => {
    const deck = compose([SAMPLES["bullets-simple"], SAMPLES["cards-3"]]);
    const red = { kind: "solid", color: "#ff0000" } as const;
    deck.pages[0] = { ...deck.pages[0], background: red };
    expect(reflowDeck(deck, { format: FORMATS.square }).pages[0].background).toEqual(red);
    expect(reflowDeck(deck, { fontPair: FONT_PAIR }).pages[0].background).toEqual(red);
    expect(reflowDeck(deck, { theme: DARK_THEME }).pages.at(-1)?.background).toEqual(DARK_THEME.background);
  });

  it("keeps token background presets the user picked through relayout and shuffle", () => {
    const deck = compose([{ kind: "bullets", title: "Sleep", bullets: ["Memory", "Mood", "Growth"] }]);
    for (const id of ["dots", "theme-accent", "confetti"]) {
      const preset = getBackgroundPreset(id);
      if (!preset) throw new Error(`missing preset ${id}`);
      const page = { ...deck.pages[0], background: preset.background };
      expect(relayoutPage(page, ctx())[0].background, id).toEqual(preset.background);
      expect(shuffleLayout(page, ctx())[0].background, id).toEqual(preset.background);
    }
  });

  it("still swaps a background its layout put there", () => {
    const [section] = layoutPage(SAMPLES["section-band"], ctx(), "section-band");
    expect(section.background).toEqual({ kind: "solid", color: "accent" });
    const [next] = relayoutPage(section, ctx(), "section-number");
    expect(next.layoutId).toBe("section-number");
    expect(next.background).toEqual(layoutPage(SAMPLES["section-band"], ctx(), "section-number")[0].background);
  });

  it("moves to a layout that can show the page on every shuffle", () => {
    const content: SlideContent = {
      kind: "stats",
      title: "At a glance",
      stats: [
        { value: "6", label: "weeks" },
        { value: "12", label: "live sessions" },
        { value: "1", label: "finished story" },
      ],
    };
    let page = compose([content]).pages[0];
    for (let i = 0; i < 5; i += 1) {
      const [next] = shuffleLayout(page, ctx());
      expect(next.layoutId, `shuffle ${i + 1}`).not.toBe(page.layoutId);
      page = next;
    }
  });

  it("does not use a forced layout that cannot show the content", () => {
    const quiz: SlideContent = { kind: "question", title: "Quiz", question: { prompt: "Capital of France?", choices: ["Paris", "Lyon", "Nice", "Lille"], answer: 0 } };
    for (const id of ["question-true-false", "flashcard"]) {
      const pages = layoutPage(quiz, ctx(), id);
      expect(pages[0].layoutId).toBe("question-choices");
      const shown = pages.flatMap((page) => texts(page).map((el) => el.text));
      for (const choice of ["Paris", "Lyon", "Nice", "Lille"]) expect(shown, id).toContain(choice);
    }
  });

  it("goes back to the format's own layouts after a round trip", () => {
    for (const [id, head] of [
      ["lab-report", /^doc-/],
      ["event-flyer", /^poster-hero$/],
    ] as const) {
      const deck = composeTemplate(template(id), { seed: 5 });
      const back = reflowDeck(reflowDeck(deck, { format: FORMATS.wide }), { format: getFormat(deck.formatId) });
      expect(back.pages, id).toHaveLength(deck.pages.length);
      expect(back.pages[0].layoutId, id).toMatch(head);
    }
    const lab = composeTemplate(template("lab-report"), { seed: 5 });
    const back = reflowDeck(reflowDeck(lab, { format: FORMATS.wide }), { format: FORMATS.a4 });
    for (const page of back.pages) expect(page.layoutId).toMatch(/^doc-/);
  });

  it("never gives two elements the same id over repeated reflows", () => {
    let deck = composeTemplate(template("lab-report"), { seed: 7 });
    [FORMATS.square, FORMATS.wide, FORMATS.square, FORMATS.wide, FORMATS.a4, FORMATS.square].forEach((format, step) => {
      deck = reflowDeck(deck, { format });
      if (step === 2) deck = editSlot(deck, "title");
      expect(duplicateIds(deck), `step ${step}`).toEqual([]);
    });
  });

  it("keeps adding flow pages past the continuation cap until every word is shown", () => {
    // Very tall lines keep each page short, so the cap is reached with little text.
    const tall: TextMeasurer = ({ text, fontSize, lineHeight, maxWidth }) => {
      const perLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)));
      const lines = Math.max(1, Math.ceil(text.length / perLine));
      return { lines, height: lines * fontSize * lineHeight * 6 };
    };
    const words = Array.from({ length: 4000 }, (_, i) => `w${i}`);
    const pages = layoutPage({ kind: "concept", title: "Long", body: `${words.join(" ")}.` }, createLayoutContext({ width: 1280, height: 720, theme, fontPair: pair, measure: tall }));
    expect(pages.length).toBeGreaterThan(41);
    const shown = new Set(pages.flatMap((page) => texts(page).flatMap((el) => el.text.split(/[\s.]+/))));
    expect(words.filter((word) => !shown.has(word))).toEqual([]);
  }, 60_000);

  it("does not add an empty continuation page when a split document page is laid out again", () => {
    const docCtx = createLayoutContext({ width: FORMATS.a4.width, height: FORMATS.a4.height, theme, fontPair: pair, deckKind: "doc" });
    const [first] = layoutPage(KITCHEN_SINK, docCtx, "doc-article");
    expect(relayoutPage(first, docCtx, "doc-article")).toHaveLength(1);
    let deck = editSlot(compose([KITCHEN_SINK], { format: FORMATS.a4, layoutHints: ["doc-article"] }), "title", { text: "Edited title" }, 0);
    const count = deck.pages.length;
    for (let n = 1; n <= 3; n += 1) {
      deck = reflowDeck(deck, { fontPair: n % 2 ? FONT_PAIR : pair });
      expect(deck.pages, `reflow ${n}`).toHaveLength(count);
    }
  });

  it("fits edited titles into the new layout's slot on a format change", () => {
    const deck = editSlot(compose(Object.values(SAMPLES).slice(0, 12), { title: "j", seed: 3 }), "title");
    for (const format of [FORMATS.a4, FORMATS.square, getFormat("slides-9x16")]) {
      const next = reflowDeck(deck, { format });
      for (const page of next.pages) {
        const overflow = textBoxes(next, page).filter((t) => t.el.edited && t.needH > t.boxH + 4);
        expect(overflow.map((t) => `${page.layoutId}:${t.el.slot}`), format.id).toEqual([]);
        expect(editedOverlaps(next, page), format.id).toEqual([]);
      }
      const titles = next.pages.flatMap((page) => texts(page).filter((el) => el.slot === "title"));
      expect(titles.every((el) => el.edited)).toBe(true);
    }
  }, 60_000);

  it("keeps a moved title where the user put it when only the theme changes", () => {
    const deck = editSlot(compose([SAMPLES["cards-3"]]), "title", { x: 0.3 });
    const next = reflowDeck(deck, { theme: DARK_THEME });
    expect(texts(next.pages[0]).find((el) => el.slot === "title")).toMatchObject({ x: 0.3, edited: true });
  });
});
