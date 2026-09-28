import { describe, expect, it } from "vitest";
import { getIcon } from "@/lib/studio/library";
import type { ContentKind, SlideContent } from "@/lib/studio/scene";
import { emptyOutline, normalizeOutline } from "./outline";
import { outlineFromText, outlineFromTopic } from "./outline-from-text";
import { PLAN_ICON_IDS, docLayoutHints, pickIcon, planDocument, planSlides, suggestSectionCount, type PlannedDocPage } from "./plan";
import type { LessonOutline } from "./types";

const WATER: LessonOutline = normalizeOutline({
  title: "The Water Cycle",
  audience: "Grade 6 science",
  level: "beginner",
  language: "en",
  objectives: ["Describe the stages of the water cycle", "Explain how clouds form", "Compare rain and snow"],
  sections: [
    {
      kind: "concept",
      heading: "Evaporation",
      body: "The sun heats water in oceans and lakes. The water turns into vapor and rises.",
      bullets: ["Heat from the sun drives evaporation", "Warm water evaporates faster"],
    },
    { kind: "steps", heading: "How rain forms", bullets: [], steps: ["Water vapor rises and cools", "Vapor condenses into droplets", "Droplets join into clouds", "Heavy drops fall as rain"] },
    {
      kind: "compare",
      heading: "Rain vs snow",
      bullets: [],
      compare: { a: { label: "Rain", points: ["Liquid water", "Falls above 0 °C"] }, b: { label: "Snow", points: ["Ice crystals", "Falls below 0 °C"] } },
    },
    {
      kind: "timeline",
      heading: "History of weather science",
      bullets: [],
      steps: ["1643 — Torricelli invents the barometer", "1802 — Luke Howard names the clouds", "1960 — The first weather satellite launches"],
    },
    { kind: "stat", heading: "Water on Earth", bullets: [], stat: { value: "97%", label: "of Earth's water is salty" } },
    { kind: "quote", heading: "A scientist's view", bullets: [], quote: { text: "Water is the driving force of all nature.", author: "Leonardo da Vinci" } },
    { kind: "summary", heading: "Summary", bullets: ["The sun powers the cycle", "Water moves between land, sea and sky"] },
  ],
  glossary: [
    { term: "Evaporation", definition: "Liquid water turning into vapor" },
    { term: "Condensation", definition: "Vapor turning into liquid droplets" },
    { term: "Precipitation", definition: "Water falling from clouds" },
    { term: "Runoff", definition: "Water flowing over land into rivers" },
    { term: "Transpiration", definition: "Water released by plant leaves" },
    { term: "Humidity", definition: "The amount of water vapor in the air" },
    { term: "Aquifer", definition: "Underground rock that holds water" },
    { term: "Collection", definition: "Water gathering in oceans and lakes" },
  ],
  questions: [
    { type: "short", prompt: "Where does rain come from?", answer: "Clouds", purpose: "diagnostic" },
    { type: "mcq", prompt: "What powers evaporation?", choices: ["The Moon", "The Sun", "Wind"], answer: 1, purpose: "check", section: 0 },
    { type: "true_false", prompt: "Clouds are made of tiny droplets.", answer: true, purpose: "check", section: 1 },
    { type: "mcq", prompt: "Which falls as ice crystals?", choices: ["Rain", "Snow", "Fog", "Dew"], answer: 1, purpose: "final" },
    { type: "fill_blank", prompt: "Vapor turns into droplets by _____.", answer: "condensation", purpose: "final" },
    {
      type: "match",
      prompt: "Match each stage to its meaning.",
      pairs: [
        ["Evaporation", "Liquid to gas"],
        ["Condensation", "Gas to liquid"],
        ["Precipitation", "Water falling"],
      ],
      purpose: "final",
    },
  ],
  activities: [{ kind: "discussion", prompt: "Where have you seen condensation at home?" }],
});

const NOTES = `# Photosynthesis

## What is photosynthesis?
Photosynthesis is the process plants use to turn light energy into chemical energy. It happens mostly in the leaves.

## Key parts
- **Chlorophyll** is a green pigment that absorbs sunlight.
- **Stomata** are tiny pores that let carbon dioxide in.
- **Glucose** is a simple sugar that stores energy.

## Inputs and outputs
- Plants take in water through their roots.
- Carbon dioxide enters through the stomata.
- Oxygen is released as a by-product.

## Why it matters
Almost every food chain starts with photosynthesis. It also produces the oxygen we breathe.

## Summary
- Light energy becomes chemical energy.
- Chlorophyll captures the light.
`;

const HEADINGS = WATER.sections.map((section) => section.heading);
const STRUCTURAL = new Set(["title", "agenda", "closing", "question", "quiz", "glossary", "definition", "activity"]);

function kinds(pages: SlideContent[]): string[] {
  return pages.map((page) => page.kind);
}

function collectIcons(pages: SlideContent[]): string[] {
  return pages.flatMap((page) => [page.icon, ...(page.items ?? []).map((item) => item.icon)]).filter((icon): icon is string => Boolean(icon));
}

/** Indices of outline headings in page order; must never go backwards. */
function headingOrder(pages: SlideContent[]): number[] {
  return pages.flatMap((page) => HEADINGS.map((heading, index) => (page.title.includes(heading) ? index : -1)).filter((index) => index >= 0));
}

describe("planSlides: full deck", () => {
  const pages = planSlides(WATER);

  it("orders pages semantically", () => {
    expect(kinds(pages)).toEqual([
      "title",
      "agenda",
      "bullets",
      "question",
      "bullets",
      "question",
      "steps",
      "question",
      "compare",
      "timeline",
      expect.stringMatching(/^stats?$/),
      "quote",
      "activity",
      "glossary",
      "glossary",
      "question",
      "question",
      "compare",
      "summary",
      "closing",
    ]);
    expect(pages[0]).toMatchObject({ title: "The Water Cycle", kicker: "Grade 6 science" });
    expect(pages[2]).toMatchObject({ title: "Learning objectives", bullets: WATER.objectives });
    expect(pages[pages.length - 1]).toMatchObject({ kind: "closing", subtitle: "The Water Cycle" });
    expect(headingOrder(pages)).toEqual([...headingOrder(pages)].sort((a, b) => a - b));
  });

  it("puts check questions right after their section", () => {
    expect(pages[3].question?.prompt).toBe("Where does rain come from?");
    expect(pages[4].title).toBe("Evaporation");
    expect(pages[5].question).toMatchObject({ prompt: "What powers evaporation?", choices: ["The Moon", "The Sun", "Wind"], answer: 1 });
    expect(pages[7].question).toMatchObject({ choices: ["True", "False"], answer: true });
    expect(pages.filter((page) => page.kind === "question").map((page) => page.title)).toEqual([
      "Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
    ]);
    expect(pages[5].notes).toBe("Answer: B) The Sun");
    expect(pages[16].question).toMatchObject({ prompt: "Vapor turns into droplets by _____.", answer: "condensation" });
  });

  it("shows matching as two columns without revealing the pairs", () => {
    const match = pages[17];
    expect(match).toMatchObject({ kind: "compare", title: "Question 6", body: "Match each stage to its meaning." });
    expect(match.terms).toBeUndefined();
    expect(match.compare?.a).toEqual({ label: "Terms", points: ["1. Evaporation", "2. Condensation", "3. Precipitation"] });
    expect(match.compare?.b.label).toBe("Meanings");
    expect(match.compare?.b.points.map((point) => point.slice(0, 3))).toEqual(["A) ", "B) ", "C) "]);
    expect(match.compare?.b.points.map((point) => point.slice(3)).sort()).toEqual(["Gas to liquid", "Liquid to gas", "Water falling"]);
    expect(match.notes).toContain("Answer: Evaporation → Liquid to gas");
  });

  it("maps section kinds to rich slide content", () => {
    const agenda = pages[1];
    expect(agenda.items?.map((item) => item.title)).toEqual(HEADINGS.slice(0, 6));
    expect(pages[4].body).toContain("The sun heats water");
    expect(pages[4].bullets).toHaveLength(2);
    expect(pages[6].steps).toHaveLength(4);
    expect(pages[8].compare?.a.label).toBe("Rain");
    expect(pages[9].items?.[0]).toEqual({ title: "1643", body: "Torricelli invents the barometer" });
    expect(pages[9].steps).toBeUndefined();
    expect(pages[11].quote).toEqual({ text: "Water is the driving force of all nature.", author: "Leonardo da Vinci" });
    expect(pages[13].terms).toHaveLength(6);
    expect(pages[14]).toMatchObject({ continued: true });
    expect(pages[14].terms).toHaveLength(2);
  });

  it("only emits known icon ids", () => {
    const icons = collectIcons(pages);
    expect(icons.length).toBeGreaterThan(pages.length / 2);
    for (const icon of icons) expect(PLAN_ICON_IDS).toContain(icon);
  });

  it("is deterministic and never contains undefined keys", () => {
    expect(planSlides(WATER)).toEqual(pages);
    for (const page of pages) for (const value of Object.values(page)) expect(value).not.toBeUndefined();
  });
});

describe("planSlides: pageCount", () => {
  it("respects pageCount from 3 to 20 while keeping title, content and closing", () => {
    for (let count = 3; count <= 20; count += 1) {
      const pages = planSlides(WATER, { pageCount: count });
      expect(pages.length).toBeLessThanOrEqual(count);
      expect(pages[0].kind).toBe("title");
      expect(pages[pages.length - 1].kind).toBe("closing");
      expect(pages.some((page) => !STRUCTURAL.has(page.kind))).toBe(true);
      expect(headingOrder(pages)).toEqual([...headingOrder(pages)].sort((a, b) => a - b));
    }
  });

  it("never goes below title + content + closing", () => {
    for (const count of [0, 1, 2, 3, -5, 2.7]) {
      const pages = planSlides(WATER, { pageCount: count });
      expect(pages).toHaveLength(3);
      expect(kinds(pages)).toEqual(["title", "bullets", "closing"]);
      expect(pages[1].items?.length).toBeGreaterThanOrEqual(2);
      expect(pages[1].title.length).toBeLessThanOrEqual(70);
    }
  });

  it("merges questions into quiz pages with an answer key before dropping them", () => {
    const pages = planSlides(WATER, { pageCount: 14 });
    expect(pages).toHaveLength(14);
    expect(kinds(pages)).not.toContain("agenda");
    expect(kinds(pages)).not.toContain("question");
    const quiz = pages.filter((page) => page.kind === "quiz");
    expect(quiz).toHaveLength(2);
    expect(quiz[0].items?.[0].title).toBe("1. Where does rain come from?");
    expect(quiz[0].items?.[1].body).toBe("A) The Moon   B) The Sun   C) Wind");
    expect(quiz[0].notes).toMatch(/^Answer key: /);
    expect(quiz[0].notes).toContain("2. B) The Sun");
    expect(quiz[0].notes).toContain("3. True");
    expect(quiz[1].notes).toContain("5. condensation");
    expect(quiz[1].notes).toContain("Evaporation → Liquid to gas");
    const glossary = pages.filter((page) => page.kind === "glossary");
    expect(glossary).toHaveLength(1);
    expect(glossary[0].terms).toHaveLength(8);
    expect(kinds(pages).indexOf("quiz")).toBeLessThan(kinds(pages).indexOf("summary"));
  });

  it("returns the full deck when pageCount is larger than needed", () => {
    expect(planSlides(WATER, { pageCount: 100 })).toEqual(planSlides(WATER));
  });

  it("is deterministic for every pageCount", () => {
    expect(planSlides(WATER, { pageCount: 7 })).toEqual(planSlides(WATER, { pageCount: 7 }));
  });

  it("treats a non-finite pageCount as no limit", () => {
    for (const pageCount of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(planSlides(WATER, { pageCount })).toEqual(planSlides(WATER));
      expect(planSlides(WATER, { format: "social", pageCount })).toEqual(planSlides(WATER, { format: "social" }));
    }
  });

  it("keeps every bullet of merged sections in items, bullets or notes", () => {
    const outline = normalizeOutline({
      title: "Ecosystems",
      objectives: ["Explain ecosystems"],
      sections: Array.from({ length: 8 }, (_, section) => ({
        kind: "concept",
        heading: `Topic ${section + 1}`,
        bullets: Array.from({ length: 5 }, (_, bullet) => `Fact ${section + 1}.${bullet + 1} about living things`),
      })),
    });
    for (const pageCount of [5, 8]) {
      const text = planSlides(outline, { pageCount })
        .flatMap((page) => [page.body, page.notes, ...(page.bullets ?? []), ...(page.items ?? []).flatMap((item) => [item.title, item.body])])
        .join("\n");
      for (const section of outline.sections) for (const bullet of section.bullets) expect(text, `pageCount ${pageCount}`).toContain(bullet);
    }
  });
});

describe("planSlides: questions", () => {
  it("shows check questions linked to a summary section", () => {
    const outline = normalizeOutline({
      title: "Water",
      sections: [
        { kind: "concept", heading: "Evaporation", bullets: ["Heat turns water into vapour", "Warm water evaporates faster"] },
        { kind: "summary", heading: "Summary", bullets: ["The sun drives the cycle", "Water keeps moving"] },
      ],
      questions: [{ type: "true_false", prompt: "The sun drives the water cycle.", answer: true, purpose: "check", section: 1 }],
    });
    const pages = planSlides(outline);
    const question = pages.findIndex((page) => page.question?.prompt === "The sun drives the water cycle.");
    expect(question).toBeGreaterThan(pages.findIndex((page) => page.title === "Summary"));

    const notes = outlineFromText(
      "# Water cycle\n\n## Evaporation\nThe sun heats water in oceans and lakes. The water turns into vapour and rises.\n\n## Summary\n- Evaporation: liquid water turning into vapour\n- Condensation: vapour turning into liquid droplets\n- Precipitation: water falling from clouds as rain or snow",
    );
    const deck = planSlides(notes);
    expect(notes.questions.length).toBeGreaterThanOrEqual(3);
    expect(deck.filter((page) => /^Question \d+$/.test(page.title))).toHaveLength(notes.questions.length);
  });

  it("keeps several discussion questions visible on the page", () => {
    const pages = planSlides(outlineFromText("Big questions\n\nWhy do seasons change?\nWhat causes day and night?\nHow does the Moon affect tides?"));
    const visible = pages.flatMap((page) => [page.title, page.body, page.question?.prompt, ...(page.bullets ?? []), ...(page.items ?? []).map((item) => item.title)]).join("\n");
    for (const question of ["Why do seasons change?", "What causes day and night?", "How does the Moon affect tides?"]) expect(visible).toContain(question);
    const single = planSlides(normalizeOutline({ title: "Tides", sections: [{ kind: "question", heading: "Discussion", bullets: ["What pulls the oceans?"] }] }));
    expect(single.find((page) => page.kind === "question")?.question?.prompt).toBe("What pulls the oceans?");
  });

  it("marks placeholder questions as drafts in the notes and leaves them out of answer keys", () => {
    const topic = outlineFromTopic("Photosynthesis");
    const questionPages = planSlides(topic).filter((page) => page.kind === "question" && page.title.startsWith("Question"));
    expect(questionPages.length).toBe(topic.questions.length);
    for (const page of questionPages) expect(page.notes).toContain("Draft question: add choices and the answer.");
    const worksheet = planDocument(topic).filter((page) => page.variant === "worksheet");
    expect(worksheet[0].notes).toContain("Draft question");
    expect(planDocument(topic).some((page) => page.variant === "answer-key")).toBe(false);
    const spanish = planSlides(outlineFromTopic("Fotosíntesis", { language: "es" })).find((page) => page.kind === "question" && page.title.startsWith("Pregunta"));
    expect(spanish?.notes).toContain("Pregunta en borrador");
  });
});

describe("planSlides: options and formats", () => {
  it("can leave out questions, glossary, agenda and objectives", () => {
    const noQuiz = planSlides(WATER, { includeQuiz: false });
    expect(kinds(noQuiz)).not.toContain("question");
    expect(kinds(noQuiz)).not.toContain("quiz");
    const noGlossary = planSlides(WATER, { includeGlossary: false });
    expect(kinds(noGlossary)).not.toContain("glossary");
    expect(kinds(noGlossary)).not.toContain("definition");
    const lean = planSlides(WATER, { includeAgenda: false, includeObjectives: false });
    expect(kinds(lean).slice(0, 2)).toEqual(["title", "question"]);
  });

  it("uses a single definition page for one glossary term", () => {
    const outline = normalizeOutline({ ...WATER, glossary: [{ term: "Runoff", definition: "Water flowing over land" }] });
    const definition = planSlides(outline).find((page) => page.kind === "definition");
    expect(definition).toMatchObject({ title: "Runoff", terms: [{ term: "Runoff", definition: "Water flowing over land" }] });
    expect(definition?.body).toBeUndefined();
  });

  it("builds a short social carousel", () => {
    const pages = planSlides(WATER, { format: "social" });
    expect(pages.length).toBeLessThanOrEqual(10);
    expect(pages[0]).toMatchObject({ kind: "title", icon: "sparkles" });
    expect(pages[pages.length - 1]).toMatchObject({ kind: "closing", title: "Save for later" });
    expect(kinds(pages)).not.toContain("agenda");
    expect(kinds(pages)).not.toContain("glossary");
    expect(pages.filter((page) => page.kind === "question")).toHaveLength(1);
    for (const page of pages) {
      expect((page.bullets ?? []).length).toBeLessThanOrEqual(3);
      expect((page.steps ?? []).length).toBeLessThanOrEqual(5);
    }
    expect(planSlides(WATER, { format: "social", pageCount: 5 })).toHaveLength(5);
  });

  it("delegates the doc format to planDocument", () => {
    expect(planSlides(WATER, { format: "doc" })).toEqual(planDocument(WATER));
  });

  it("handles an empty outline", () => {
    const pages = planSlides(emptyOutline("Fractions"));
    expect(kinds(pages)).toEqual(["title", "bullets", "closing"]);
    expect(planSlides(emptyOutline(""), { pageCount: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("plans a deck from parsed notes", () => {
    const outline = outlineFromText(NOTES);
    const pages = planSlides(outline);
    expect(pages[0].title).toBe("Photosynthesis");
    expect(pages[0].kind).toBe("title");
    expect(kinds(pages)).toContain("agenda");
    expect(kinds(pages)).toContain("glossary");
    expect(pages[pages.length - 1].kind).toBe("closing");
    const titles = pages.map((page) => page.title);
    const order = outline.sections.map((section) => titles.indexOf(section.heading));
    expect(order.every((index) => index > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const icon of collectIcons(pages)) expect(PLAN_ICON_IDS).toContain(icon);
    const six = planSlides(outline, { pageCount: 6 });
    expect(six).toHaveLength(6);
    expect(six[0].kind).toBe("title");
    expect(six[5].kind).toBe("closing");
  });
});

describe("planDocument", () => {
  it("builds article pages, a worksheet and an answer key with no closing", () => {
    const pages = planDocument(WATER);
    expect(pages[0]).toMatchObject({ variant: "article", kind: "title", bullets: WATER.objectives });
    expect(kinds(pages)).not.toContain("closing");
    expect(pages.find((page) => page.title === "Evaporation")?.body).toContain("The sun heats water");
    const worksheet = pages.filter((page) => page.variant === "worksheet");
    expect(worksheet).toHaveLength(1);
    expect(worksheet[0].items).toHaveLength(6);
    const key = pages[pages.length - 1];
    expect(key.variant).toBe("answer-key");
    expect(key.bullets).toEqual([
      "1. Clouds",
      "2. B) The Sun",
      "3. True",
      "4. B) Snow",
      "5. condensation",
      "6. Evaporation → Liquid to gas; Condensation → Gas to liquid; Precipitation → Water falling",
    ]);
    const summaryIndex = pages.findIndex((page) => page.kind === "summary");
    const glossaryIndex = pages.findIndex((page) => page.kind === "glossary");
    expect(summaryIndex).toBeGreaterThan(0);
    expect(glossaryIndex).toBeGreaterThan(summaryIndex);
    expect(pages[glossaryIndex].terms).toHaveLength(8);
  });

  it("splits worksheets at six questions and keeps numbering", () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({ type: "short", prompt: `Name stage ${index + 1}.`, answer: `Stage ${index + 1}` }));
    const pages = planDocument(normalizeOutline({ ...WATER, questions }));
    const worksheet = pages.filter((page) => page.variant === "worksheet");
    expect(worksheet.map((page) => page.items?.length)).toEqual([6, 2]);
    expect(worksheet[1].continued).toBe(true);
    expect(worksheet[1].items?.[0].title).toBe("7. Name stage 7.");
  });

  it("supports Cornell notes and optional sections", () => {
    const pages = planDocument(WATER, { cornell: true, answerKey: false, includeGlossary: false });
    const cornell = pages.filter((page) => page.variant === "cornell");
    expect(cornell.map((page) => page.title)).toEqual(["Evaporation", "How rain forms", "Rain vs snow", "History of weather science"]);
    expect(pages.find((page) => page.title === "Water on Earth")).toMatchObject({ variant: "article", kind: "stat" });
    expect(pages.find((page) => page.title === "A scientist's view")).toMatchObject({ variant: "article", kind: "quote" });
    for (const page of cornell) {
      expect(page.items?.length).toBeGreaterThanOrEqual(2);
      for (const item of page.items ?? []) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.body?.length).toBeGreaterThan(0);
      }
    }
    expect(cornell.find((page) => page.title === "Rain vs snow")?.items?.[0]).toEqual({ title: "Rain", body: "Rain: Liquid water" });
    expect(cornell.find((page) => page.title === "History of weather science")?.items?.[0].title).toBe("1643");
    expect(pages.find((page) => page.kind === "summary")?.variant).toBe("article");
    expect(pages.some((page) => page.variant === "answer-key")).toBe(false);
    expect(kinds(pages)).not.toContain("glossary");
    expect(planDocument(WATER, { includeQuiz: false }).some((page) => page.variant === "worksheet")).toBe(false);
  });

  it("is deterministic and safe on empty outlines", () => {
    expect(planDocument(WATER, { cornell: true })).toEqual(planDocument(WATER, { cornell: true }));
    const empty = planDocument(emptyOutline("Fractions"));
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ variant: "article", kind: "title", title: "Fractions" });
  });
});

describe("icons and sizing helpers", () => {
  it("pickIcon matches keywords in en, es and fr", () => {
    expect(pickIcon("Photosynthesis in plants")).toBe("leaf");
    expect(pickIcon("La fotosíntesis de las plantas")).toBe("leaf");
    expect(pickIcon("Las células")).toBe("dna");
    expect(pickIcon("Les volcans")).toBe("mountain");
    expect(pickIcon("Adding fractions")).toBe("calculator");
    expect(pickIcon("zzz qqq")).toBe("lightbulb");
    expect(pickIcon("zzz", "star")).toBe("star");
  });

  it("suggestSectionCount stays in range and grows with pageCount", () => {
    let previous = 0;
    for (let count = 1; count <= 40; count += 1) {
      const sections = suggestSectionCount(count);
      expect(sections).toBeGreaterThanOrEqual(1);
      expect(sections).toBeLessThanOrEqual(24);
      expect(sections).toBeGreaterThanOrEqual(previous);
      previous = sections;
    }
    expect(suggestSectionCount(12, { includeQuiz: false, includeGlossary: false })).toBeGreaterThan(suggestSectionCount(12));
    expect(suggestSectionCount(20, { format: "social" })).toBeLessThanOrEqual(8);
    expect(suggestSectionCount(Number.NaN)).toBe(suggestSectionCount(10));
  });
});

const CONTENT_KINDS = new Set<ContentKind>([
  "title",
  "agenda",
  "section",
  "bullets",
  "concept",
  "steps",
  "timeline",
  "compare",
  "stat",
  "stats",
  "quote",
  "definition",
  "glossary",
  "question",
  "quiz",
  "activity",
  "image",
  "summary",
  "closing",
]);

const PRIMARY_FIELDS = ["items", "bullets", "steps", "terms", "stats", "compare", "quote", "question"] as const;

const LONG_BODY =
  "Scientists follow the same careful routine every time so that results can be compared. Each stage builds on the previous one, and skipping a stage makes the conclusion unreliable. Write down what you observe before you explain it.";

const MIXED: LessonOutline = normalizeOutline({
  title: "Doing science",
  language: "en",
  objectives: ["Plan a fair test"],
  sections: [
    { kind: "concept", heading: "Key tools", bullets: ["Beaker: holds liquids", "Thermometer: measures temperature", "Balance: measures mass"], icon: "check-circle" },
    { kind: "steps", heading: "The method", body: LONG_BODY, bullets: ["Work in pairs"], steps: ["Ask a question", "Make a prediction", "Test it", "Record results"], icon: "LightBulb" },
    {
      kind: "stat",
      heading: "Lab safety",
      bullets: ["90% of lab accidents are preventable", "Always wear goggles"],
      stat: { value: "3 in 4", label: "labs run a safety drill" },
      icon: "not-a-real-icon",
    },
    {
      kind: "quote",
      heading: "Curiosity",
      body: "Feynman won the Nobel Prize in 1965.",
      bullets: ["Ask why"],
      quote: { text: "Study hard what interests you the most.", author: "Richard Feynman" },
    },
    { kind: "question", heading: "Why do we repeat experiments?", body: "Think about errors.", bullets: ["Hint: chance", "Hint: accuracy"] },
    { kind: "timeline", heading: "Milestones", bullets: ["Microscopes improve", "Vaccines spread"] },
    {
      kind: "compare",
      heading: "Observation vs inference",
      bullets: ["Both matter"],
      compare: { a: { label: "Observation", points: ["What you see"] }, b: { label: "Inference", points: ["What you conclude"] } },
    },
    { kind: "summary", heading: "Wrap-up", body: LONG_BODY, bullets: ["Be careful", "Be curious"] },
  ],
  glossary: [{ term: "Hypothesis", definition: "A testable prediction", example: "Plants grow faster in light." }],
  questions: [
    { type: "match", prompt: "Match each tool.", pairs: [["Beaker", "Liquids"], ["Balance", "Mass"]] },
    { type: "short", prompt: "Name one lab tool.", answer: "Beaker" },
  ],
  activities: [{ kind: "practice", prompt: "Plan a fair test.", items: ["Choose a variable", "Keep the rest the same"] }],
});

function expectValidPage(page: SlideContent) {
  expect(CONTENT_KINDS.has(page.kind)).toBe(true);
  expect(page.title.trim()).not.toBe("");
  for (const [key, value] of Object.entries(page)) {
    expect(value, key).not.toBeUndefined();
    if (Array.isArray(value)) expect(value.length, key).toBeGreaterThan(0);
    if (typeof value === "string") expect(value.trim(), key).not.toBe("");
  }
  for (const text of [...(page.bullets ?? []), ...(page.steps ?? [])]) expect(text.trim()).not.toBe("");
  for (const item of page.items ?? []) expect(item.title.trim()).not.toBe("");
  for (const term of page.terms ?? []) expect(term.term && term.definition).toBeTruthy();
  for (const stat of page.stats ?? []) expect(stat.value.trim()).not.toBe("");
  if (page.compare) for (const side of [page.compare.a, page.compare.b]) expect(side.label && side.points.length).toBeTruthy();
  if (page.quote) expect(page.quote.text.trim()).not.toBe("");
  if (page.question) {
    expect(page.question.prompt.trim()).not.toBe("");
    if (typeof page.question.answer === "number") expect(page.question.choices?.[page.question.answer]).toBeDefined();
  }
  for (const icon of [page.icon, ...(page.items ?? []).map((item) => item.icon)]) {
    if (icon) expect(getIcon(icon)?.id, icon).toBe(icon);
  }
}

function mainFields(page: SlideContent): string[] {
  return PRIMARY_FIELDS.filter((field) => page[field] !== undefined);
}

describe("layout-engine readiness", () => {
  const decks: Record<string, SlideContent[][]> = {
    water: [planSlides(WATER), ...[3, 5, 8, 12].map((pageCount) => planSlides(WATER, { pageCount }))],
    mixed: [planSlides(MIXED), planSlides(MIXED, { pageCount: 4 }), planSlides(MIXED, { format: "social" })],
    notes: [planSlides(outlineFromText(NOTES))],
    topic: [planSlides(outlineFromTopic("Fractions", { level: "beginner" }))],
  };

  it("emits valid slide content with at most one main field per slide", () => {
    for (const [name, list] of Object.entries(decks)) {
      for (const pages of list) {
        for (const page of pages) {
          expectValidPage(page);
          expect(mainFields(page).length, `${name}: ${page.title}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("moves secondary slide material to speaker notes instead of dropping it", () => {
    const pages = planSlides(MIXED);
    const find = (title: string) => pages.find((page) => page.title === title) as SlideContent;
    expect(find("Key tools").items?.map((item) => item.title)).toEqual(["Beaker", "Thermometer", "Balance"]);
    expect(find("Key tools").bullets).toBeUndefined();
    expect(find("The method")).toMatchObject({ kind: "steps", steps: ["Ask a question", "Make a prediction", "Test it", "Record results"] });
    expect(find("The method").body).toBeUndefined();
    expect(find("The method").notes).toContain("Scientists follow the same careful routine");
    expect(find("The method").notes).toContain("• Work in pairs");
    expect(find("Lab safety")).toMatchObject({ kind: "stats", stats: [{ value: "3 in 4" }, { value: "90%" }] });
    expect(find("Lab safety").notes).toContain("• Always wear goggles");
    expect(find("Curiosity")).toMatchObject({ kind: "quote", body: "Feynman won the Nobel Prize in 1965.", notes: "• Ask why" });
    expect(find("Why do we repeat experiments?")).toMatchObject({
      kind: "question",
      question: { prompt: "Why do we repeat experiments?" },
      body: "Think about errors.",
      notes: "• Hint: chance\n• Hint: accuracy",
    });
    expect(find("Milestones")).toMatchObject({ kind: "timeline", steps: ["Microscopes improve", "Vaccines spread"] });
    expect(find("Observation vs inference").notes).toBe("• Both matter");
    expect(find("Wrap-up")).toMatchObject({ kind: "summary", bullets: ["Be careful", "Be curious"] });
    expect(find("Wrap-up").notes).toContain("Scientists follow");
    expect(find("Hypothesis")).toMatchObject({ kind: "definition", body: "Plants grow faster in light." });
  });

  it("keeps secondary material on document pages without duplicating lists", () => {
    const pages = planDocument(MIXED);
    for (const page of pages) {
      expectValidPage(page);
      expect(Boolean(page.items && (page.bullets || page.steps)), page.title).toBe(false);
    }
    const method = pages.find((page) => page.title === "The method");
    expect(method).toMatchObject({ steps: ["Ask a question", "Make a prediction", "Test it", "Record results"], bullets: ["Work in pairs"], body: LONG_BODY });
    for (const page of planDocument(MIXED, { cornell: true })) expectValidPage(page);
  });

  it("maps document variants to layout hints", () => {
    const pages: Pick<PlannedDocPage, "variant">[] = [{ variant: "article" }, { variant: "worksheet" }, { variant: "cornell" }, { variant: "answer-key" }];
    expect(docLayoutHints(pages)).toEqual(["doc-article", "doc-worksheet", "doc-cornell", "doc-article"]);
    expect(docLayoutHints(planDocument(WATER))).toHaveLength(planDocument(WATER).length);
  });
});

describe("icon ids", () => {
  it("every planner icon is a canonical id in the studio icon library", () => {
    for (const id of PLAN_ICON_IDS) expect(getIcon(id)?.id, id).toBe(id);
  });

  it("canonicalizes authored icons and falls back to keywords for unknown ones", () => {
    const pages = planSlides(MIXED);
    const icon = (title: string) => pages.find((page) => page.title === title)?.icon;
    expect(icon("Key tools")).toBe("circle-check");
    expect(icon("The method")).toBe("lightbulb");
    expect(icon("Lab safety")).toBe("flask-conical");
  });
});
