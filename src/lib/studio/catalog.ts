import {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_SLIDE_ANIMATIONS,
  LESSON_SLIDE_KINDS,
  LESSON_SLIDE_LAYOUTS,
  LESSON_SLIDE_TRANSITIONS,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
  type LessonSlideAnimation,
  type LessonSlideKind,
  type LessonSlideLayout,
  type LessonSlideTransition,
} from "@/lib/learning/design-system";
import type { AiPromptContract, PracticeMode } from "@/types";

export const STUDIO_TABS = [
  { href: "/studio", kind: "lesson", label: "Studio" },
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
}> = [
  { mode: "quiz", label: "Quiz", description: "Fast checks with instant explanations.", targetMinutes: 8 },
  { mode: "exam", label: "Exam", description: "Longer timed attempts with summary review.", targetMinutes: 30 },
  { mode: "flashcards", label: "Flashcards", description: "Flip, recall, and save weak cards.", targetMinutes: 10 },
  { mode: "matching", label: "Matching", description: "Pair terms, examples, and definitions.", targetMinutes: 6 },
  { mode: "sprint", label: "Sprint", description: "Timed streak practice for quick recall.", targetMinutes: 5 },
  { mode: "mistake_retry", label: "Mistake Retry", description: "Practice only missed or weak items.", targetMinutes: 7 },
  { mode: "fill_blank", label: "Fill in the Blank", description: "Recall key terms in context.", targetMinutes: 8 },
  { mode: "true_false", label: "True or False", description: "Quick misconception checks.", targetMinutes: 5 },
  {
    mode: "generated_from_studio",
    label: "Generated from Studio",
    description: "Create practice from notes, docs, sheets, or slides.",
    targetMinutes: 12,
  },
];

export {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_SLIDE_ANIMATIONS,
  LESSON_SLIDE_KINDS,
  LESSON_SLIDE_LAYOUTS,
  LESSON_SLIDE_TRANSITIONS,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
};
export type { LessonSlideAnimation, LessonSlideKind, LessonSlideLayout, LessonSlideTransition };

export const AI_PROMPT_CONTRACTS: AiPromptContract[] = [
  {
    id: "clean-notes",
    title: "Clean Notes",
    description: "Turn rough notes into a clear Studio document.",
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
