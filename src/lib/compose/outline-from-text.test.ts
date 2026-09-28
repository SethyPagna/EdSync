import { describe, expect, it } from "vitest";
import { deriveLessonDraft } from "./derive";
import { BLANK, OUTLINE_LIMITS } from "./outline";
import { detectLanguage, extractKeywords, outlineFromText, outlineFromTopic, splitSentences } from "./outline-from-text";
import { planSlides } from "./plan";
import type { LessonOutline, OutlineQuestion } from "./types";

const ENGLISH_NOTES = `# Photosynthesis

## What is photosynthesis?
Photosynthesis is the process plants use to turn light energy into chemical energy. It happens mostly in the leaves. The glucose it makes feeds the whole plant.

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

const SPANISH_PARAGRAPH = `La fotosíntesis es el proceso por el cual las plantas convierten la energía de la luz en energía química. Ocurre principalmente en las hojas, dentro de los cloroplastos. La clorofila es un pigmento verde que absorbe la luz del sol. Además, las plantas liberan oxígeno, que es esencial para la respiración de los animales. ¿Por qué es tan importante? Porque casi todas las cadenas alimentarias dependen de ella.`;

const PROCEDURE = `How to make a paper airplane

1. Fold the paper in half lengthwise.
2. Unfold it and fold the top corners to the center line.
3. Fold the new top edges to the center again.
4. Fold the plane in half along the center crease.
5. Fold the wings down on both sides.
`;

const TIMELINE = `The Space Race

Key events
- 1957 — The Soviet Union launches Sputnik 1.
- 1961: Yuri Gagarin becomes the first human in orbit.
- 1962 - John Glenn orbits the Earth.
- 1969: Apollo 11 lands on the Moon.
- 1975: Apollo–Soyuz test project marks the end of the race.
`;

const QA_BLOCK = `Water cycle quiz

Q: What is evaporation?
A: When liquid water turns into water vapor.

Q: What forms when water vapor cools?
A: Clouds

Which process returns water to the ground?
a) Evaporation
b) Condensation
c) Precipitation
d) Transpiration
Answer: c

True or false: The sun drives the water cycle. (True)
`;

const GLOSSARY_LIST = `Cell biology vocabulary

## Glossary
- Nucleus: The control center of the cell that holds DNA.
- Mitochondria: Organelles that release energy from food.
- Ribosome: A tiny structure that builds proteins.
- Cell membrane: A thin layer that controls what enters and leaves the cell.
`;

const COMPARE_STAT_QUOTE = `Plant vs animal cells

## Plant cells vs animal cells
- Plant cells have a cell wall.
- Animal cells have no cell wall.
- Plant cells contain chloroplasts.
- Animal cells use mitochondria only for energy.

## Fast facts
- 70% of a cell is water.

> The cell is the basic unit of life.
— Theodor Schwann
`;

const FRENCH_HTML = `<h1>Les volcans</h1><p>Un volcan est une ouverture dans la croûte terrestre. Le magma remonte à la surface et devient de la lave.</p><h2>Types de volcans</h2><ul><li>Volcans effusifs : la lave coule lentement.</li><li>Volcans explosifs : les éruptions sont violentes.</li></ul><h2>À retenir</h2><p>Les volcans créent de nouvelles terres.</p>`;

function allText(outline: LessonOutline): string {
  return JSON.stringify(outline);
}

function expectValidQuestions(questions: OutlineQuestion[]) {
  for (const question of questions) {
    expect(question.prompt.length).toBeGreaterThan(0);
    if (question.type === "mcq" && !question.placeholder) {
      expect(question.choices?.length).toBeGreaterThanOrEqual(2);
      expect(typeof question.answer).toBe("number");
      expect(question.choices?.[question.answer as number]).toBeDefined();
      expect(new Set(question.choices).size).toBe(question.choices?.length);
    }
    if (question.type === "true_false" && !question.placeholder) expect(typeof question.answer).toBe("boolean");
    if (question.type === "fill_blank") {
      expect(question.prompt).toContain(BLANK);
      expect(typeof question.answer).toBe("string");
    }
    if (question.type === "match") expect(question.pairs?.length).toBeGreaterThanOrEqual(2);
  }
}

describe("outlineFromText: English notes with headings and bullets", () => {
  const outline = outlineFromText(ENGLISH_NOTES);

  it("detects the title, sections and summary", () => {
    expect(outline.title).toBe("Photosynthesis");
    expect(outline.language).toBe("en");
    expect(outline.sections.map((section) => section.heading)).toEqual([
      "What is photosynthesis?",
      "Key parts",
      "Inputs and outputs",
      "Why it matters",
      "Summary",
    ]);
    expect(outline.sections[1].bullets).toEqual([
      "Chlorophyll is a green pigment that absorbs sunlight.",
      "Stomata are tiny pores that let carbon dioxide in.",
      "Glucose is a simple sugar that stores energy.",
    ]);
    expect(outline.sections[0].kind).toBe("concept");
    expect(outline.sections[4].kind).toBe("summary");
  });

  it("extracts glossary terms from definitions and bold terms", () => {
    const terms = outline.glossary.map((term) => term.term);
    expect(terms).toEqual(expect.arrayContaining(["Photosynthesis", "Chlorophyll", "Stomata", "Glucose"]));
    expect(outline.glossary.find((term) => term.term === "Chlorophyll")?.definition).toBe("A green pigment that absorbs sunlight");
  });

  it("writes Bloom-verb objectives from the first headings", () => {
    expect(outline.objectives.length).toBeGreaterThanOrEqual(1);
    expect(outline.objectives.length).toBeLessThanOrEqual(OUTLINE_LIMITS.objectives);
    expect(outline.objectives[0]).toBe("Explain what photosynthesis is");
    for (const objective of outline.objectives) expect(objective).toMatch(/^(Explain|Describe|Summarize|Compare|Apply|Interpret|Identify|Analyze)\s/);
  });

  it("generates cloze, true/false, term MCQ and matching questions", () => {
    const types = new Set(outline.questions.map((question) => question.type));
    expect(types).toEqual(new Set(["mcq", "fill_blank", "true_false", "match"]));
    expectValidQuestions(outline.questions);
    const mcq = outline.questions.find((question) => question.type === "mcq");
    const correct = mcq?.choices?.[mcq.answer as number];
    const term = outline.glossary.find((entry) => entry.term === correct);
    expect(term).toBeDefined();
    expect(mcq?.prompt.toLowerCase()).toContain(term?.definition.toLowerCase());
    const cloze = outline.questions.find((question) => question.type === "fill_blank");
    expect(cloze?.prompt).toBe(`${BLANK} is a green pigment that absorbs sunlight.`);
    expect(cloze?.answer).toBe("Chlorophyll");
    expect(outline.questions.find((question) => question.type === "match")?.pairs).toHaveLength(4);
    expect(allText(outline)).not.toMatch(/Incorrect statement/i);
  });

  it("adds image queries to content sections only", () => {
    expect(outline.sections[1].imageQuery).toBe("key parts photosynthesis");
    expect(outline.sections[4].imageQuery).toBeUndefined();
  });
});

describe("outlineFromText: Spanish paragraph", () => {
  const outline = outlineFromText(SPANISH_PARAGRAPH);

  it("keeps accents and inverted punctuation", () => {
    expect(outline.language).toBe("es");
    expect(outline.title).toBe("Fotosíntesis");
    const text = allText(outline);
    expect(text).toContain("energía química");
    expect(text).toContain("¿Por qué es tan importante?");
    expect(text).not.toContain("\\u");
  });

  it("splits prose into sentences and finds Spanish definitions", () => {
    const [section] = outline.sections;
    expect(section.bullets.length).toBeGreaterThanOrEqual(1);
    expect(section.bullets.length).toBeLessThanOrEqual(3);
    expect(section.body).toContain("Ocurre principalmente en las hojas");
    expect(outline.glossary.map((term) => term.term)).toEqual(["Fotosíntesis", "Clorofila"]);
    const cloze = outline.questions.find((question) => question.type === "fill_blank");
    expect(cloze?.prompt).toBe(`La ${BLANK} es el proceso por el cual las plantas convierten la energía de la luz en energía química.`);
    expect(outline.objectives[0]).toMatch(/^Explicar /);
  });
});

describe("outlineFromText: Spanish genus definitions", () => {
  const WATER_CYCLE = `El ciclo del agua

El agua se evapora de los océanos por el calor del sol. El vapor sube, se enfría y forma nubes. Después, el agua cae como lluvia o nieve y vuelve a los ríos.

La evaporación es el paso del agua líquida a vapor. La condensación es el paso del vapor a gotas de agua. La precipitación es la caída del agua desde las nubes.`;

  it("reads 'X es el paso de …' sentences as glossary terms", () => {
    const outline = outlineFromText(WATER_CYCLE);
    expect(outline.title).toBe("El ciclo del agua");
    expect(outline.language).toBe("es");
    expect(outline.glossary).toEqual([
      { term: "Evaporación", definition: "El paso del agua líquida a vapor" },
      { term: "Condensación", definition: "El paso del vapor a gotas de agua" },
      { term: "Precipitación", definition: "La caída del agua desde las nubes" },
    ]);
    expect(outline.objectives).toEqual(["Explicar el ciclo del agua"]);
    const mcq = outline.questions.find((question) => question.type === "mcq");
    expect(mcq?.prompt).toBe("¿Qué término significa «el paso del agua líquida a vapor»?");
    expect(mcq?.choices?.[mcq.answer as number]).toBe("Evaporación");
    expect(outline.questions.find((question) => question.type === "match")?.pairs).toHaveLength(3);
    expectValidQuestions(outline.questions);
  });
});

describe("outlineFromText: numbered procedure", () => {
  it("builds a steps section", () => {
    const outline = outlineFromText(PROCEDURE);
    expect(outline.title).toBe("How to make a paper airplane");
    expect(outline.sections).toHaveLength(1);
    expect(outline.sections[0].kind).toBe("steps");
    expect(outline.sections[0].steps).toHaveLength(5);
    expect(outline.sections[0].steps?.[0]).toBe("Fold the paper in half lengthwise.");
    expect(outline.objectives).toEqual(["Describe how to make a paper airplane"]);
  });

  it("splits long procedures into continuation sections", () => {
    const steps = Array.from({ length: 11 }, (_, index) => `${index + 1}. Do step number ${index + 1} carefully.`).join("\n");
    const outline = outlineFromText(`Long procedure\n\n${steps}`);
    expect(outline.sections.map((section) => section.steps?.length)).toEqual([8, 3]);
    expect(outline.sections[1].heading).toMatch(/\(2\)$/);
  });
});

describe("outlineFromText: timeline", () => {
  it("detects dated entries and normalises them to YEAR — event", () => {
    const outline = outlineFromText(TIMELINE);
    expect(outline.title).toBe("The Space Race");
    const [section] = outline.sections;
    expect(section.kind).toBe("timeline");
    expect(section.steps).toHaveLength(5);
    for (const step of section.steps ?? []) expect(step).toMatch(/^\d{4} — \S/);
    expect(section.steps?.[1]).toBe("1961 — Yuri Gagarin becomes the first human in orbit.");
    expect(outline.objectives[0]).toBe("Describe the Space Race");
  });
});

describe("outlineFromText: Q&A block", () => {
  it("parses Q/A pairs, lettered choices with Answer: and true/false lines", () => {
    const outline = outlineFromText(QA_BLOCK);
    expect(outline.questions).toHaveLength(4);
    expect(outline.questions[0]).toMatchObject({ type: "short", prompt: "What is evaporation?", answer: "When liquid water turns into water vapor." });
    expect(outline.questions[1]).toMatchObject({ type: "short", answer: "Clouds" });
    expect(outline.questions[2]).toMatchObject({
      type: "mcq",
      choices: ["Evaporation", "Condensation", "Precipitation", "Transpiration"],
      answer: 2,
    });
    expect(outline.questions[3]).toMatchObject({ type: "true_false", prompt: "The sun drives the water cycle.", answer: true });
    expect(outline.questions.every((question) => question.purpose === "final")).toBe(true);
    expectValidQuestions(outline.questions);
  });

  it("marks an unanswered choice block as a placeholder instead of guessing", () => {
    const outline = outlineFromText("Check\n\nWhich planet is largest?\na) Mars\nb) Jupiter\nc) Venus\n");
    expect(outline.questions[0]).toMatchObject({ type: "mcq", placeholder: true });
    expect(outline.questions[0].answer).toBeUndefined();
  });

  it("uses a correct-choice marker when there is no Answer line", () => {
    const outline = outlineFromText("Review\n\nWhich gas do plants release?\na) Nitrogen\nb) Oxygen *\nc) Helium\n");
    expect(outline.questions[0]).toMatchObject({ type: "mcq", choices: ["Nitrogen", "Oxygen", "Helium"], answer: 1 });
  });
});

describe("outlineFromText: glossary list", () => {
  const outline = outlineFromText(GLOSSARY_LIST);

  it("moves a glossary section into glossary[]", () => {
    expect(outline.title).toBe("Cell biology vocabulary");
    expect(outline.glossary).toEqual([
      { term: "Nucleus", definition: "The control center of the cell that holds DNA" },
      { term: "Mitochondria", definition: "Organelles that release energy from food" },
      { term: "Ribosome", definition: "A tiny structure that builds proteins" },
      { term: "Cell membrane", definition: "A thin layer that controls what enters and leaves the cell" },
    ]);
    expect(outline.sections.some((section) => /glossary/i.test(section.heading))).toBe(false);
  });

  it("builds term questions with glossary distractors and a true/false swap", () => {
    expectValidQuestions(outline.questions);
    const terms = outline.glossary.map((term) => term.term);
    for (const question of outline.questions.filter((item) => item.type === "mcq")) {
      expect(question.choices?.every((choice) => terms.includes(choice))).toBe(true);
    }
    const falseStatement = outline.questions.find((question) => question.type === "true_false" && question.answer === false);
    if (falseStatement) expect(falseStatement.explanation).toBeTruthy();
    expect(outline.questions.find((question) => question.type === "match")?.pairs).toHaveLength(4);
    expect(outline.objectives[0]).toBe("Explain cell biology in your own words");
  });
});

describe("outlineFromText: compare, stat and quote", () => {
  it("detects each special kind", () => {
    const outline = outlineFromText(COMPARE_STAT_QUOTE);
    const compare = outline.sections.find((section) => section.kind === "compare");
    expect(compare?.compare).toEqual({
      a: { label: "Plant cells", points: ["Plant cells have a cell wall.", "Plant cells contain chloroplasts."] },
      b: { label: "Animal cells", points: ["Animal cells have no cell wall.", "Animal cells use mitochondria only for energy."] },
    });
    expect(outline.sections.find((section) => section.kind === "stat")?.stat).toEqual({ value: "70%", label: "of a cell is water." });
    expect(outline.sections.find((section) => section.kind === "quote")?.quote).toEqual({
      text: "The cell is the basic unit of life.",
      author: "Theodor Schwann",
    });
  });

  it("reads markdown tables as compare sections", () => {
    const outline = outlineFromText("Energy\n\n## Renewable vs fossil\n| Renewable | Fossil |\n|---|---|\n| Solar | Coal |\n| Wind | Oil |\n");
    expect(outline.sections[0].kind).toBe("compare");
    expect(outline.sections[0].compare?.a).toEqual({ label: "Renewable", points: ["Solar", "Wind"] });
  });
});

describe("outlineFromText: HTML in French", () => {
  it("normalises HTML and keeps French accents", () => {
    const outline = outlineFromText(FRENCH_HTML);
    expect(outline.title).toBe("Les volcans");
    expect(outline.language).toBe("fr");
    expect(outline.sections.map((section) => section.heading)).toEqual(["Introduction", "Types de volcans", "À retenir"]);
    expect(outline.sections[2].kind).toBe("summary");
    expect(allText(outline)).toContain("croûte terrestre");
    expect(outline.glossary[0]).toEqual({ term: "Volcan", definition: "Une ouverture dans la croûte terrestre" });
    expectValidQuestions(outline.questions);
  });
});

describe("outlineFromText: robustness", () => {
  it("never crashes on empty or garbage input", () => {
    const inputs = ["", "   \n\n  ", "%%%% ### !!!\n\n--- ??? ;;;", "\u0000\u0001\u0002", "a", "?", "🙂🙂🙂", "#\n##\n###", "- \n- \n1.", undefined as unknown as string, 42 as unknown as string];
    for (const input of inputs) {
      const outline = outlineFromText(input);
      expect(outline.v).toBe(1);
      expect(outline.title.length).toBeGreaterThan(0);
      expect(outline.sections.length).toBeGreaterThanOrEqual(1);
      expect(outline.objectives.length).toBeGreaterThanOrEqual(1);
    }
    expect(outlineFromText("").title).toBe("Untitled lesson");
    expect(outlineFromText("%%%% ### !!!\n\n--- ??? ;;;").title).toBe("Untitled lesson");
  });

  it("uses the provided title and language", () => {
    const outline = outlineFromText("Some notes about magnets.\n\nMagnets attract iron.", { title: "Magnets", language: "en" });
    expect(outline.title).toBe("Magnets");
    expect(outline.language).toBe("en");
  });

  it("chunks long prose into several sections", () => {
    const sentence = "The Industrial Revolution changed how goods were made in factories across Britain.";
    const outline = outlineFromText(Array.from({ length: 16 }, () => sentence).join(" "));
    expect(outline.sections.length).toBeGreaterThanOrEqual(2);
    for (const section of outline.sections) expect(section.bullets.length).toBeLessThanOrEqual(OUTLINE_LIMITS.bullets);
  });

  it("is deterministic", () => {
    expect(outlineFromText(ENGLISH_NOTES)).toEqual(outlineFromText(ENGLISH_NOTES));
  });
});

describe("outlineFromText: pasted-notes edge cases", () => {
  const sectionText = (outline: LessonOutline) =>
    outline.sections.flatMap((section) => [section.heading, section.body ?? "", ...section.bullets, ...(section.steps ?? [])]).join("\n");

  it("reads lines starting with initials as text, not answer choices", () => {
    const outline = outlineFromText("Microbes\n\nE. coli lives in the human gut.\nA. Lincoln was a president.\nC. S. Lewis wrote Narnia.");
    expect(outline.sections.map((section) => section.kind)).toEqual(["concept"]);
    expect(outline.sections[0].bullets).toEqual(["E. coli lives in the human gut.", "A. Lincoln was a president.", "C. S. Lewis wrote Narnia."]);
    expect(outline.glossary.map((term) => term.term)).not.toContain("Coli");
  });

  it("keeps E. coli as a choice and keys the answer by its text", () => {
    const outline = outlineFromText("Bacteria\n\nWhich bacterium causes colitis?\na) Salmonella\nb) E. coli\nc) Listeria\nd) C. difficile\nAnswer: C. difficile");
    expect(outline.questions[0]).toMatchObject({ type: "mcq", choices: ["Salmonella", "E. coli", "Listeria", "C. difficile"], answer: 3 });
  });

  it("still reads a regular a)–d) block with a letter answer", () => {
    const outline = outlineFromText("Water\n\nWhich state is steam?\na) Solid\nb) Liquid\nc) Gas\nd) Plasma\nAnswer: c");
    expect(outline.questions[0]).toMatchObject({ type: "mcq", choices: ["Solid", "Liquid", "Gas", "Plasma"], answer: 2 });
  });

  it("keeps a 1/0 choice pair as multiple choice", () => {
    const outline = outlineFromText("Binary\n\nWhich digit means off?\na) 1\nb) 0\nAnswer: 0");
    expect(outline.questions[0]).toMatchObject({ type: "mcq", choices: ["1", "0"], answer: 1 });
  });

  it("turns plain 'Term: definition' lines into glossary terms and questions", () => {
    const outline = outlineFromText(
      "Ecology vocabulary\n\nEcosystem: a community of living things and their environment\nProducer - an organism that makes its own food\nConsumer – an organism that eats other organisms\nDecomposer: an organism that breaks down dead matter\nHabitat: the natural home of an organism",
    );
    expect(outline.glossary.map((term) => term.term)).toEqual(["Ecosystem", "Producer", "Consumer", "Decomposer", "Habitat"]);
    expect(outline.questions.length).toBeGreaterThanOrEqual(5);
    expect(outline.sections[0].heading).toBe("Key terms");
    expect(outline.sections[0].bullets).toHaveLength(5);
  });

  it("splits short unpunctuated lines into separate bullets but keeps wrapped prose together", () => {
    const volcano = outlineFromText(
      "# Volcanoes\n\n## How a volcano erupts\nMagma rises from the mantle\nPressure builds up under the crust\nGas bubbles expand quickly\nThe volcano erupts and lava flows out",
    );
    expect(volcano.sections[0].bullets).toEqual(["Magma rises from the mantle", "Pressure builds up under the crust", "Gas bubbles expand quickly", "The volcano erupts and lava flows out"]);
    const wrapped = outlineFromText("# Plants\n\n## Leaves\nPhotosynthesis happens in the leaves\nof green plants and algae.");
    expect(wrapped.sections[0].bullets).toEqual(["Photosynthesis happens in the leaves of green plants and algae."]);
  });

  it("parses a fill-in-the-blank line with an Answer line and never shows the answer as slide text", () => {
    const outline = outlineFromText("Review\n\n5. The capital of France is ____.\nAnswer: Paris");
    expect(outline.questions).toEqual([expect.objectContaining({ type: "fill_blank", prompt: `The capital of France is ${BLANK}.`, answer: "Paris" })]);
    expect(sectionText(outline)).not.toContain("Paris");
    const orphan = outlineFromText("# Facts\n\n## Numbers\nSeven is a prime number.\nAnswer: 42");
    expect(sectionText(orphan)).not.toContain("42");
    expect(orphan.sections[0].notes).toBe("Answer: 42");
  });

  it("keeps the full text of a sentence longer than a bullet", () => {
    const sentence =
      "The French Revolution was a period of political and societal change in France that began with the Estates General of 1789 and ended with the coup of 18 Brumaire in November 1799 and the formation of the French Consulate.";
    const outline = outlineFromText(`French Revolution\n\n${sentence}`);
    expect(outline.sections[0].body).toBe(sentence);
    expect(Array.from(outline.sections[0].bullets[0]).length).toBeLessThanOrEqual(OUTLINE_LIMITS.bullet);
  });

  it("keeps long timeline entries in the outline, slides and lesson", () => {
    const source = [
      "In 1789 the Estates General met at Versailles, and within weeks the Third Estate declared itself the National Assembly and swore the Tennis Court Oath to write a constitution.",
      "In 1792 the monarchy was abolished after the storming of the Tuileries Palace, and France was proclaimed a republic while its armies fought Austria and Prussia on the border.",
      "In 1799 Napoleon Bonaparte seized power in the coup of 18 Brumaire, which ended the Directory and began the Consulate that would later become his empire.",
    ].join(" ");
    const outline = outlineFromText(`# French Revolution\n\n## Key events\n${source}`);
    const tails = ["Tennis Court Oath to write a constitution", "fought Austria and Prussia on the border", "would later become his empire"];
    expect(outline.sections[0].kind).toBe("timeline");
    for (const result of [outline, planSlides(outline), deriveLessonDraft(outline)]) {
      for (const tail of tails) expect(JSON.stringify(result)).toContain(tail);
    }
  });

  it("keeps the end of a long ordered instruction", () => {
    const instruction = "Record every measurement in the lab notebook as soon as it is taken, including the unit, instrument, date, and any unusual conditions, so another student can repeat the experiment without guessing which observation belongs to which trial.";
    const outline = outlineFromText(`Lab procedure\n\n1. ${instruction}\n2. Compare the results.`);
    expect(outline.sections[0].kind).toBe("steps");
    for (const result of [outline, planSlides(outline), deriveLessonDraft(outline)]) {
      expect(JSON.stringify(result)).toContain("which observation belongs to which trial");
    }
  });

  it("does not mistake quoted terms inside a sentence for a quotation", () => {
    const sentence = '"Photosynthesis" is how plants make "food"';
    const outline = outlineFromText(`Plants\n\n${sentence}\nPlants need light and water to grow tall.`);
    expect(outline.sections.some((section) => section.kind === "quote")).toBe(false);
    expect(sectionText(outline)).toContain(sentence);
  });

  it("detects quotes written as a quoted line with an author", () => {
    const twoLines = outlineFromText("Leadership\n\n“Education is the most powerful weapon which you can use to change the world.”\n— Nelson Mandela");
    expect(twoLines.sections[0]).toMatchObject({
      kind: "quote",
      bullets: [],
      quote: { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    });
    const oneLine = outlineFromText('# Creativity\n\n## Why it matters\nCurious students ask better questions.\n\n"Imagination is more important than knowledge." — Albert Einstein');
    const quote = oneLine.sections.find((section) => section.kind === "quote");
    expect(quote?.quote).toEqual({ text: "Imagination is more important than knowledge.", author: "Albert Einstein" });
    expect(oneLine.sections.map((section) => section.heading)).not.toContain('"Imagination');
  });

  it("treats bare 'Slide N' lines as boundaries, not titles or headings", () => {
    const outline = outlineFromText("Slide 1\nFractions\nA fraction shows part of a whole.\n\nSlide 2\nThe numerator is the top number.\nThe denominator is the bottom number.");
    expect(outline.title).toBe("Fractions");
    expect(outline.sections.map((section) => section.heading.toLowerCase())).not.toContain("slide 2");
    expect(outline.objectives.join(" ").toLowerCase()).not.toContain("slide");
    expect(outline.sections).toHaveLength(2);
  });

  it("decodes HTML entities and reads back its own lesson HTML", () => {
    const french = outlineFromText("<h2>La cro&ucirc;te</h2><p>L&rsquo;&eacute;ruption est un ph&eacute;nom&egrave;ne. Earth&#39;s crust is thin.</p>");
    expect(french.title).toBe("La croûte");
    expect(sectionText(french)).toContain("L’éruption est un phénomène.");
    expect(sectionText(french)).toContain("Earth's crust is thin.");
    const draft = deriveLessonDraft(outlineFromText('Leaves\n\n## Leaf job\nA leaf\'s job is "food". Leaves make sugar & oxygen.'));
    const html = draft.sections.map((section) => `<h2>${section.title}</h2>${section.content ?? ""}`).join("");
    expect(html).toContain("&#39;");
    const back = outlineFromText(html);
    expect(back.sections.flatMap((section) => section.bullets)).toEqual(['A leaf\'s job is "food".', "Leaves make sugar & oxygen."]);
  });
});

describe("outlineFromTopic", () => {
  it("returns a skeleton with placeholder questions and no fake options", () => {
    const outline = outlineFromTopic("Photosynthesis", { level: "beginner" });
    expect(outline.title).toBe("Photosynthesis");
    expect(outline.level).toBe("beginner");
    expect(outline.objectives).toEqual([
      "Identify the key ideas of photosynthesis",
      "Explain photosynthesis in your own words",
      "Apply photosynthesis to a real example",
    ]);
    expect(outline.sections.map((section) => section.kind)).toEqual(["concept", "concept", "concept", "steps", "question", "summary"]);
    expect(outline.questions.length).toBeGreaterThanOrEqual(3);
    for (const question of outline.questions) {
      expect(question.placeholder).toBe(true);
      expect(question.answer).toBeUndefined();
      expect(question.choices ?? []).toEqual([]);
    }
    expect(allText(outline)).not.toMatch(/Incorrect statement|Option [A-D]/i);
  });

  it("follows the level and language", () => {
    const outline = outlineFromTopic("la Revolución francesa", { level: "advanced", language: "es" });
    expect(outline.language).toBe("es");
    expect(outline.objectives.map((objective) => objective.split(" ")[0])).toEqual(["Analizar", "Evaluar", "Crear"]);
    expect(outline.sections[0].heading).toBe("Idea clave");
    expect(outlineFromTopic("").title).toBe("Untitled lesson");
  });
});

describe("text helpers", () => {
  it("splitSentences guards abbreviations, initials and decimals", () => {
    expect(splitSentences("Dr. Smith arrived at 3.5 p.m. on Monday. He met e.g. the team. Then he left!")).toEqual([
      "Dr. Smith arrived at 3.5 p.m. on Monday.",
      "He met e.g. the team.",
      "Then he left!",
    ]);
    expect(splitSentences("¿Qué es la luz? ¡Es energía! Sí.")).toEqual(["¿Qué es la luz?", "¡Es energía!", "Sí."]);
    expect(splitSentences("J. K. Rowling wrote it. It sold well.")).toEqual(["J. K. Rowling wrote it.", "It sold well."]);
    expect(splitSentences("")).toEqual([]);
  });

  it("detectLanguage recognises en, es and fr", () => {
    expect(detectLanguage("The cell is the basic unit of life and it has a membrane.")).toBe("en");
    expect(detectLanguage("La célula es la unidad básica de la vida y tiene una membrana.")).toBe("es");
    expect(detectLanguage("La cellule est l'unité de base de la vie et elle a une membrane.")).toBe("fr");
    expect(detectLanguage("12345")).toBeUndefined();
  });

  it("extractKeywords skips stopwords and keeps accents", () => {
    expect(extractKeywords("La energía solar y la energía eólica son energías limpias.", 2)).toEqual(["energía", "solar"]);
  });
});
