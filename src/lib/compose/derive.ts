import type { PracticeItem } from "@/lib/practice/engine";
import type { ContentType, DifficultyLevel, GlossaryTerm, Lesson, LessonSection, QuizQuestion } from "@/types";
import type { LessonOutline, OutlineQuestion, OutlineSection } from "./types";
import { clampText, composeStrings, countWords, foldText, hashString, parseBooleanAnswer, seededShuffle, type ComposeStrings } from "./outline";
import { keywordTokens } from "./outline-from-text";

/* ------------------------------------------------------------------ */
/* HTML helpers (escaped; only p/ul/ol/li/table/blockquote/strong)      */
/* ------------------------------------------------------------------ */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Escapes text, then turns `**bold**` into <strong>. */
function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>");
}

function paragraphs(text: string | undefined): string {
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${inline(part)}</p>`)
    .join("");
}

function list(items: string[] | undefined, ordered = false): string {
  if (!items?.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
}

const TIMELINE_ENTRY = /^(.{1,24}?)\s+[—–]\s+(.+)$/u;

function sectionHtml(section: OutlineSection): string {
  const parts: string[] = [paragraphs(section.body)];
  switch (section.kind) {
    case "steps":
      parts.push(list(section.steps, true), list(section.bullets));
      break;
    case "timeline":
      if (section.steps?.length) {
        parts.push(
          `<ol>${section.steps
            .map((step) => {
              const match = TIMELINE_ENTRY.exec(step);
              return match ? `<li><strong>${inline(match[1])}</strong> — ${inline(match[2])}</li>` : `<li>${inline(step)}</li>`;
            })
            .join("")}</ol>`,
        );
      }
      parts.push(list(section.bullets));
      break;
    case "compare":
      if (section.compare) {
        const { a, b } = section.compare;
        const rows = Math.max(a.points.length, b.points.length);
        const body = Array.from({ length: rows }, (_, index) => `<tr><td>${inline(a.points[index] ?? "")}</td><td>${inline(b.points[index] ?? "")}</td></tr>`).join("");
        parts.push(`<table><thead><tr><th>${inline(a.label)}</th><th>${inline(b.label)}</th></tr></thead><tbody>${body}</tbody></table>`);
      }
      parts.push(list(section.bullets));
      break;
    case "stat":
      if (section.stat) parts.push(`<p><strong>${inline(section.stat.value)}</strong> ${inline(section.stat.label)}</p>`);
      parts.push(list(section.bullets));
      break;
    case "quote":
      if (section.quote) {
        const author = section.quote.author ? `<p>— ${inline(section.quote.author)}</p>` : "";
        parts.push(`<blockquote><p>${inline(section.quote.text)}</p>${author}</blockquote>`);
      }
      parts.push(list(section.bullets));
      break;
    default:
      parts.push(list(section.bullets));
  }
  return parts.filter(Boolean).join("");
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

const OPTION_IDS = "abcdef";

function isSectionEmpty(section: OutlineSection): boolean {
  return !section.bullets.length && !section.body && !section.steps?.length && !section.compare && !section.stat && !section.quote;
}

function isPlaceholderSection(outline: LessonOutline, section: OutlineSection): boolean {
  return outline.sections.length === 1 && isSectionEmpty(section) && foldText(section.heading) === foldText(outline.title);
}

function sectionWords(section: OutlineSection): number {
  return countWords(
    [
      section.heading,
      section.body,
      ...section.bullets,
      ...(section.steps ?? []),
      ...(section.compare ? [...section.compare.a.points, ...section.compare.b.points] : []),
      section.stat ? `${section.stat.value} ${section.stat.label}` : "",
      section.quote?.text,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function shuffleSeed(outline: LessonOutline, question: OutlineQuestion, seed: number): number {
  return (hashString(`${outline.title}|${question.prompt}`) ^ seed) >>> 0;
}

/** MCQ choices in a deterministic shuffled order with the correct one flagged. */
function shuffledChoices(outline: LessonOutline, question: OutlineQuestion, seed: number): { text: string; correct: boolean }[] | undefined {
  if (question.type !== "mcq" || !question.choices || question.choices.length < 2) return undefined;
  if (typeof question.answer !== "number" || !question.choices[question.answer]) return undefined;
  const answer = question.answer;
  return seededShuffle(
    question.choices.map((text, index) => ({ text, correct: index === answer })),
    shuffleSeed(outline, question, seed),
  );
}

function isAnswerable(question: OutlineQuestion): boolean {
  if (question.placeholder) return false;
  switch (question.type) {
    case "mcq":
      return typeof question.answer === "number" && Boolean(question.choices && question.choices.length >= 2 && question.choices[question.answer] !== undefined);
    case "true_false":
      return typeof question.answer === "boolean";
    case "fill_blank":
    case "short":
      return typeof question.answer === "string" && question.answer.trim().length > 0;
    case "match":
      return Boolean(question.pairs && question.pairs.length >= 2);
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Lesson draft                                                         */
/* ------------------------------------------------------------------ */

export type DraftLesson = Pick<Lesson, "title" | "description" | "objectives" | "difficulty" | "estimated_duration" | "tags" | "prerequisites">;

export type DraftSection = Partial<LessonSection> &
  Pick<LessonSection, "title" | "content" | "content_type" | "order_index" | "duration_minutes" | "is_required" | "metadata">;

export type DraftQuizQuestion = Partial<QuizQuestion> &
  Pick<
    QuizQuestion,
    | "question_text"
    | "question_type"
    | "options"
    | "correct_answer"
    | "explanation"
    | "difficulty"
    | "points"
    | "is_diagnostic"
    | "is_micro_check"
    | "is_final_quiz"
    | "order_index"
  > & {
    /** Index into `sections` (resolve to `section_id` after insert); null = lesson-level. */
    section_index: number | null;
  };

export type DraftGlossaryTerm = Partial<GlossaryTerm> & Pick<GlossaryTerm, "term" | "definition" | "example">;

export interface LessonDraft {
  lesson: DraftLesson;
  sections: DraftSection[];
  quizQuestions: DraftQuizQuestion[];
  glossary: DraftGlossaryTerm[];
}

export interface DeriveOptions {
  /** Extra seed mixed into the per-question shuffle (default 0: stable across runs). */
  seed?: number;
}

type Purpose = NonNullable<OutlineQuestion["purpose"]>;

/** Explicit purposes win; otherwise first = diagnostic (n ≥ 4), last third = final, rest = check. */
function resolvePurposes(questions: OutlineQuestion[]): Purpose[] {
  const count = questions.length;
  const finalFrom = count - Math.max(1, Math.ceil(count / 3));
  return questions.map((question, index) => {
    if (question.purpose) return question.purpose;
    if (count >= 4 && index === 0) return "diagnostic";
    if (index >= finalFrom) return "final";
    return "check";
  });
}

function sectionContentType(section: OutlineSection): ContentType {
  if (section.kind === "activity") return "activity";
  if (section.kind === "question") return "discussion";
  return "text";
}

function sectionMinutes(section: OutlineSection): number {
  const reading = sectionWords(section) / 110;
  const extra = section.kind === "activity" ? 5 : section.kind === "question" ? 3 : 1;
  return Math.max(1, Math.ceil(reading + extra));
}

function metadataFor(section: OutlineSection): Record<string, unknown> {
  const metadata: Record<string, unknown> = { kind: section.kind, source: "outline" };
  if (section.icon) metadata.icon = section.icon;
  if (section.imageQuery) metadata.imageQuery = section.imageQuery;
  if (section.notes) metadata.notes = section.notes;
  return metadata;
}

function lessonDescription(outline: LessonOutline): string | null {
  if (outline.subtitle) return outline.subtitle;
  const first = outline.sections.find((section) => section.body || section.bullets.length);
  const text = first?.body?.split(/(?<=[.!?])\s+/)[0] ?? first?.bullets[0];
  return text ? clampText(text, 280) : null;
}

/**
 * Outline → rows for lessons / lesson_sections / quiz_questions / glossary_terms.
 * MCQ options get ids a–f in a seeded order with exactly one `is_correct`, and
 * `correct_answer` is that id; true/false uses ids "true"/"false" like the editor.
 * Placeholder and matching questions are skipped (the player cannot grade matching).
 */
export function deriveLessonDraft(outline: LessonOutline, options: DeriveOptions = {}): LessonDraft {
  const strings = composeStrings(outline.language);
  const seed = options.seed ?? 0;
  const difficulty: DifficultyLevel = outline.level ?? "intermediate";

  const sections: DraftSection[] = [];
  const sectionMap = new Map<number, number>();
  outline.sections.forEach((section, index) => {
    if (isPlaceholderSection(outline, section)) return;
    sectionMap.set(index, sections.length);
    sections.push({
      title: section.heading,
      content: sectionHtml(section) || null,
      content_type: sectionContentType(section),
      order_index: sections.length,
      duration_minutes: sectionMinutes(section),
      is_required: true,
      metadata: metadataFor(section),
    });
  });

  for (const activity of outline.activities) {
    sections.push({
      title: strings.activity[activity.kind],
      content: `${paragraphs(activity.prompt)}${list(activity.items)}` || null,
      content_type: "activity",
      order_index: sections.length,
      duration_minutes: 5,
      is_required: true,
      metadata: { kind: "activity", activity: activity.kind, source: "outline" },
    });
  }

  const usable = outline.questions.filter((question) => isAnswerable(question) && question.type !== "match");
  // The player shows a micro check only inside its section, so a check with no section goes to the final quiz.
  const purposes = resolvePurposes(usable).map((purpose, index): Purpose => {
    const section = usable[index].section;
    return purpose === "check" && (section === undefined || !sectionMap.has(section)) ? "final" : purpose;
  });
  let quizSectionIndex: number | null = null;
  if (purposes.includes("final")) {
    quizSectionIndex = sections.length;
    const finals = purposes.filter((purpose) => purpose === "final").length;
    sections.push({
      title: strings.quiz,
      content: null,
      content_type: "quiz",
      order_index: sections.length,
      duration_minutes: Math.max(3, finals),
      is_required: true,
      metadata: { kind: "quiz", source: "outline" },
    });
  }

  const quizQuestions: DraftQuizQuestion[] = usable.map((question, index) => {
    const purpose = purposes[index];
    const sectionIndex =
      purpose === "diagnostic"
        ? null
        : purpose === "final"
          ? quizSectionIndex
          : question.section !== undefined
            ? (sectionMap.get(question.section) ?? null)
            : null;
    const base = {
      question_text: question.prompt,
      explanation: question.explanation ?? null,
      difficulty,
      points: 1,
      is_diagnostic: purpose === "diagnostic",
      is_micro_check: purpose === "check",
      is_final_quiz: purpose === "final",
      order_index: index,
      section_index: sectionIndex,
    };
    if (question.type === "mcq") {
      const choices = shuffledChoices(outline, question, seed) ?? [];
      const optionsList = choices.map((choice, choiceIndex) => ({ id: OPTION_IDS[choiceIndex], text: choice.text, is_correct: choice.correct }));
      return {
        ...base,
        question_type: "multiple_choice" as const,
        options: optionsList,
        correct_answer: optionsList.find((option) => option.is_correct)?.id ?? null,
      };
    }
    if (question.type === "true_false") {
      const answer = question.answer === true;
      return {
        ...base,
        question_type: "true_false" as const,
        options: [
          { id: "true", text: strings.trueLabel, is_correct: answer },
          { id: "false", text: strings.falseLabel, is_correct: !answer },
        ],
        correct_answer: answer ? "true" : "false",
      };
    }
    return {
      ...base,
      question_type: question.type === "fill_blank" ? ("fill_blank" as const) : ("short_answer" as const),
      options: null,
      correct_answer: typeof question.answer === "string" ? question.answer : null,
    };
  });

  const glossary: DraftGlossaryTerm[] = outline.glossary.map((term) => ({ term: term.term, definition: term.definition, example: term.example ?? null }));

  return {
    lesson: {
      title: outline.title,
      description: lessonDescription(outline),
      objectives: [...outline.objectives],
      difficulty,
      estimated_duration: estimateDurationMinutes(outline),
      tags: deriveTags(outline),
      prerequisites: [],
    },
    sections,
    quizQuestions,
    glossary,
  };
}

/* ------------------------------------------------------------------ */
/* Practice items                                                       */
/* ------------------------------------------------------------------ */

export type PracticeItemType = "mcq" | "true_false" | "fill_blank" | "short" | "match";

export type ComposedPracticeItem = PracticeItem & {
  type: PracticeItemType;
  /** Display order for mcq / true_false. */
  choices?: string[];
  /** Normalised accepted responses (see `normalizeAcceptable`). */
  accept?: string[];
  /** Matching pairs (answer is `["left = right", …]`). */
  pairs?: [string, string][];
  /** Outline section index this item checks. */
  section?: number;
};

/** Whole-word articles only ("the cell", "l'eau"): "Abiotic" and "Unbalanced" keep their prefix. */
const LEADING_ARTICLE = /^(?:(?:the|a|an|el|la|los|las|un|una|unos|unas|le|les|une|des|du|de la)\s+|l['’]\s*)/iu;

/** Lowercase, trimmed, single-spaced, no trailing punctuation or leading article. Keeps accents. */
export function normalizeAcceptable(value: string): string {
  const text = value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[“”«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[¿¡]+/u, "")
    .replace(/[.!?;:,]+$/u, "")
    .trim();
  const stripped = text.replace(LEADING_ARTICLE, "").trim();
  return stripped || text;
}

/** Exact accepted forms of one answer, with no alternatives split out (MCQ choices). */
function exactAccept(answer: string): string[] {
  const normalized = normalizeAcceptable(answer);
  return normalized ? [...new Set([normalized, foldText(normalized)])].filter(Boolean) : [];
}

function acceptVariants(answer: string): string[] {
  const alternatives = new Set<string>([answer]);
  // "colour/color" lists alternatives; "m/s", "3/4" and "km/h" are single answers.
  for (const part of answer.split(/\s*[;|]\s*|(?<=\p{L}{3})\s*\/\s*(?=\p{L}{3})/u)) if (part.trim()) alternatives.add(part);
  // "Clouds or fog" / "rain, snow or hail" list alternatives; "A, B and C" is one answer.
  if (/\s(?:or|o|ou)\s/i.test(answer)) {
    const byOr = answer.split(/\s+(?:or|o|ou)\s+|\s*,\s*/i).map((part) => part.trim()).filter(Boolean);
    if (byOr.length > 1 && byOr.every((part) => countWords(part) <= 3)) byOr.forEach((part) => alternatives.add(part));
  }
  const out = new Set<string>();
  for (const alternative of alternatives) {
    const normalized = normalizeAcceptable(alternative);
    if (!normalized) continue;
    out.add(normalized);
    out.add(foldText(normalized));
  }
  return [...out].filter(Boolean);
}

function booleanAccept(value: boolean, strings: ComposeStrings): string[] {
  const words = value ? ["true", "t", "yes", "verdadero", "v", "vrai", "sí", "oui"] : ["false", "f", "no", "falso", "faux", "non"];
  return [...new Set([String(value), normalizeAcceptable(value ? strings.trueLabel : strings.falseLabel), ...words])];
}

/** True when `response` matches the item (case, spacing, accents and articles ignored). */
export function isAcceptedAnswer(item: Pick<ComposedPracticeItem, "answer" | "accept" | "type">, response: unknown): boolean {
  if (typeof item.answer === "boolean") {
    const parsed = typeof response === "boolean" ? response : parseBooleanAnswer(response);
    return parsed === item.answer;
  }
  if (Array.isArray(item.answer)) {
    if (!Array.isArray(response)) return false;
    const expected = item.answer.map((value) => foldText(value)).sort().join("|");
    return expected === response.map((value) => foldText(String(value))).sort().join("|");
  }
  if (typeof response !== "string") return false;
  const normalized = normalizeAcceptable(response);
  if (!normalized) return false;
  const accept = item.accept?.length ? item.accept : acceptVariants(item.answer);
  return accept.includes(normalized) || accept.includes(foldText(normalized));
}

function itemId(outline: LessonOutline, prefix: string, text: string, index: number): string {
  return `${prefix}-${index + 1}-${hashString(`${outline.title}|${text}`).toString(36)}`;
}

/**
 * Practice items from answerable questions (mcq, true/false, fill-in, short, matching)
 * plus "Which term means …?" glossary items when fewer than 3 questions are usable.
 */
export function derivePracticeItems(outline: LessonOutline, options: DeriveOptions = {}): ComposedPracticeItem[] {
  const strings = composeStrings(outline.language);
  const seed = options.seed ?? 0;
  const items: ComposedPracticeItem[] = [];
  outline.questions.filter(isAnswerable).forEach((question) => {
    const base = {
      id: itemId(outline, "q", question.prompt, items.length),
      prompt: question.prompt,
      points: 1,
      ...(question.explanation ? { explanation: question.explanation } : {}),
      ...(question.section !== undefined ? { section: question.section } : {}),
    };
    if (question.type === "mcq") {
      const choices = shuffledChoices(outline, question, seed);
      const correct = choices?.find((choice) => choice.correct)?.text;
      if (!choices || !correct) return;
      // Only the exact choice: splitting "m/s" or "Snow or hail" would accept the distractors "m" or "Snow".
      items.push({ ...base, type: "mcq", answer: correct, choices: choices.map((choice) => choice.text), accept: exactAccept(correct) });
    } else if (question.type === "true_false" && typeof question.answer === "boolean") {
      items.push({ ...base, type: "true_false", answer: question.answer, choices: [strings.trueLabel, strings.falseLabel], accept: booleanAccept(question.answer, strings) });
    } else if (question.type === "match" && question.pairs) {
      items.push({ ...base, type: "match", answer: question.pairs.map(([left, right]) => `${left} = ${right}`), pairs: question.pairs.map(([left, right]) => [left, right]) });
    } else if (typeof question.answer === "string") {
      items.push({ ...base, type: question.type === "fill_blank" ? "fill_blank" : "short", answer: question.answer, accept: acceptVariants(question.answer) });
    }
  });

  if (items.length < 3) {
    for (const term of outline.glossary) {
      if (items.length >= 12) break;
      const definition = term.definition.replace(/[.]+$/, "");
      const prompt = strings.whichTerm(definition.charAt(0).toLocaleLowerCase() + definition.slice(1));
      if (items.some((item) => foldText(item.prompt) === foldText(prompt))) continue;
      items.push({ id: itemId(outline, "g", term.term, items.length), type: "short", prompt, answer: term.term, accept: acceptVariants(term.term), points: 1 });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Flashcards, duration, tags                                           */
/* ------------------------------------------------------------------ */

export interface Flashcard {
  front: string;
  back: string;
}

/** Glossary cards first, then answered questions and matching pairs; deduped, max 60. */
export function deriveFlashcards(outline: LessonOutline): Flashcard[] {
  const strings = composeStrings(outline.language);
  const cards: Flashcard[] = [];
  const seen = new Set<string>();
  const add = (front: string, back: string) => {
    const key = foldText(front);
    if (!key || !back.trim() || seen.has(key) || cards.length >= 60) return;
    seen.add(key);
    cards.push({ front, back });
  };
  for (const term of outline.glossary) add(term.term, term.example ? `${term.definition}\n\n${term.example}` : term.definition);
  for (const question of outline.questions) {
    if (!isAnswerable(question)) continue;
    if (question.type === "match" && question.pairs) {
      for (const [left, right] of question.pairs) add(left, right);
      continue;
    }
    let back = "";
    if (question.type === "mcq" && typeof question.answer === "number") back = question.choices?.[question.answer] ?? "";
    else if (question.type === "true_false") back = question.answer ? strings.trueLabel : strings.falseLabel;
    else if (typeof question.answer === "string") back = question.answer;
    if (question.explanation && question.type === "true_false") back = `${back}. ${question.explanation}`;
    add(question.prompt, back);
  }
  return cards;
}

/** Reading time (~110 wpm) + per-section, question and activity time, rounded up to 5 (5–240). */
export function estimateDurationMinutes(outline: LessonOutline): number {
  const words = outline.sections.reduce((sum, section) => sum + sectionWords(section), 0) + countWords(outline.objectives.join(" "));
  let minutes = words / 110;
  for (const section of outline.sections) {
    minutes += 1.5;
    if (section.kind === "question") minutes += 2;
    if (section.kind === "activity") minutes += 4;
  }
  minutes += outline.questions.reduce((sum, question) => sum + (question.type === "short" ? 1.5 : 1), 0);
  minutes += outline.activities.length * 4;
  return Math.min(240, Math.max(5, Math.ceil(minutes / 5) * 5));
}

const GENERIC_TAG_WORDS = new Set(
  "overview introduction intro summary recap conclusion review key parts part idea ideas main notes lesson lessons unit chapter section example examples step steps question questions quiz activity activities matters things thing important basics basic understanding learn learning introducción introduccion resumen repaso ejemplo ejemplos pasos pregunta preguntas actividad lección leccion tema résumé resume exemple exemples étapes etapes leçon lecon chapitre".split(" "),
);

/** Up to 8 lowercase tags weighted from title (×3), headings (×2) and glossary terms (×2). */
export function deriveTags(outline: LessonOutline): string[] {
  const scores = new Map<string, { score: number; order: number }>();
  let order = 0;
  const add = (tag: string, weight: number) => {
    const clean = tag.toLocaleLowerCase().trim();
    if (!clean || GENERIC_TAG_WORDS.has(clean) || Array.from(clean).length < 3) return;
    const current = scores.get(clean);
    if (current) current.score += weight;
    else scores.set(clean, { score: weight, order: order++ });
  };
  keywordTokens(outline.title).forEach((token) => add(token, 3));
  outline.sections.forEach((section) => keywordTokens(section.heading.replace(/\s*\(\d+\)$/, "")).forEach((token) => add(token, 2)));
  outline.glossary.forEach((term) => {
    if (countWords(term.term) <= 3) add(term.term, 2);
  });
  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order)
    .slice(0, 8)
    .map(([tag]) => tag);
}
