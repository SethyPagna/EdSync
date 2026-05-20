import type { DesignBlock, DesignTemplate, SlideTheme } from "@/types";

export type LessonSlideKind = "content" | "quiz" | "interactive";
export type LessonSlideLayout =
  | "title"
  | "content"
  | "two_column"
  | "image_focus"
  | "quiz"
  | "activity"
  | "comparison"
  | "timeline"
  | "reflection";
export type LessonSlideTransition = "none" | "fade" | "slide_left" | "push" | "zoom";
export type LessonSlideAnimation = "none" | "fade_in" | "rise" | "scale" | "wipe" | "highlight";

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
  {
    id: "evidence-lab",
    name: "Evidence Lab",
    colors: {
      background: "#ecfeff",
      foreground: "#0f172a",
      primary: "#0e7490",
      accent: "#7c3aed",
    },
    fonts: { heading: "Inter", body: "Inter" },
  },
];

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
  { layout: "comparison", label: "Comparison", description: "Two ideas, methods, or answers side by side." },
  { layout: "timeline", label: "Timeline", description: "Sequence a process, history, or workflow." },
  { layout: "reflection", label: "Reflection", description: "Learner confidence, evidence, and next-step prompt." },
];

export const LESSON_SLIDE_TRANSITIONS: Array<{
  transition: LessonSlideTransition;
  label: string;
  durationMs: number;
}> = [
  { transition: "none", label: "None", durationMs: 0 },
  { transition: "fade", label: "Fade", durationMs: 450 },
  { transition: "slide_left", label: "Slide Left", durationMs: 520 },
  { transition: "push", label: "Push", durationMs: 560 },
  { transition: "zoom", label: "Zoom", durationMs: 420 },
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
  { animation: "wipe", label: "Wipe", durationMs: 520 },
  { animation: "highlight", label: "Highlight", durationMs: 420 },
];

export const LESSON_TEMPLATE_PRESETS = [
  {
    id: "corporate",
    label: "Corporate",
    themeId: "clear-classroom",
    description: "Polished training decks with crisp contrast and compact text.",
    slidePlan: ["title", "content", "comparison", "quiz", "reflection"],
    transition: "fade",
    animation: "rise",
  },
  {
    id: "kid-friendly",
    label: "Kid-Friendly",
    themeId: "warm-workshop",
    description: "Warmer colors, activity prompts, and softer pacing.",
    slidePlan: ["title", "image_focus", "activity", "quiz", "reflection"],
    transition: "slide_left",
    animation: "scale",
  },
  {
    id: "focus-dark",
    label: "Dark Mode",
    themeId: "focus-dark",
    description: "High-focus presentation mode for projectors and review sessions.",
    slidePlan: ["title", "content", "two_column", "activity", "reflection"],
    transition: "fade",
    animation: "fade_in",
  },
  {
    id: "evidence-lab",
    label: "Evidence Lab",
    themeId: "evidence-lab",
    description: "Inquiry lessons with media checks, data talk, and proof of progress.",
    slidePlan: ["title", "image_focus", "timeline", "quiz", "reflection"],
    transition: "push",
    animation: "highlight",
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
  {
    id: "practice-game-card",
    title: "Practice Game Card",
    category: "practice_game",
    description: "A sprint, matching, or retry card with timer, points, and explanation states.",
    tags: ["practice", "game", "review"],
    previewTone: "energetic and focused",
    blocks: ["timer", "question", "explanation", "retry"],
  },
  {
    id: "rubric-summary",
    title: "Rubric Summary",
    category: "rubric",
    description: "Compact criteria, evidence, feedback, and next step blocks.",
    tags: ["grading", "feedback", "evidence"],
    previewTone: "specific and fair",
    blocks: ["criteria", "evidence", "feedback", "next-step"],
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
  {
    id: "media-safety-check",
    title: "Media Safety Check",
    kind: "media",
    description: "Image/video/link validation checklist before publishing.",
    insertTarget: "lesson_section",
    estimatedMinutes: 4,
    content: { checks: ["Allowed source", "Clear caption", "Alt text", "Student action"] },
  },
];

export function lessonTemplateById(id: unknown) {
  return LESSON_TEMPLATE_PRESETS.find((template) => template.id === id) ?? LESSON_TEMPLATE_PRESETS[0];
}

export function buildLessonDesignPromptContext(templateId: unknown) {
  const template = lessonTemplateById(templateId);
  const theme = SLIDE_THEMES.find((slideTheme) => slideTheme.id === template.themeId) ?? SLIDE_THEMES[0];

  return {
    template: {
      id: template.id,
      label: template.label,
      description: template.description,
      slidePlan: template.slidePlan,
      transition: template.transition,
      animation: template.animation,
    },
    theme,
    allowedLayouts: LESSON_SLIDE_LAYOUTS.map((layout) => layout.layout),
    allowedTransitions: LESSON_SLIDE_TRANSITIONS.map((transition) => transition.transition),
    allowedAnimations: LESSON_SLIDE_ANIMATIONS.map((animation) => animation.animation),
    requiredOutput: {
      design: "theme id, palette, typography, slide layout plan, transition, animation, reduced motion fallback",
      lesson: "editable sections with duration, media notes, teacher review flags",
      practice: "quiz, flashcards, retry-missed, explanations, points, target time",
    },
  };
}
