import type {
  AiPromptContract,
  DesignBlock,
  DesignTemplate,
  PracticeMode,
  SlideTheme,
} from "@/types";

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

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "clear-classroom",
    name: "Clear Classroom",
    colors: {
      background: "#f8fafc",
      foreground: "#0f172a",
      primary: "#2563eb",
      accent: "#10b981",
    },
    fonts: { heading: "Inter", body: "Inter" },
  },
  {
    id: "warm-workshop",
    name: "Warm Workshop",
    colors: {
      background: "#fff7ed",
      foreground: "#1f2937",
      primary: "#ea580c",
      accent: "#0f766e",
    },
    fonts: { heading: "Inter", body: "Inter" },
  },
  {
    id: "focus-dark",
    name: "Focus Dark",
    colors: {
      background: "#111827",
      foreground: "#f9fafb",
      primary: "#60a5fa",
      accent: "#fbbf24",
    },
    fonts: { heading: "Inter", body: "Inter" },
  },
];

export type LessonSlideKind = "content" | "quiz" | "interactive";
export type LessonSlideLayout =
  | "title"
  | "content"
  | "two_column"
  | "image_focus"
  | "quiz"
  | "activity";
export type LessonSlideTransition = "none" | "fade" | "slide_left";
export type LessonSlideAnimation = "none" | "fade_in" | "rise" | "scale";

export const LESSON_SLIDE_KINDS: Array<{
  kind: LessonSlideKind;
  label: string;
  description: string;
}> = [
  { kind: "content", label: "Content", description: "Teach an idea with text, media, and examples." },
  { kind: "quiz", label: "Quiz", description: "Ask a scored check with answers and feedback." },
  { kind: "interactive", label: "Interactive", description: "Prompt discussion, practice, reflection, or activity." },
];

export const LESSON_SLIDE_LAYOUTS: Array<{
  layout: LessonSlideLayout;
  label: string;
  description: string;
}> = [
  { layout: "title", label: "Title", description: "Opening slide with a clear outcome." },
  { layout: "content", label: "Content", description: "Main idea, explanation, and example." },
  { layout: "two_column", label: "Two Column", description: "Compare, contrast, or show steps beside evidence." },
  { layout: "image_focus", label: "Image Focus", description: "Media-led slide with a short caption." },
  { layout: "quiz", label: "Quiz", description: "Question stem, options, and explanation." },
  { layout: "activity", label: "Activity", description: "Student action, timing, and collaboration prompt." },
];

export const LESSON_SLIDE_TRANSITIONS: Array<{
  transition: LessonSlideTransition;
  label: string;
  durationMs: number;
}> = [
  { transition: "none", label: "None", durationMs: 0 },
  { transition: "fade", label: "Fade", durationMs: 450 },
  { transition: "slide_left", label: "Slide Left", durationMs: 520 },
];

export const LESSON_SLIDE_ANIMATIONS: Array<{
  animation: LessonSlideAnimation;
  label: string;
  durationMs: number;
}> = [
  { animation: "none", label: "None", durationMs: 0 },
  { animation: "fade_in", label: "Fade In", durationMs: 420 },
  { animation: "rise", label: "Rise", durationMs: 480 },
  { animation: "scale", label: "Scale", durationMs: 360 },
];

export const LESSON_TEMPLATE_PRESETS = [
  {
    id: "corporate",
    label: "Corporate",
    themeId: "clear-classroom",
    description: "Polished training decks with crisp contrast and compact text.",
  },
  {
    id: "kid-friendly",
    label: "Kid-Friendly",
    themeId: "warm-workshop",
    description: "Warmer colors, activity prompts, and softer pacing.",
  },
  {
    id: "focus-dark",
    label: "Dark Mode",
    themeId: "focus-dark",
    description: "High-focus presentation mode for projectors and review sessions.",
  },
] as const;

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "course-cover",
    title: "Course Cover",
    category: "course_cover",
    description: "A branded cover for a public catalog course or internal module.",
    tags: ["catalog", "hero", "branding"],
    previewTone: "confident and clean",
    blocks: ["lesson-hero", "objective-strip", "course-meta"],
  },
  {
    id: "lesson-hero",
    title: "Lesson Hero",
    category: "lesson_hero",
    description: "A visual opener with title, objective, and student action.",
    tags: ["lesson", "slide", "intro"],
    previewTone: "clear and motivating",
    blocks: ["lesson-hero", "quick-check"],
  },
  {
    id: "worksheet",
    title: "Guided Worksheet",
    category: "worksheet",
    description: "A printable or digital worksheet with prompts and reflection space.",
    tags: ["doc", "practice", "print"],
    previewTone: "structured and supportive",
    blocks: ["guided-notes", "worked-example", "reflection"],
  },
  {
    id: "flashcards",
    title: "Flashcard Set",
    category: "flashcards",
    description: "Front/back cards with mastery labels and review prompts.",
    tags: ["practice", "review", "memory"],
    previewTone: "short and recall-focused",
    blocks: ["flashcards", "mistake-review"],
  },
  {
    id: "certificate",
    title: "Certificate",
    category: "certificate",
    description: "Completion certificate with learner, course, and issue date areas.",
    tags: ["completion", "credential"],
    previewTone: "formal and celebratory",
    blocks: ["certificate-header", "course-meta"],
  },
  {
    id: "slide-theme",
    title: "Slide Deck Theme",
    category: "slide_theme",
    description: "A cohesive deck theme with title, section, activity, and summary slides.",
    tags: ["slides", "presentation", "theme"],
    previewTone: "polished and professional",
    blocks: ["title-slide", "concept-slide", "activity-slide", "summary-slide"],
  },
];

export const DESIGN_BLOCKS: DesignBlock[] = [
  {
    id: "concept-brief",
    title: "Concept Brief",
    kind: "teach",
    description: "Short explanation with an example and check for understanding.",
    insertTarget: "lesson_section",
    estimatedMinutes: 8,
    content: { heading: "Key idea", sections: ["Explain", "Example", "Quick check"] },
  },
  {
    id: "worked-example",
    title: "Worked Example",
    kind: "teach",
    description: "Step-by-step solution or model response.",
    insertTarget: "lesson_section",
    estimatedMinutes: 10,
    content: { steps: ["Show the problem", "Model the process", "Name the pattern"] },
  },
  {
    id: "practice-sprint",
    title: "Practice Sprint",
    kind: "practice",
    description: "Timed practice with retry and explanation.",
    insertTarget: "practice_set",
    estimatedMinutes: 5,
    content: { mode: "sprint", targetSeconds: 300 },
  },
  {
    id: "slide-deck",
    title: "Slide Deck",
    kind: "design",
    description: "Title, concept, activity, quiz, and summary slide sequence.",
    insertTarget: "new_slide_deck",
    estimatedMinutes: 15,
    content: { layouts: ["title", "concept", "activity", "quiz", "summary"] },
  },
  {
    id: "rubric",
    title: "Rubric",
    kind: "assess",
    description: "Criteria table for teacher feedback and student self-check.",
    insertTarget: "new_sheet",
    estimatedMinutes: 10,
    content: { columns: ["Criteria", "Developing", "Proficient", "Advanced"] },
  },
  {
    id: "reflection",
    title: "Reflection",
    kind: "reflect",
    description: "Confidence, evidence, and next-step prompts.",
    insertTarget: "lesson_section",
    estimatedMinutes: 6,
    content: { prompts: ["What changed?", "What evidence proves it?", "What is next?"] },
  },
];

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
    ],
    insertTargets: ["new_slide_deck", "lesson_section"],
    outputShape: { title: "string", slides: "array" },
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
    ],
    insertTargets: ["practice_set", "review_card"],
    outputShape: { mode: "string", items: "array", explanations: "array" },
  },
];
