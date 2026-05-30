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
export type LessonTemplatePreset = (typeof LESSON_TEMPLATE_PRESETS)[number];
export type LessonOutputLength = "micro" | "standard" | "extended";

const DEFAULT_TEMPLATE_INDEX = 0;
const DEFAULT_OUTPUT_LENGTH: LessonOutputLength = "standard";

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

export const LESSON_OUTPUT_LENGTHS: Record<
  LessonOutputLength,
  {
    label: string;
    slideCount: string;
    sectionDepth: string;
    practiceCount: string;
    aiInstruction: string;
  }
> = {
  micro: {
    label: "Micro",
    slideCount: "3-5 slides",
    sectionDepth: "one short explanation, one example, one check",
    practiceCount: "3-5 questions or cards",
    aiInstruction: "Keep it fast, highly scannable, and ready for a short class starter or review.",
  },
  standard: {
    label: "Standard",
    slideCount: "6-9 slides",
    sectionDepth: "clear sections with examples, media notes, and teacher checkpoints",
    practiceCount: "6-10 questions or cards with explanations and retry-missed support",
    aiInstruction: "Build a complete lesson flow that can be taught, practiced, reviewed, and graded.",
  },
  extended: {
    label: "Extended",
    slideCount: "10-14 slides",
    sectionDepth: "deeper scaffolding with variants, enrichment, remediation, and rubric evidence",
    practiceCount: "10-16 questions or cards across mixed modes",
    aiInstruction: "Create a polished unit-ready lesson with multiple versions, differentiation, and review loops.",
  },
};

export const LESSON_DESIGN_TOOL_GROUPS = [
  {
    id: "text-style",
    label: "Text and style",
    tools: ["heading", "subheading", "font", "size", "bold", "italic", "color", "highlight", "spacing"],
  },
  {
    id: "layout",
    label: "Layout",
    tools: ["columns", "grid", "align", "distribute", "margins", "callout", "timeline", "comparison"],
  },
  {
    id: "media",
    label: "Media",
    tools: ["image", "video", "link", "caption", "alt text", "source check", "safe embed"],
  },
  {
    id: "motion",
    label: "Motion",
    tools: ["transition", "entrance", "emphasis", "exit", "duration", "reduced motion fallback"],
  },
  {
    id: "practice",
    label: "Practice",
    tools: ["quiz", "exam", "flashcards", "matching", "sprint", "retry missed", "review cards"],
  },
  {
    id: "evidence",
    label: "Evidence",
    tools: ["rubric", "grade event", "feedback", "reflection", "progress signal", "dashboard recommendation"],
  },
] as const;

export const LESSON_TEMPLATE_PRESETS = [
  {
    id: "corporate",
    label: "Corporate",
    themeId: "clear-classroom",
    description: "Polished training decks with crisp contrast and compact text.",
    bestFor: ["professional training", "adult learning", "compliance", "corporate onboarding"],
    designNotes: [
      "Use compact headings and concise evidence blocks.",
      "Prefer comparison, rubric, and decision-check slides.",
      "Keep animations subtle and reduced-motion friendly.",
    ],
    slidePlan: ["title", "content", "comparison", "quiz", "reflection"],
    transition: "fade",
    animation: "rise",
    practiceModes: ["quiz", "scenario challenge", "retry missed"],
    reviewSignals: ["accuracy", "professional tone", "actionable feedback"],
  },
  {
    id: "kid-friendly",
    label: "Kid-Friendly",
    themeId: "warm-workshop",
    description: "Warmer colors, activity prompts, and softer pacing.",
    bestFor: ["younger learners", "guided practice", "introductory lessons", "visual explanation"],
    designNotes: [
      "Use clear short sentences and generous spacing.",
      "Add image-focus slides, checks for understanding, and confidence prompts.",
      "Make practice feel playful but keep answers teacher-reviewable.",
    ],
    slidePlan: ["title", "image_focus", "activity", "quiz", "reflection"],
    transition: "slide_left",
    animation: "scale",
    practiceModes: ["flashcards", "matching", "sprint"],
    reviewSignals: ["readability", "encouragement", "misconception support"],
  },
  {
    id: "focus-dark",
    label: "Dark Mode",
    themeId: "focus-dark",
    description: "High-focus presentation mode for projectors and review sessions.",
    bestFor: ["exam review", "projector delivery", "self-paced deep work", "night study"],
    designNotes: [
      "Use high contrast panels, fewer decorative accents, and strong focus hierarchy.",
      "Prefer summary, two-column, and reflection slides.",
      "Avoid motion-heavy sequences and provide static equivalents.",
    ],
    slidePlan: ["title", "content", "two_column", "activity", "reflection"],
    transition: "fade",
    animation: "fade_in",
    practiceModes: ["exam", "mistake retry", "true/false"],
    reviewSignals: ["contrast", "focus", "assessment clarity"],
  },
  {
    id: "evidence-lab",
    label: "Evidence Lab",
    themeId: "evidence-lab",
    description: "Inquiry lessons with media checks, data talk, and proof of progress.",
    bestFor: ["science inquiry", "media analysis", "project-based learning", "evidence writing"],
    designNotes: [
      "Show media or data first, then ask learners to make claims from evidence.",
      "Use timeline, image-focus, and rubric-summary patterns.",
      "Always include media safety, source context, and proof-of-progress checks.",
    ],
    slidePlan: ["title", "image_focus", "timeline", "quiz", "reflection"],
    transition: "push",
    animation: "highlight",
    practiceModes: ["fill-in-the-blank", "scenario challenge", "review cards"],
    reviewSignals: ["evidence quality", "media safety", "claim clarity"],
  },
  {
    id: "creator-studio",
    label: "Creator Workspace",
    themeId: "clear-classroom",
    description: "Office-style lesson creation with documents, slides, media, and export-ready structure.",
    bestFor: ["manual authoring", "slide design", "rich documents", "teacher-created lessons"],
    designNotes: [
      "Expose text, insert, layout, design, references, and navigation tools as compact toolbar groups.",
      "Use slide thumbnails, editor canvas, inspector controls, and persistent draft status.",
      "Keep AI output editable and insertable into docs, slides, quizzes, or lesson sections.",
    ],
    slidePlan: ["title", "content", "two_column", "activity", "quiz", "reflection"],
    transition: "fade",
    animation: "rise",
    practiceModes: ["quiz", "flashcards", "generated-from-materials"],
    reviewSignals: ["draft persistence", "layout clarity", "teacher editability"],
  },
  {
    id: "exam-prep",
    label: "Exam Prep",
    themeId: "focus-dark",
    description: "Structured review, timed practice, mistake retry, and clear performance evidence.",
    bestFor: ["test preparation", "retrieval practice", "mastery review", "student self-study"],
    designNotes: [
      "Lead with target time, expected duration, and visible attempt summary.",
      "Use compact explanations, retry missed, and save-to-review loops.",
      "Separate high-stakes exam mode from lower-pressure practice mode.",
    ],
    slidePlan: ["title", "content", "quiz", "activity", "reflection"],
    transition: "zoom",
    animation: "highlight",
    practiceModes: ["exam", "sprint", "mistake retry", "true/false"],
    reviewSignals: ["timing", "missed concepts", "readiness"],
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
  {
    id: "animation-pack",
    title: "Animation Pack",
    category: "slide_theme",
    description: "Reduced-motion-safe transition and object animation presets for lesson slideshows.",
    tags: ["slides", "motion", "presentation"],
    previewTone: "smooth and focused",
    blocks: ["transition", "entrance", "emphasis", "reduced-motion"],
  },
  {
    id: "ai-lesson-response",
    title: "AI Lesson Response",
    category: "lesson_hero",
    description: "Structured AI output for outline, slide deck, quiz, rubric, practice, and review insertion.",
    tags: ["ai", "studio", "lesson"],
    previewTone: "organized and editable",
    blocks: ["outline", "slides", "practice", "rubric", "review"],
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
    description: "Criteria table for creator feedback and learner self-check.",
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
  {
    id: "slide-animation-sequence",
    title: "Slide Animation Sequence",
    kind: "design",
    description: "Transition, object animation, duration, and reduced-motion fallback settings.",
    insertTarget: "new_slide_deck",
    estimatedMinutes: 3,
    content: { transition: "fade", animation: "rise", durationMs: 450, reducedMotion: "static reveal" },
  },
  {
    id: "ai-practice-loop",
    title: "AI Practice Loop",
    kind: "practice",
    description: "Generate practice, explain mistakes, save review cards, and recommend the next action.",
    insertTarget: "practice_set",
    estimatedMinutes: 8,
    content: { modes: ["quiz", "flashcards", "retry missed"], output: ["explanations", "review cards", "progress signal"] },
  },
];

export function lessonTemplateById(id: unknown) {
  return LESSON_TEMPLATE_PRESETS.find((template) => template.id === id) ?? LESSON_TEMPLATE_PRESETS[DEFAULT_TEMPLATE_INDEX];
}

export function listLessonTemplateOptions() {
  return LESSON_TEMPLATE_PRESETS.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    bestFor: template.bestFor,
    themeId: template.themeId,
  }));
}

export function resolveLessonOutputLength(length: unknown) {
  return typeof length === "string" && length in LESSON_OUTPUT_LENGTHS ? (length as LessonOutputLength) : DEFAULT_OUTPUT_LENGTH;
}

export function buildLessonDesignPromptContext(templateId: unknown, outputLength: unknown = DEFAULT_OUTPUT_LENGTH) {
  const template = lessonTemplateById(templateId);
  const theme = SLIDE_THEMES.find((slideTheme) => slideTheme.id === template.themeId) ?? SLIDE_THEMES[0];
  const length = resolveLessonOutputLength(outputLength);
  const lengthPlan = LESSON_OUTPUT_LENGTHS[length];

  return {
    template: {
      id: template.id,
      label: template.label,
      description: template.description,
      slidePlan: template.slidePlan,
      transition: template.transition,
      animation: template.animation,
      bestFor: template.bestFor,
      designNotes: template.designNotes,
      practiceModes: template.practiceModes,
      reviewSignals: template.reviewSignals,
    },
    theme,
    allowedLayouts: LESSON_SLIDE_LAYOUTS.map((layout) => layout.layout),
    allowedTransitions: LESSON_SLIDE_TRANSITIONS.map((transition) => transition.transition),
    allowedAnimations: LESSON_SLIDE_ANIMATIONS.map((animation) => animation.animation),
    outputLength: {
      id: length,
      ...lengthPlan,
    },
    toolGroups: LESSON_DESIGN_TOOL_GROUPS,
    reusableBlocks: DESIGN_BLOCKS.map((block) => ({
      id: block.id,
      title: block.title,
      kind: block.kind,
      insertTarget: block.insertTarget,
      estimatedMinutes: block.estimatedMinutes,
    })),
    requiredOutput: {
      design: "theme id, palette, typography, slide layout plan, transition, animation, reduced motion fallback",
      lesson: `editable sections with duration, media notes, teacher review flags, and ${lengthPlan.sectionDepth}`,
      practice: `${lengthPlan.practiceCount}; include retry-missed, explanations, points, target time, and save-to-review`,
      format: "return structured JSON that can be inserted into docs, slides, practice sets, and lesson sections",
      aiInstruction: lengthPlan.aiInstruction,
    },
  };
}
