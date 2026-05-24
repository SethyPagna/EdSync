import {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_SLIDE_ANIMATIONS,
  LESSON_SLIDE_KINDS,
  LESSON_SLIDE_LAYOUTS,
  LESSON_SLIDE_TRANSITIONS,
  LESSON_OUTPUT_LENGTHS,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
  type LessonSlideAnimation,
  type LessonSlideKind,
  type LessonSlideLayout,
  type LessonSlideTransition,
} from "@/lib/learning/design-system";
import type { AiPromptContract, PracticeMode } from "@/types";

export const STUDIO_TABS = [
  { href: "/notes", kind: "note", label: "Notes" },
  { href: "/docs", kind: "doc", label: "Docs" },
  { href: "/sheets", kind: "sheet", label: "Sheets" },
  { href: "/slides", kind: "slide", label: "Slides" },
  { href: "/practice", kind: "practice", label: "Practice" },
] as const;

export const PRACTICE_MODES: Array<{
  mode: PracticeMode;
  label: string;
  description: string;
  targetMinutes: number;
  loop: string[];
  bestFor: string;
  output: string;
}> = [
  {
    mode: "quiz",
    label: "Quiz",
    description: "Fast checks with instant explanations.",
    targetMinutes: 8,
    loop: ["answer", "explain", "retry missed"],
    bestFor: "Low-stakes comprehension checks after a lesson section.",
    output: "Score, explanations, and review cards for missed questions.",
  },
  {
    mode: "exam",
    label: "Exam",
    description: "Longer timed attempts with summary review.",
    targetMinutes: 30,
    loop: ["attempt", "grade", "review readiness"],
    bestFor: "Formal checks, unit reviews, and evidence for gradebook decisions.",
    output: "Attempt summary, points, missed concepts, and teacher-review evidence.",
  },
  {
    mode: "flashcards",
    label: "Flashcards",
    description: "Flip, recall, and save weak cards.",
    targetMinutes: 10,
    loop: ["recall", "flip", "space review"],
    bestFor: "Vocabulary, formulas, definitions, and quick memory practice.",
    output: "Again/almost/mastered review queue.",
  },
  {
    mode: "matching",
    label: "Matching",
    description: "Pair terms, examples, and definitions.",
    targetMinutes: 6,
    loop: ["match", "check", "fix pairs"],
    bestFor: "Connections between concepts, examples, and categories.",
    output: "Matched pairs, missed pairs, and explanation prompts.",
  },
  {
    mode: "sprint",
    label: "Sprint",
    description: "Timed streak practice for quick recall.",
    targetMinutes: 5,
    loop: ["timer", "streak", "quick retry"],
    bestFor: "Warmups, exit reviews, and high-energy recall.",
    output: "Elapsed time, streak signal, points, and retry set.",
  },
  {
    mode: "mistake_retry",
    label: "Mistake Retry",
    description: "Practice only missed or weak items.",
    targetMinutes: 7,
    loop: ["load misses", "explain", "master"],
    bestFor: "Closing gaps from previous attempts without repeating mastered work.",
    output: "Mastery changes and next review date recommendations.",
  },
  {
    mode: "fill_blank",
    label: "Fill in the Blank",
    description: "Recall key terms in context.",
    targetMinutes: 8,
    loop: ["read context", "fill", "compare"],
    bestFor: "Terminology, procedures, and sentence-level academic language.",
    output: "Missing terms, model answer, and misconception notes.",
  },
  {
    mode: "true_false",
    label: "True or False",
    description: "Quick misconception checks.",
    targetMinutes: 5,
    loop: ["decide", "justify", "correct misconception"],
    bestFor: "Surfacing common false beliefs before deeper practice.",
    output: "Misconception list and short corrections.",
  },
  {
    mode: "generated_from_materials",
    label: "Generated from materials",
    description: "Create practice from notes, docs, sheets, or slides.",
    targetMinutes: 12,
    loop: ["select EdSync item", "AI generate", "attempt"],
    bestFor: "Turning notes, documents, sheets, slides, or lesson sections into practice.",
    output: "Generated quiz, flashcards, explanations, and saved review cards.",
  },
];

export {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_SLIDE_ANIMATIONS,
  LESSON_SLIDE_KINDS,
  LESSON_SLIDE_LAYOUTS,
  LESSON_SLIDE_TRANSITIONS,
  LESSON_OUTPUT_LENGTHS,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
};
export type { LessonSlideAnimation, LessonSlideKind, LessonSlideLayout, LessonSlideTransition };

export const AI_PROMPT_CONTRACTS: AiPromptContract[] = [
  {
    id: "clean-notes",
    title: "Clean Notes",
    description: "Turn rough notes into a clear editable document.",
    feature: "clean_notes",
    fields: [
      { id: "source", label: "Source text", type: "textarea", required: true, placeholder: "Paste rough notes..." },
      { id: "tone", label: "Tone", type: "tone", required: false, defaultValue: "clear and student-friendly" },
    ],
    insertTargets: ["new_doc", "lesson_section"],
    outputShape: { title: "string", blocks: "array", plainText: "string" },
  },
  {
    id: "create-slide-deck",
    title: "Create Slide Deck",
    description: "Convert notes or a lesson outline into editable slides.",
    feature: "slide_deck",
    fields: [
      { id: "topic", label: "Topic", type: "text", required: true },
      { id: "audience", label: "Audience", type: "text", required: false },
      { id: "slideCount", label: "Slides", type: "number", required: false, defaultValue: 8 },
      {
        id: "designTemplate",
        label: "Design template",
        type: "select",
        required: false,
        defaultValue: "corporate",
        options: LESSON_TEMPLATE_PRESETS.map((template) => template.id),
      },
      {
        id: "outputLength",
        label: "Output length",
        type: "select",
        required: false,
        defaultValue: "standard",
        options: Object.keys(LESSON_OUTPUT_LENGTHS),
      },
    ],
    insertTargets: ["new_slide_deck", "lesson_section"],
    outputShape: { title: "string", design: "object", slides: "array", transitions: "array", animations: "array" },
  },
  {
    id: "generate-practice",
    title: "Generate Practice",
    description: "Create quiz, flashcards, matching, or sprint practice from Studio content.",
    feature: "quiz",
    fields: [
      { id: "source", label: "Source", type: "textarea", required: true },
      {
        id: "mode",
        label: "Mode",
        type: "select",
        required: true,
        options: PRACTICE_MODES.map((mode) => mode.label),
      },
      {
        id: "designTemplate",
        label: "Template",
        type: "select",
        required: false,
        defaultValue: "evidence-lab",
        options: LESSON_TEMPLATE_PRESETS.map((template) => template.id),
      },
      {
        id: "outputLength",
        label: "Length",
        type: "select",
        required: false,
        defaultValue: "micro",
        options: Object.keys(LESSON_OUTPUT_LENGTHS),
      },
    ],
    insertTargets: ["practice_set", "review_card"],
    outputShape: { mode: "string", items: "array", explanations: "array", reviewCards: "array" },
  },
];

export type AiPromptSearchParams = {
  task?: string;
};

export function isAiPromptContractId(value: unknown): value is string {
  return typeof value === "string" && AI_PROMPT_CONTRACTS.some((contract) => contract.id === value);
}

export function normalizeAiPromptContractId(value: unknown): string | undefined {
  return isAiPromptContractId(value) ? value : AI_PROMPT_CONTRACTS[0]?.id;
}
