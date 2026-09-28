import { describe, expect, it } from "vitest";
import { deriveFlashcards, deriveLessonDraft, derivePracticeItems, deriveTags, escapeHtml, estimateDurationMinutes, isAcceptedAnswer, normalizeAcceptable } from "./derive";
import { emptyOutline, normalizeOutline } from "./outline";
import { outlineFromText, outlineFromTopic } from "./outline-from-text";
import type { LessonOutline } from "./types";

const WATER: LessonOutline = normalizeOutline({
  title: "The Water Cycle",
  level: "beginner",
  language: "en",
  objectives: ["Describe the stages of the water cycle", "Explain how clouds form"],
  sections: [
    {
      kind: "concept",
      heading: "Evaporation",
      body: "The sun heats water in oceans and lakes. The water turns into vapor and rises.",
      bullets: ["Heat from the sun drives evaporation", "Warm water evaporates faster"],
      imageQuery: "evaporation lake sun",
    },
    { kind: "steps", heading: "How rain forms", bullets: [], steps: ["Water vapor rises and cools", "Vapor condenses into droplets", "Heavy drops fall as rain"] },
    {
      kind: "compare",
      heading: "Rain vs snow",
      bullets: [],
      compare: { a: { label: "Rain", points: ["Liquid water", "Falls above 0 °C"] }, b: { label: "Snow", points: ["Ice crystals"] } },
    },
    { kind: "timeline", heading: "History of weather science", bullets: [], steps: ["1643 — Torricelli invents the barometer", "1802 — Luke Howard names the clouds"] },
    { kind: "stat", heading: "Water on Earth", bullets: [], stat: { value: "97%", label: "of Earth's water is salty" } },
    { kind: "quote", heading: "A scientist's view", bullets: [], quote: { text: "Water is the driving force of all nature.", author: "Leonardo da Vinci" } },
    { kind: "summary", heading: "Summary", bullets: ["The sun powers the cycle"] },
  ],
  glossary: [
    { term: "Evaporation", definition: "Liquid water turning into vapor" },
    { term: "Condensation", definition: "Vapor turning into liquid droplets", example: "Drops on a cold glass" },
    { term: "Precipitation", definition: "Water falling from clouds" },
  ],
  questions: [
    { type: "short", prompt: "Where does rain come from?", answer: "Clouds or fog", purpose: "diagnostic" },
    { type: "mcq", prompt: "What powers evaporation?", choices: ["The Moon", "The Sun", "Wind", "Gravity"], answer: 1, purpose: "check", section: 0 },
    { type: "true_false", prompt: "Clouds are made of tiny droplets.", answer: true, purpose: "check", section: 1 },
    { type: "mcq", prompt: "Which falls as ice crystals?", choices: ["Rain", "Snow", "Fog"], answer: 1, purpose: "final" },
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
  activities: [{ kind: "discussion", prompt: "Where have you seen condensation at home?", items: ["Kitchen", "Bathroom"] }],
});

const QA_BLOCK = `Water cycle quiz

Q: What is evaporation?
A: When liquid water turns into water vapor.

Which process returns water to the ground?
a) Evaporation
b) Condensation
c) Precipitation
d) Transpiration
Answer: c

True or false: The sun drives the water cycle. (True)
`;

describe("deriveLessonDraft", () => {
  const draft = deriveLessonDraft(WATER);

  it("builds lesson metadata", () => {
    expect(draft.lesson).toMatchObject({
      title: "The Water Cycle",
      description: "The sun heats water in oceans and lakes.",
      objectives: WATER.objectives,
      difficulty: "beginner",
      prerequisites: [],
    });
    expect(draft.lesson.estimated_duration % 5).toBe(0);
    expect(draft.lesson.tags).toContain("water");
    expect(draft.glossary).toEqual([
      { term: "Evaporation", definition: "Liquid water turning into vapor", example: null },
      { term: "Condensation", definition: "Vapor turning into liquid droplets", example: "Drops on a cold glass" },
      { term: "Precipitation", definition: "Water falling from clouds", example: null },
    ]);
  });

  it("creates one section per outline section, then activities and a quiz section", () => {
    expect(draft.sections.map((section) => section.title)).toEqual([
      "Evaporation",
      "How rain forms",
      "Rain vs snow",
      "History of weather science",
      "Water on Earth",
      "A scientist's view",
      "Summary",
      "Discussion",
      "Quiz",
    ]);
    expect(draft.sections.map((section) => section.order_index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(draft.sections.map((section) => section.content_type)).toEqual(["text", "text", "text", "text", "text", "text", "text", "activity", "quiz"]);
    expect(draft.sections[0].metadata).toEqual({ kind: "concept", source: "outline", imageQuery: "evaporation lake sun" });
    expect(draft.sections[8].content).toBeNull();
    for (const section of draft.sections) expect(section.duration_minutes).toBeGreaterThanOrEqual(1);
  });

  it("renders safe, structured HTML for each kind", () => {
    const html = draft.sections.map((section) => section.content ?? "");
    expect(html[0]).toBe(
      "<p>The sun heats water in oceans and lakes. The water turns into vapor and rises.</p><ul><li>Heat from the sun drives evaporation</li><li>Warm water evaporates faster</li></ul>",
    );
    expect(html[1]).toBe("<ol><li>Water vapor rises and cools</li><li>Vapor condenses into droplets</li><li>Heavy drops fall as rain</li></ol>");
    expect(html[2]).toBe(
      "<table><thead><tr><th>Rain</th><th>Snow</th></tr></thead><tbody><tr><td>Liquid water</td><td>Ice crystals</td></tr><tr><td>Falls above 0 °C</td><td></td></tr></tbody></table>",
    );
    expect(html[3]).toBe("<ol><li><strong>1643</strong> — Torricelli invents the barometer</li><li><strong>1802</strong> — Luke Howard names the clouds</li></ol>");
    expect(html[4]).toBe("<p><strong>97%</strong> of Earth&#39;s water is salty</p>");
    expect(html[5]).toBe("<blockquote><p>Water is the driving force of all nature.</p><p>— Leonardo da Vinci</p></blockquote>");
    expect(html[7]).toBe("<p>Where have you seen condensation at home?</p><ul><li>Kitchen</li><li>Bathroom</li></ul>");
  });

  it("gives every multiple-choice question exactly one correct option", () => {
    const mcqs = draft.quizQuestions.filter((question) => question.question_type === "multiple_choice");
    expect(mcqs).toHaveLength(2);
    const sources = WATER.questions.filter((question) => question.type === "mcq");
    mcqs.forEach((question, index) => {
      const options = question.options ?? [];
      expect(options.map((option) => option.id)).toEqual(["a", "b", "c", "d"].slice(0, options.length));
      expect(options.filter((option) => option.is_correct)).toHaveLength(1);
      const correct = options.find((option) => option.is_correct);
      expect(question.correct_answer).toBe(correct?.id);
      const source = sources[index];
      expect(correct?.text).toBe(source.choices?.[source.answer as number]);
      expect([...options.map((option) => option.text)].sort()).toEqual([...(source.choices ?? [])].sort());
    });
  });

  it("maps true/false, fill-in and short answers", () => {
    const byType = new Map(draft.quizQuestions.map((question) => [question.question_type, question]));
    expect(byType.get("true_false")).toMatchObject({
      options: [
        { id: "true", text: "True", is_correct: true },
        { id: "false", text: "False", is_correct: false },
      ],
      correct_answer: "true",
    });
    expect(byType.get("fill_blank")).toMatchObject({ options: null, correct_answer: "condensation" });
    expect(byType.get("short_answer")).toMatchObject({ options: null, correct_answer: "Clouds or fog" });
  });

  it("skips matching questions and sets purpose flags and section indices", () => {
    expect(draft.quizQuestions).toHaveLength(5);
    expect(draft.quizQuestions.map((question) => question.order_index)).toEqual([0, 1, 2, 3, 4]);
    expect(draft.quizQuestions.map((question) => [question.is_diagnostic, question.is_micro_check, question.is_final_quiz])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, true, false],
      [false, false, true],
      [false, false, true],
    ]);
    expect(draft.quizQuestions.map((question) => question.section_index)).toEqual([null, 0, 1, 8, 8]);
    for (const question of draft.quizQuestions) expect(question).toMatchObject({ difficulty: "beginner", points: 1 });
  });

  it("is deterministic and only changes order with the seed", () => {
    expect(deriveLessonDraft(WATER)).toEqual(draft);
    const outline = normalizeOutline({
      title: "Planets",
      sections: [{ heading: "Order", bullets: ["Mercury is closest to the Sun"] }],
      questions: [{ type: "mcq", prompt: "Which planet is largest?", choices: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn"], answer: 4 }],
    });
    const orders = new Set<string>();
    for (let seed = 0; seed < 12; seed += 1) {
      const [question] = deriveLessonDraft(outline, { seed }).quizQuestions;
      const options = question.options ?? [];
      expect(options.filter((option) => option.is_correct)).toHaveLength(1);
      expect(options.find((option) => option.id === question.correct_answer)?.text).toBe("Jupiter");
      orders.add(options.map((option) => option.text).join("|"));
      expect(deriveLessonDraft(outline, { seed }).quizQuestions[0].options).toEqual(options);
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("resolves purposes when the outline gives none", () => {
    const outline: LessonOutline = {
      v: 1,
      title: "Fractions",
      objectives: ["Explain fractions"],
      sections: [{ kind: "concept", heading: "Parts", bullets: ["A fraction has a numerator and a denominator"] }],
      glossary: [],
      activities: [],
      questions: Array.from({ length: 6 }, (_, index) => ({ type: "short" as const, prompt: `What is ${index + 1}/2?`, answer: `${(index + 1) / 2}`, section: 0 })),
    };
    const questions = deriveLessonDraft(outline).quizQuestions;
    expect(questions.map((question) => (question.is_diagnostic ? "d" : question.is_final_quiz ? "f" : "c"))).toEqual(["d", "c", "c", "c", "f", "f"]);
    const three = deriveLessonDraft({ ...outline, questions: outline.questions.slice(0, 3) }).quizQuestions;
    expect(three.map((question) => (question.is_diagnostic ? "d" : question.is_final_quiz ? "f" : "c"))).toEqual(["c", "c", "f"]);
  });

  it("moves micro checks without a section into the final quiz so the player can show them", () => {
    const outline: LessonOutline = {
      v: 1,
      title: "Fractions",
      objectives: ["Explain fractions"],
      sections: [{ kind: "concept", heading: "Parts", bullets: ["A fraction has a numerator and a denominator"] }],
      glossary: [],
      activities: [],
      questions: Array.from({ length: 3 }, (_, index) => ({ type: "short" as const, prompt: `What is ${index + 1}/2?`, answer: `${(index + 1) / 2}` })),
    };
    const draft = deriveLessonDraft(outline);
    const quizIndex = draft.sections.findIndex((section) => section.content_type === "quiz");
    expect(quizIndex).toBeGreaterThanOrEqual(0);
    expect(draft.quizQuestions.map((question) => [question.is_micro_check, question.is_final_quiz, question.section_index])).toEqual([
      [false, true, quizIndex],
      [false, true, quizIndex],
      [false, true, quizIndex],
    ]);

    const parsed = deriveLessonDraft(outlineFromText("Q: What gas do plants absorb?\nA: Carbon dioxide\n\n## Photosynthesis\nPlants make food from light, water and carbon dioxide."));
    expect(parsed.quizQuestions.length).toBeGreaterThanOrEqual(1);
    for (const question of parsed.quizQuestions) {
      if (!question.is_diagnostic) expect(question.section_index).not.toBeNull();
      if (question.is_micro_check) expect(parsed.sections[question.section_index as number].content_type).not.toBe("quiz");
    }
    expect(parsed.quizQuestions.find((question) => question.question_text === "What gas do plants absorb?")).toMatchObject({ is_final_quiz: true, is_micro_check: false });
  });

  it("escapes HTML and keeps **bold**", () => {
    const outline: LessonOutline = {
      v: 1,
      title: "Operators",
      objectives: ["Compare numbers"],
      sections: [
        {
          kind: "concept",
          heading: "Signs",
          body: 'Use a < b & c > d when "comparing".',
          bullets: ["**Tom** & Jerry", "<script>alert(1)</script>"],
        },
      ],
      glossary: [],
      questions: [],
      activities: [],
    };
    const [section] = deriveLessonDraft(outline).sections;
    expect(section.content).toBe(
      "<p>Use a &lt; b &amp; c &gt; d when &quot;comparing&quot;.</p><ul><li><strong>Tom</strong> &amp; Jerry</li><li>&lt;script&gt;alert(1)&lt;/script&gt;</li></ul>",
    );
    expect(escapeHtml(`<a href="x">'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;");
  });

  it("skips placeholder questions from a topic skeleton", () => {
    const skeleton = deriveLessonDraft(outlineFromTopic("Volcanoes", { level: "advanced" }));
    expect(skeleton.quizQuestions).toEqual([]);
    expect(skeleton.sections.some((section) => section.content_type === "quiz")).toBe(false);
    expect(skeleton.lesson.difficulty).toBe("advanced");
  });

  it("derives quiz rows from a parsed Q&A block", () => {
    const qa = deriveLessonDraft(outlineFromText(QA_BLOCK));
    expect(qa.quizQuestions.map((question) => question.question_type)).toEqual(["short_answer", "multiple_choice", "true_false"]);
    expect(qa.quizQuestions.every((question) => question.is_final_quiz)).toBe(true);
    const mcq = qa.quizQuestions[1];
    expect(mcq.options?.find((option) => option.id === mcq.correct_answer)?.text).toBe("Precipitation");
    expect(qa.sections.map((section) => section.content_type)).toEqual(["quiz"]);
    expect(qa.quizQuestions.every((question) => question.section_index === 0)).toBe(true);
  });

  it("handles an empty outline", () => {
    const empty = deriveLessonDraft(emptyOutline(""));
    expect(empty.sections).toEqual([]);
    expect(empty.quizQuestions).toEqual([]);
    expect(empty.lesson.title).toBe("Untitled lesson");
    expect(empty.lesson.description).toBeNull();
  });
});

describe("derivePracticeItems", () => {
  const items = derivePracticeItems(WATER);

  it("creates one item per answerable question, including matching", () => {
    expect(items.map((item) => item.type)).toEqual(["short", "mcq", "true_false", "mcq", "fill_blank", "match"]);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) expect(item.id).toMatch(/^q-\d+-[0-9a-z]+$/);
    expect(derivePracticeItems(WATER)).toEqual(items);
    expect(items[1]).toMatchObject({ answer: "The Sun", section: 0 });
    expect([...(items[1].choices ?? [])].sort()).toEqual(["Gravity", "The Moon", "The Sun", "Wind"]);
    expect(items[2]).toMatchObject({ answer: true, choices: ["True", "False"] });
    expect(items[5].answer).toEqual(["Evaporation = Liquid to gas", "Condensation = Gas to liquid", "Precipitation = Water falling"]);
  });

  it("grades responses leniently but not loosely", () => {
    const [short, mcq, trueFalse, , cloze, match] = items;
    expect(isAcceptedAnswer(mcq, "the sun")).toBe(true);
    expect(isAcceptedAnswer(mcq, "  THE   Sun. ")).toBe(true);
    expect(isAcceptedAnswer(mcq, "Sun")).toBe(true);
    expect(isAcceptedAnswer(mcq, "The Moon")).toBe(false);
    expect(isAcceptedAnswer(short, "clouds")).toBe(true);
    expect(isAcceptedAnswer(short, "Fog")).toBe(true);
    expect(isAcceptedAnswer(short, "rain")).toBe(false);
    expect(isAcceptedAnswer(cloze, "Condensation!")).toBe(true);
    expect(isAcceptedAnswer(trueFalse, "TRUE")).toBe(true);
    expect(isAcceptedAnswer(trueFalse, true)).toBe(true);
    expect(isAcceptedAnswer(trueFalse, "false")).toBe(false);
    expect(isAcceptedAnswer(match, [...(match.answer as string[])].reverse())).toBe(true);
    expect(isAcceptedAnswer(match, ["Evaporation = Gas to liquid"])).toBe(false);
    expect(isAcceptedAnswer(mcq, 42)).toBe(false);
    expect(isAcceptedAnswer(mcq, "")).toBe(false);
  });

  it("ignores accents, articles and slash alternatives", () => {
    expect(isAcceptedAnswer({ type: "short", answer: "Fotosíntesis" }, "la fotosintesis")).toBe(true);
    expect(isAcceptedAnswer({ type: "short", answer: "colour / color" }, "Color")).toBe(true);
    expect(isAcceptedAnswer({ type: "short", answer: "Evaporation, condensation and precipitation" }, "evaporation")).toBe(false);
    expect(normalizeAcceptable("  ¿La  Célula? ")).toBe("célula");
  });

  it("strips only whole-word articles", () => {
    expect(normalizeAcceptable("Abiotic")).toBe("abiotic");
    expect(normalizeAcceptable("Unbalanced")).toBe("unbalanced");
    expect(normalizeAcceptable("Theory")).toBe("theory");
    expect(normalizeAcceptable("Desert")).toBe("desert");
    expect(normalizeAcceptable("Lava")).toBe("lava");
    expect(normalizeAcceptable("L'eau")).toBe("eau");
    const outline = normalizeOutline({
      title: "Ecosystems",
      sections: [{ heading: "Factors", bullets: ["Living and non-living"] }],
      questions: [
        { type: "mcq", prompt: "Which factor is non-living?", choices: ["Biotic", "Abiotic"], answer: 1 },
        { type: "fill_blank", prompt: "Unequal forces are _____.", answer: "unbalanced" },
        { type: "short", prompt: "What is the basic unit of life?", answer: "the cell" },
        { type: "short", prompt: "Quelle est la formule H2O ?", answer: "L'eau" },
      ],
    });
    const [mcq, fill, cell, eau] = derivePracticeItems(outline);
    expect(isAcceptedAnswer(mcq, "Biotic")).toBe(false);
    expect(isAcceptedAnswer(mcq, "abiotic")).toBe(true);
    expect(isAcceptedAnswer(fill, "balanced")).toBe(false);
    expect(isAcceptedAnswer(fill, "Unbalanced")).toBe(true);
    expect(isAcceptedAnswer(cell, "cell")).toBe(true);
    expect(isAcceptedAnswer(eau, "eau")).toBe(true);
  });

  it("never accepts part of a multiple-choice answer or of a unit or fraction", () => {
    const outline = normalizeOutline({
      title: "Units",
      sections: [{ heading: "Speed", bullets: ["Distance over time"] }],
      questions: [
        { type: "mcq", prompt: "Which is a unit of speed?", choices: ["m/s", "m", "s", "kg"], answer: 0 },
        { type: "mcq", prompt: "Which falls as ice?", choices: ["Rain or drizzle", "Snow or hail", "Rain", "Snow"], answer: 1 },
        { type: "fill_blank", prompt: "Half of 1.5 is _____.", answer: "3/4" },
      ],
    });
    const [speed, ice, fraction] = derivePracticeItems(outline);
    expect(isAcceptedAnswer(speed, "m")).toBe(false);
    expect(isAcceptedAnswer(speed, "s")).toBe(false);
    expect(isAcceptedAnswer(speed, "m/s")).toBe(true);
    expect(isAcceptedAnswer(ice, "Snow")).toBe(false);
    expect(isAcceptedAnswer(ice, "snow or hail")).toBe(true);
    expect(isAcceptedAnswer(fraction, "3")).toBe(false);
    expect(isAcceptedAnswer(fraction, "4")).toBe(false);
    expect(isAcceptedAnswer(fraction, "3/4")).toBe(true);
    expect(isAcceptedAnswer({ type: "short", answer: "km/h" }, "h")).toBe(false);
  });

  it("falls back to glossary items when there are few questions", () => {
    const outline = normalizeOutline({
      title: "Cells",
      sections: [{ heading: "Parts", bullets: ["Cells have parts"] }],
      glossary: [
        { term: "Nucleus", definition: "The control center of the cell." },
        { term: "Ribosome", definition: "A tiny structure that builds proteins" },
      ],
    });
    const glossaryItems = derivePracticeItems(outline);
    expect(glossaryItems).toEqual([
      expect.objectContaining({ type: "short", prompt: "Which term means “the control center of the cell”?", answer: "Nucleus" }),
      expect.objectContaining({ type: "short", prompt: "Which term means “a tiny structure that builds proteins”?", answer: "Ribosome" }),
    ]);
    expect(glossaryItems[0].id).toMatch(/^g-1-/);
    expect(derivePracticeItems(emptyOutline("x"))).toEqual([]);
  });
});

describe("deriveFlashcards, estimateDurationMinutes and deriveTags", () => {
  it("builds deduped flashcards, glossary first", () => {
    const cards = deriveFlashcards(WATER);
    expect(cards.slice(0, 3).map((card) => card.front)).toEqual(["Evaporation", "Condensation", "Precipitation"]);
    expect(cards[1].back).toBe("Vapor turning into liquid droplets\n\nDrops on a cold glass");
    expect(cards).toContainEqual({ front: "What powers evaporation?", back: "The Sun" });
    expect(cards).toContainEqual({ front: "Clouds are made of tiny droplets.", back: "True" });
    const fronts = cards.map((card) => card.front.toLowerCase());
    expect(new Set(fronts).size).toBe(fronts.length);
    for (const card of cards) expect(card.back.trim().length).toBeGreaterThan(0);
    expect(deriveFlashcards(emptyOutline(""))).toEqual([]);
  });

  it("estimates duration in 5-minute steps between 5 and 240", () => {
    const minutes = estimateDurationMinutes(WATER);
    expect(minutes % 5).toBe(0);
    expect(minutes).toBeGreaterThanOrEqual(15);
    expect(minutes).toBeLessThanOrEqual(60);
    expect(estimateDurationMinutes(emptyOutline(""))).toBe(5);
    const huge = normalizeOutline({
      title: "Everything",
      sections: Array.from({ length: 24 }, (_, index) => ({ heading: `Part ${index}`, body: "word ".repeat(1500), bullets: [] })),
      activities: Array.from({ length: 6 }, () => ({ kind: "practice", prompt: "Practice it." })),
    });
    expect(estimateDurationMinutes(huge)).toBeLessThanOrEqual(240);
    expect(estimateDurationMinutes({ ...WATER, activities: [...WATER.activities, { kind: "reflection", prompt: "Reflect." }] })).toBeGreaterThanOrEqual(minutes);
  });

  it("derives weighted, lowercase, non-generic tags", () => {
    const tags = deriveTags(WATER);
    expect(tags[0]).toBe("water");
    expect(tags).toContain("cycle");
    expect(tags).toContain("evaporation");
    expect(tags).not.toContain("summary");
    expect(tags.length).toBeLessThanOrEqual(8);
    for (const tag of tags) expect(tag).toBe(tag.toLowerCase());
    expect(new Set(tags).size).toBe(tags.length);
    expect(deriveTags(normalizeOutline({ title: "La fotosíntesis", language: "es", sections: [{ heading: "Resumen", bullets: ["Idea"] }] }))).toEqual(["fotosíntesis"]);
  });
});
