import { describe, expect, it } from "vitest";
import { TEMPLATES, getDeckTheme, getFontPair, getFormat, getIcon, type TemplateDef } from "@/lib/studio/library";
import { composeDeck, composeTemplate, mergeContent } from "../auto-layout";
import type { SceneDeck, ScenePage, SlideContent } from "../scene";
import { getLayout } from "./index";

/** Lowercase words only, so re-joined splits ("1905: x" vs "1905 – x", "a; b" vs "a\nb") compare equal. */
const words = (values: readonly (string | undefined)[] | undefined) =>
  (values ?? [])
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function listText(content: SlideContent): Record<string, string> {
  return {
    bullets: words(content.bullets),
    steps: words(content.steps),
    items: words((content.items ?? []).flatMap((item) => [item.title, item.body])),
    terms: words((content.terms ?? []).flatMap((term) => [term.term, term.definition])),
    choices: words(content.question?.choices),
  };
}

/** Pages grouped by source content: each head page plus its `continued` pages. */
function groups(deck: SceneDeck): ScenePage[][] {
  const out: ScenePage[][] = [];
  for (const page of deck.pages) {
    if (page.content?.continued && out.length) out[out.length - 1].push(page);
    else out.push([page]);
  }
  return out;
}

function compose(template: TemplateDef): SceneDeck {
  const theme = getDeckTheme(template.themeId);
  return composeDeck(template.pages, {
    format: getFormat(template.formatId),
    theme,
    fontPair: getFontPair(template.fontPairId ?? theme.fontPairId),
    title: template.name,
    layoutHints: template.layoutHints,
    seed: 11,
  });
}

describe("library templates compose into valid decks", () => {
  it("covers every template", () => {
    expect(TEMPLATES.length).toBeGreaterThan(20);
  });

  it.each(TEMPLATES.map((template) => [template.id, template] as const))("%s", (_id, template) => {
    const deck = compose(template);
    const format = getFormat(template.formatId);
    expect(deck).toMatchObject({ v: 2, formatId: format.id, width: format.width, height: format.height, kind: format.kind, themeId: template.themeId });

    const pageIds = deck.pages.map((page) => page.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    const elementIds = deck.pages.flatMap((page) => page.elements.map((el) => el.id));
    expect(new Set(elementIds).size).toBe(elementIds.length);

    for (const page of deck.pages) {
      expect(getLayout(page.layoutId), page.id).toBeDefined();
      expect(page.elements.length, page.id).toBeGreaterThan(0);
      for (const el of page.elements) {
        const where = `${page.layoutId} ${el.id} ${el.slot ?? ""}`;
        for (const value of [el.x, el.y, el.w, el.h]) expect(Number.isFinite(value), where).toBe(true);
        expect(el.x, where).toBeGreaterThanOrEqual(-1e-4);
        expect(el.y, where).toBeGreaterThanOrEqual(-1e-4);
        expect(el.x + el.w, where).toBeLessThanOrEqual(1.0001);
        expect(el.y + el.h, where).toBeLessThanOrEqual(1.0001);
        if (el.kind === "text") expect(el.text.trim().length, where).toBeGreaterThan(0);
        if (el.kind === "icon") expect(getIcon(el.icon)?.id, where).toBe(el.icon);
      }
    }

    const grouped = groups(deck);
    expect(grouped).toHaveLength(template.pages.length);
    grouped.forEach((group, i) => {
      const source = template.pages[i];
      const shown = group.map((page) => page.content as SlideContent).reduce((a, b) => mergeContent(a, b));
      expect(listText(shown), `${template.id} page ${i}`).toEqual(listText(source));
      expect(group[0].content?.title).toBe(source.title);
    });
  });

  it("honors each template's layout hints where the layout suits the page", () => {
    const ignored: string[] = [];
    for (const template of TEMPLATES) {
      const deck = compose(template);
      groups(deck).forEach((group, i) => {
        const hint = template.layoutHints?.[i];
        if (hint && group[0].layoutId !== hint) ignored.push(`${template.id}#${i}: ${hint} → ${group[0].layoutId}`);
      });
    }
    expect(ignored).toEqual([]);
  });

  it("composes the same deck through composeTemplate", () => {
    const template = TEMPLATES[0];
    expect(JSON.stringify(composeTemplate(template, { seed: 11 }))).toBe(JSON.stringify(compose(template)));
  });
});
