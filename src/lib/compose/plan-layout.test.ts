import { describe, expect, it } from "vitest";
import { composeDeck } from "@/lib/studio/auto-layout";
import { getDeckTheme, getFontPair, getFormat } from "@/lib/studio/library";
import type { SceneDeck, SlideContent } from "@/lib/studio/scene";
import { normalizeOutline } from "./outline";
import { outlineFromText, outlineFromTopic } from "./outline-from-text";
import { docLayoutHints, planDocument, planSlides } from "./plan";
import type { LessonOutline } from "./types";

const NOTES = `# Photosynthesis

## What is photosynthesis?
Photosynthesis is the process plants use to turn light energy into chemical energy. It happens mostly in the leaves.

## Key parts
- **Chlorophyll** is a green pigment that absorbs sunlight.
- **Stomata** are tiny pores that let carbon dioxide in.
- **Glucose** is a simple sugar that stores energy.

## Steps
1. Light hits the leaf.
2. Water is split.
3. Sugar is made.

## Timeline
- 1779 — Ingenhousz shows light is needed
- 1845 — Mayer describes energy conversion
- 1954 — Arnon observes photophosphorylation

## Plant vs animal cells
- Plant cells have a cell wall.
- Animal cells have no cell wall.
- Plant cells contain chloroplasts.
- Animal cells use mitochondria only for energy.

## Fast facts
- 70% of a cell is water.

> The cell is the basic unit of life.
— Theodor Schwann

## Summary
- Light energy becomes chemical energy.
- Chlorophyll captures the light.
`;

const SPANISH = `El ciclo del agua

El agua se evapora de los océanos por el calor del sol. El vapor sube, se enfría y forma nubes. Después, el agua cae como lluvia o nieve y vuelve a los ríos.

La evaporación es el paso del agua líquida a vapor. La condensación es el paso del vapor a gotas de agua. La precipitación es la caída del agua desde las nubes.`;

const MIXED = normalizeOutline({
  title: "Doing science",
  language: "en",
  objectives: ["Plan a fair test"],
  sections: [
    { kind: "concept", heading: "Key tools", bullets: ["Beaker: holds liquids", "Thermometer: measures temperature", "Balance: measures mass"] },
    { kind: "steps", heading: "The method", body: "Scientists follow the same routine.", bullets: ["Work in pairs"], steps: ["Ask a question", "Make a prediction", "Test it", "Record results"] },
    { kind: "stat", heading: "Lab safety", bullets: ["90% of lab accidents are preventable"], stat: { value: "3 in 4", label: "labs run a safety drill" } },
    { kind: "question", heading: "Why do we repeat experiments?", body: "Think about errors.", bullets: ["Hint: chance"] },
    { kind: "compare", heading: "Observation vs inference", bullets: [], compare: { a: { label: "Observation", points: ["What you see"] }, b: { label: "Inference", points: ["What you conclude"] } } },
  ],
  glossary: [{ term: "Hypothesis", definition: "A testable prediction", example: "Plants grow faster in light." }],
  questions: [
    { type: "match", prompt: "Match each tool.", pairs: [["Beaker", "Liquids"], ["Balance", "Mass"], ["Ruler", "Length"]] },
    { type: "mcq", prompt: "Which tool measures mass?", choices: ["Beaker", "Balance", "Ruler"], answer: 1 },
    { type: "true_false", prompt: "A beaker measures mass.", answer: false },
  ],
  activities: [{ kind: "practice", prompt: "Plan a fair test.", items: ["Choose a variable", "Keep the rest the same"] }],
});

const OUTLINES: [string, LessonOutline][] = [
  ["notes", outlineFromText(NOTES)],
  ["spanish", outlineFromText(SPANISH)],
  ["topic", outlineFromTopic("Fractions", { level: "beginner" })],
  ["mixed", MIXED],
];

function compose(contents: SlideContent[], formatId: string, hints?: string[]): SceneDeck {
  const format = getFormat(formatId);
  return composeDeck(contents, {
    format: { id: format.id, width: format.width, height: format.height, kind: format.kind },
    theme: getDeckTheme(undefined),
    fontPair: getFontPair(undefined),
    title: formatId,
    seed: 7,
    layoutHints: hints,
  });
}

function deckText(deck: SceneDeck): string {
  return deck.pages
    .flatMap((page) => page.elements.flatMap((element) => (element.kind === "text" ? [element.text] : element.kind === "table" ? element.rows.flat() : [])))
    .join("\n");
}

/** Every visible string a planned page carries; the layout must place each one somewhere. */
function contentStrings(content: SlideContent): string[] {
  return [
    content.title,
    ...(content.bullets ?? []),
    ...(content.steps ?? []),
    ...(content.items ?? []).map((item) => item.title),
    ...(content.terms ?? []).map((term) => term.term),
    ...(content.stats ?? []).map((stat) => stat.value),
    ...(content.compare ? [...content.compare.a.points, ...content.compare.b.points] : []),
    ...(content.quote ? [content.quote.text] : []),
    ...(content.question ? [content.question.prompt, ...(content.question.choices ?? [])] : []),
  ].filter(Boolean);
}

function expectComposed(label: string, contents: SlideContent[], deck: SceneDeck) {
  expect(deck.pages.length, label).toBeGreaterThanOrEqual(contents.length);
  for (const page of deck.pages) expect(page.elements.length, `${label}: ${page.content?.title}`).toBeGreaterThan(0);
  const text = deckText(deck);
  expect(contents.flatMap(contentStrings).filter((value) => !text.includes(value)), label).toEqual([]);
}

describe("planned content through the layout engine", () => {
  it("lays out slide and social plans without losing text", () => {
    for (const [name, outline] of OUTLINES) {
      const slides = planSlides(outline);
      expectComposed(`${name} 16:9`, slides, compose(slides, "slides-16x9"));
      const short = planSlides(outline, { pageCount: 6 });
      expectComposed(`${name} 4:3 x6`, short, compose(short, "slides-4x3"));
      const social = planSlides(outline, { format: "social" });
      expectComposed(`${name} social`, social, compose(social, "ig-square"));
    }
  }, 120000);

  it("lays out document plans on doc layouts via hints", () => {
    for (const [name, outline] of OUTLINES) {
      for (const cornell of [false, true]) {
        const pages = planDocument(outline, { cornell });
        const deck = compose(pages, "doc-a4", docLayoutHints(pages));
        expectComposed(`${name} doc${cornell ? " cornell" : ""}`, pages, deck);
        for (const page of deck.pages) expect(page.layoutId, `${name}: ${page.content?.title}`).toMatch(/^doc-/);
      }
    }
  }, 120000);
});
