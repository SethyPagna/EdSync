import { describe, expect, it } from "vitest";
import {
  BLANK,
  OUTLINE_LIMITS,
  clampText,
  emptyOutline,
  extractJson,
  isOutlineEmpty,
  normalizeOutline,
  parseOutline,
  seededShuffle,
  stripEmphasis,
  titleAsSubject,
} from "./outline";

const MESSY_AI = `Sure! Here is the outline you asked for:

\`\`\`json
[
  {
    "title": "The French Revolution",
    "objectives": ["Explain the causes of the revolution", "Describe key events",],
    "sections": [
      {"kind": "concept", "heading": "Causes", "bullets": ["Debt from wars", "Food shortages", "Enlightenment ideas"]},
      {"kind": "timeline", "heading": "Key events", "steps": ["1789 — Storming of the Bastille", "1793 — Reign of Terror begins"]},
      {"kind": "stat", "heading": "Population", "stat": {"value": "98%", "label": "of people were in the Third Estate"}},
    ],
    "questions": [
      {"type": "mcq", "prompt": "Which event started the revolution?", "choices": ["Storming of the Bastille", "Battle of Waterloo", "Treaty of Versailles"], "answer": 0, "purpose": "check", "section": 1},
      {"type": "true_false", "prompt": "The Third Estate was the smallest group.", "answer": false}
    ]
  }
]
\`\`\`

Let me know if you want changes!`;

function longText(words: number, word = "word"): string {
  return Array.from({ length: words }, (_, index) => `${word}${index}`).join(" ");
}

describe("extractJson", () => {
  it("reads fenced JSON with leading and trailing prose", () => {
    const value = extractJson('Here you go:\n```json\n{"title": "Cells"}\n```\nEnjoy.');
    expect(value).toEqual({ title: "Cells" });
  });

  it("repairs trailing commas, comments and unquoted keys", () => {
    const value = extractJson('{ title: "Cells", // name\n "sections": [{"heading": "Parts", "bullets": ["Nucleus",]},], }');
    expect(value).toEqual({ title: "Cells", sections: [{ heading: "Parts", bullets: ["Nucleus"] }] });
  });

  it("falls back to single quotes as a last resort", () => {
    const value = extractJson("{'title': 'Cells', 'sections': [{'heading': 'Parts', 'bullets': ['Nucleus', 'Membrane',]}]}");
    expect(value).toMatchObject({ title: "Cells", sections: [{ heading: "Parts", bullets: ["Nucleus", "Membrane"] }] });
  });

  it("closes truncated output", () => {
    const value = extractJson('{"title": "Volcanoes", "sections": [{"kind": "concept", "heading": "Magma", "bullets": ["Hot melted rock", "Rises through cracks"');
    expect(value).toMatchObject({ title: "Volcanoes", sections: [{ heading: "Magma" }] });
  });

  it("returns undefined for text without JSON", () => {
    expect(extractJson("I cannot help with that.")).toBeUndefined();
    expect(extractJson("")).toBeUndefined();
  });
});

describe("parseOutline", () => {
  it("parses messy AI output with fences, prose and an array root", () => {
    const { outline, issues } = parseOutline(MESSY_AI);
    expect(outline.title).toBe("The French Revolution");
    expect(outline.objectives).toEqual(["Explain the causes of the revolution", "Describe key events"]);
    expect(outline.sections.map((section) => section.kind)).toEqual(["concept", "timeline", "stat"]);
    expect(outline.sections[1].steps).toEqual(["1789 — Storming of the Bastille", "1793 — Reign of Terror begins"]);
    expect(outline.sections[2].stat).toEqual({ value: "98%", label: "of people were in the Third Estate" });
    expect(outline.questions).toHaveLength(2);
    expect(outline.questions[0]).toMatchObject({ type: "mcq", answer: 0, purpose: "check", section: 1 });
    expect(outline.questions[1]).toMatchObject({ type: "true_false", answer: false });
    expect(issues.filter((issue) => issue.path === "$")).toEqual([]);
  });

  it("accepts an already-parsed object and wrapper keys", () => {
    const { outline } = parseOutline({ outline: { title: "Fractions", sections: [{ heading: "Parts of a whole", bullets: ["Numerator", "Denominator"] }] } });
    expect(outline.title).toBe("Fractions");
    expect(outline.sections[0].bullets).toEqual(["Numerator", "Denominator"]);
    expect(outline.objectives.length).toBeGreaterThanOrEqual(1);
  });

  it("clamps every limit", () => {
    const { outline, issues } = parseOutline({
      title: longText(40, "title"),
      objectives: Array.from({ length: 9 }, (_, index) => `Explain idea ${index}`),
      sections: Array.from({ length: 30 }, (_, index) => ({
        kind: "concept",
        heading: `${longText(20, "heading")} ${index}`,
        bullets: Array.from({ length: 10 }, () => longText(60, "bullet")),
      })),
      questions: Array.from({ length: 25 }, (_, index) => ({ type: "short", prompt: `Question ${index}?`, answer: "Yes" })),
    });
    expect(Array.from(outline.title).length).toBeLessThanOrEqual(OUTLINE_LIMITS.title);
    expect(outline.objectives.length).toBeLessThanOrEqual(5);
    expect(outline.sections).toHaveLength(OUTLINE_LIMITS.sections);
    for (const section of outline.sections) {
      expect(Array.from(section.heading).length).toBeLessThanOrEqual(OUTLINE_LIMITS.heading);
      expect(section.bullets.length).toBeLessThanOrEqual(OUTLINE_LIMITS.bullets);
      for (const bullet of section.bullets) expect(Array.from(bullet).length).toBeLessThanOrEqual(OUTLINE_LIMITS.bullet);
    }
    expect(outline.questions).toHaveLength(OUTLINE_LIMITS.questions);
    expect(issues.some((issue) => issue.path === "sections")).toBe(true);
  });

  it("drops invalid questions and reports them", () => {
    const { outline, issues } = parseOutline({
      title: "Cells",
      sections: [{ heading: "Parts", bullets: ["Nucleus"] }],
      questions: [
        { type: "mcq", prompt: "Which part holds DNA?", choices: ["Nucleus", "Wall", "Membrane"], answer: 7 },
        { type: "true_false", prompt: "Cells are alive.", answer: "maybe" },
        { type: "match", prompt: "Match.", pairs: [["Nucleus", "Holds DNA"]] },
        { prompt: "" },
        "not a question",
        { type: "mcq", prompt: "Which part controls entry?", choices: ["Nucleus", { text: "Membrane", is_correct: true }, "Ribosome"] },
      ],
    });
    expect(outline.questions).toHaveLength(1);
    expect(outline.questions[0]).toMatchObject({ type: "mcq", answer: 1 });
    expect(issues.filter((issue) => issue.path.startsWith("questions")).length).toBeGreaterThanOrEqual(5);
  });

  it("resolves answers given as letters, text or 1-based numbers", () => {
    const { outline } = parseOutline({
      title: "Water",
      sections: [{ heading: "States", bullets: ["Solid", "Liquid", "Gas"] }],
      questions: [
        { type: "mcq", prompt: "Which is a gas?", choices: ["Ice", "Water", "Steam"], answer: "C" },
        { type: "mcq", prompt: "Which is a liquid?", choices: ["Ice", "Water", "Steam"], answer: "Water" },
        { type: "mcq", prompt: "Which is solid?", choices: ["Ice", "Water", "Steam"], answer: "Answer: A" },
        { type: "true_false", prompt: "True or false: ice floats.", answer: "True" },
      ],
    });
    expect(outline.questions.map((question) => question.answer)).toEqual([2, 1, 0, true]);
    expect(outline.questions[3].prompt).toBe("ice floats.");
  });

  it("matches an answer to its choice text before reading it as an index or letter", () => {
    const mcq = (choices: string[], answer: unknown) => parseOutline({ title: "Numbers", sections: [{ heading: "Count", bullets: ["One"] }], questions: [{ type: "mcq", prompt: "Which one?", choices, answer }] });
    const four = mcq(["3", "4", "5", "6"], "4");
    expect(four.outline.questions[0]).toMatchObject({ type: "mcq", answer: 1 });
    expect(four.issues).toContainEqual({ path: "questions[0].answer", message: "Answer matched choice text; ambiguous with an index." });
    expect(mcq(["1", "2", "3", "4"], "2").outline.questions[0].answer).toBe(1);
    expect(mcq(["b", "a", "c"], "a").outline.questions[0].answer).toBe(1);
    expect(mcq(["3", "4", "5", "6"], 2).outline.questions[0].answer).toBe(2);
    const plain = mcq(["Ice", "Water", "Steam"], "b");
    expect(plain.outline.questions[0].answer).toBe(1);
    expect(plain.issues.some((issue) => issue.message.includes("ambiguous"))).toBe(false);
  });

  it("keeps digit and letter choice pairs as multiple choice", () => {
    const { outline } = parseOutline({
      title: "Binary",
      sections: [{ heading: "Bits", bullets: ["On and off"] }],
      questions: [
        { type: "mcq", prompt: "Which digit means off?", choices: ["1", "0"], answer: "0" },
        { type: "mcq", prompt: "Which letter is a vowel?", choices: ["y", "n"], answer: 0 },
        { type: "mcq", prompt: "Is ice cold?", choices: ["Yes", "No"], answer: 0 },
        { prompt: "How many moons does Earth have?", answer: "1" },
      ],
    });
    expect(outline.questions.map((question) => question.type)).toEqual(["mcq", "mcq", "true_false", "short"]);
    expect(outline.questions[0]).toMatchObject({ choices: ["1", "0"], answer: 1 });
    expect(outline.questions[2].answer).toBe(true);
    expect(outline.questions[3].answer).toBe("1");
  });

  it("keeps initials such as E. coli and strips only sequential choice letters", () => {
    const { outline } = parseOutline({
      title: "Bacteria",
      sections: [{ heading: "Germs", bullets: ["Some make us ill"] }],
      questions: [
        { type: "mcq", prompt: "Which causes colitis?", choices: ["Salmonella", "E. coli", "Listeria", "C. difficile"], answer: "C. difficile" },
        { type: "mcq", prompt: "Which is a gas?", choices: ["a) Ice", "b) Water", "c) Steam"], answer: "c" },
        { type: "mcq", prompt: "Who wrote Narnia?", choices: ["a. C. S. Lewis", "b. B. F. Skinner"], answer: "C. S. Lewis" },
      ],
    });
    expect(outline.questions[0]).toMatchObject({ choices: ["Salmonella", "E. coli", "Listeria", "C. difficile"], answer: 3 });
    expect(outline.questions[1]).toMatchObject({ choices: ["Ice", "Water", "Steam"], answer: 2 });
    expect(outline.questions[2]).toMatchObject({ choices: ["C. S. Lewis", "B. F. Skinner"], answer: 0 });
  });

  it("does not turn number or figure fields into stat sections", () => {
    const { outline } = parseOutline({
      title: "Leaves",
      sections: [
        { number: 1, title: "What leaves do", bullets: ["Make food", "Release oxygen"] },
        { title: "Leaf parts", figure: "Labelled diagram of a leaf", bullets: ["Blade", "Vein"] },
        { title: "Photosynthesis rate", stat: "72% of the sugar is made at midday" },
      ],
    });
    expect(outline.sections.map((section) => section.kind)).toEqual(["concept", "concept", "stat"]);
    expect(outline.sections[0].bullets).toEqual(["Make food", "Release oxygen"]);
    expect(outline.sections[1].bullets).toEqual(["Blade", "Vein"]);
    expect(outline.sections[2].stat).toEqual({ value: "72%", label: "of the sugar is made at midday" });
  });

  it("derives headings for quote-only and stat-only sections", () => {
    const { outline } = parseOutline({
      title: "Curiosity",
      sections: [
        { kind: "quote", quote: { text: "Stay hungry, stay foolish", author: "Stewart Brand" } },
        { kind: "stat", stat: { value: "72%", label: "of learners forget within a week" } },
        { kind: "stat", stat: { value: "3 million" } },
        { kind: "quote", body: "“Be curious” — Einstein" },
      ],
    });
    expect(outline.sections.map((section) => section.heading)).toEqual(["Stay hungry, stay foolish", "of learners forget within a week", "3 million", "Be curious"]);
  });

  it("reports a cut-off reply and drops the unfinished item", () => {
    const { outline, issues } = parseOutline('{"title":"Cells","sections":[{"heading":"Parts","bullets":["Nucleus holds DNA","Mitochondria make ener');
    expect(outline.sections[0].bullets).toEqual(["Nucleus holds DNA"]);
    expect(issues).toContainEqual({ path: "$", message: "Reply was cut off; closed the JSON and dropped the unfinished item." });
  });

  it("decodes HTML entities in plain strings", () => {
    const { outline } = parseOutline({
      title: "Parts &amp; charges",
      sections: [{ heading: "Electrons &lt; protons", bullets: ["La cro&ucirc;te", "L&rsquo;&eacute;ruption", "Earth&#39;s crust", "&Eacute;t&eacute; &amp;lt; x", "Keep &unknown; as is"] }],
    });
    expect(outline.title).toBe("Parts & charges");
    expect(outline.sections[0].heading).toBe("Electrons < protons");
    expect(outline.sections[0].bullets).toEqual(["La croûte", "L’éruption", "Earth's crust", "Été &lt; x", "Keep &unknown; as is"]);
  });

  it("keeps fill-in-the-blank prompts with a normalised blank", () => {
    const { outline } = parseOutline({
      title: "Water",
      sections: [{ heading: "Cycle", bullets: ["Evaporation", "Condensation"] }],
      questions: [
        { type: "fill_blank", prompt: "Water vapor cools by ___.", answer: "condensation" },
        { type: "fill_blank", prompt: "Evaporation turns water into vapor.", answer: "Evaporation" },
      ],
    });
    expect(outline.questions[0]).toMatchObject({ type: "fill_blank", prompt: `Water vapor cools by ${BLANK}.`, answer: "condensation" });
    expect(outline.questions[1].prompt).toBe(`${BLANK} turns water into vapor.`);
  });

  it("never throws on empty or garbage input", () => {
    const inputs: unknown[] = [undefined, null, 42, "", "not json at all", "{{{{", "[]", [], {}, { sections: "nope" }, [1, 2, 3], "```json\n```"];
    for (const input of inputs) {
      const { outline, issues } = parseOutline(input);
      expect(outline.v).toBe(1);
      expect(outline.sections.length).toBeGreaterThanOrEqual(1);
      expect(outline.objectives.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(issues)).toBe(true);
    }
    expect(parseOutline("not json at all").issues[0].path).toBe("$");
  });

  it("keeps Spanish and French accents", () => {
    const { outline } = parseOutline(
      '{"title":"La fotosíntesis","language":"es","sections":[{"heading":"¿Qué es?","bullets":["Convierte la energía de la luz","Ocurre en las hojas"]}],"glossary":[{"term":"Clorofila","definition":"pigmento verde"}]}',
    );
    expect(outline.title).toBe("La fotosíntesis");
    expect(outline.sections[0].heading).toBe("¿Qué es?");
    expect(outline.sections[0].bullets[0]).toBe("Convierte la energía de la luz");
    expect(outline.glossary[0]).toEqual({ term: "Clorofila", definition: "Pigmento verde" });
    expect(outline.language).toBe("es");
  });

  it("normalizeOutline is idempotent", () => {
    const once = normalizeOutline(MESSY_AI);
    const twice = normalizeOutline(once);
    expect(twice).toEqual(once);
  });
});

describe("helpers", () => {
  it("emptyOutline is minimal and valid", () => {
    const outline = emptyOutline("Fractions");
    expect(outline.title).toBe("Fractions");
    expect(outline.sections).toHaveLength(1);
    expect(outline.objectives).toHaveLength(1);
    expect(isOutlineEmpty(outline)).toBe(true);
    expect(isOutlineEmpty(normalizeOutline(MESSY_AI))).toBe(false);
  });

  it("seededShuffle is a deterministic permutation", () => {
    const items = ["a", "b", "c", "d", "e"];
    const first = seededShuffle(items, 1234);
    expect(seededShuffle(items, 1234)).toEqual(first);
    expect([...first].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("clampText cuts at word boundaries and is idempotent", () => {
    const clamped = clampText("The quick brown fox jumps over the lazy dog", 20);
    expect(Array.from(clamped).length).toBeLessThanOrEqual(20);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clampText(clamped, 20)).toBe(clamped);
  });

  it("stripEmphasis removes markdown but keeps blanks", () => {
    expect(stripEmphasis("**Bold** and __strong__ and `code`")).toBe("Bold and strong and code");
    expect(stripEmphasis(`${BLANK} is a pigment`)).toBe(`${BLANK} is a pigment`);
  });

  it("titleAsSubject lowercases articles and sentence-case titles", () => {
    expect(titleAsSubject("The water cycle")).toBe("the water cycle");
    expect(titleAsSubject("Water cycle quiz")).toBe("water cycle");
    expect(titleAsSubject("World War II")).toBe("World War II");
    expect(titleAsSubject("Photosynthesis")).toBe("photosynthesis");
  });
});
