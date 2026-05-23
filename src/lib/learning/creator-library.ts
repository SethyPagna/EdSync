export type CreatorPanelId = "templates" | "elements" | "uploads" | "text" | "brand" | "tools" | "animate" | "export";
export type NoteDesignPresetId = "clean" | "focus" | "visual" | "review" | "planning" | "feedback" | "resource";

export type CreatorLibraryItem = {
  id: string;
  label: string;
  description: string;
  tags: string[];
};

export type NoteDesignPreset = {
  id: NoteDesignPresetId;
  label: string;
  description: string;
  accent: string;
  className: string;
};

export const CREATOR_PANEL_SUMMARY: Array<{
  id: CreatorPanelId;
  label: string;
  description: string;
}> = [
  { id: "templates", label: "Templates", description: "Lesson, note, worksheet, deck, and practice looks." },
  { id: "elements", label: "Elements", description: "Blocks, shapes, media prompts, quizzes, and cards." },
  { id: "uploads", label: "Uploads", description: "Safe images, videos, documents, and source files." },
  { id: "text", label: "Text", description: "Headings, body styles, callouts, lists, and references." },
  { id: "brand", label: "Brand", description: "Color palettes, tone, typography, and reusable styling." },
  { id: "tools", label: "Tools", description: "AI cleanup, translate, remix, duplicate, export, and publish." },
  { id: "animate", label: "Animate", description: "Slide transitions, object motion, and reduced-motion fallbacks." },
  { id: "export", label: "Export", description: "Publish, preview, download, or insert into a class workflow." },
];

export const CREATOR_ASSET_CATEGORIES: CreatorLibraryItem[] = [
  { id: "shapes", label: "Shapes", description: "Arrows, badges, frames, dividers, and layout markers.", tags: ["design", "layout"] },
  { id: "graphics", label: "Graphics", description: "Illustrations and visual anchors for concepts.", tags: ["design", "visual"] },
  { id: "photos", label: "Photos", description: "Image placeholders with captions and alt text.", tags: ["media", "image"] },
  { id: "videos", label: "Videos", description: "YouTube, Vimeo, and uploaded video prompts.", tags: ["media", "video"] },
  { id: "animations", label: "Animations", description: "Rise, fade, wipe, highlight, and static fallback.", tags: ["motion", "slides"] },
  { id: "audio", label: "Audio", description: "Voice notes, pronunciation clips, and listening prompts.", tags: ["media", "accessibility"] },
  { id: "sheets", label: "Sheets", description: "Rubrics, schedules, question banks, and data tables.", tags: ["data", "rubric"] },
  { id: "tables", label: "Tables", description: "Comparison, criteria, vocabulary, and planning grids.", tags: ["layout", "data"] },
  { id: "charts", label: "Charts", description: "Progress, accuracy, timing, and evidence visuals.", tags: ["analytics", "progress"] },
  { id: "frames", label: "Frames", description: "Media frames, worksheet zones, and card containers.", tags: ["design", "media"] },
  { id: "mockups", label: "Mockups", description: "Course cards, dashboards, and lesson-player previews.", tags: ["catalog", "preview"] },
  { id: "practice", label: "Practice", description: "Quiz, matching, sprint, flashcard, and retry blocks.", tags: ["practice", "kahoot"] },
];

export const CREATOR_TEXT_STYLES: CreatorLibraryItem[] = [
  { id: "heading", label: "Heading", description: "Large section title for lesson or note structure.", tags: ["text", "structure"] },
  { id: "subheading", label: "Subheading", description: "Short divider for steps, examples, or checks.", tags: ["text", "structure"] },
  { id: "body", label: "Body", description: "Readable paragraph text with safe line length.", tags: ["text", "paragraph"] },
  { id: "callout", label: "Callout", description: "Important idea, warning, misconception, or reminder.", tags: ["text", "highlight"] },
  { id: "citation", label: "Reference", description: "Source, link, page, or standards reference.", tags: ["reference", "source"] },
  { id: "glossary", label: "Glossary", description: "Term, definition, example, and quick check.", tags: ["vocabulary", "reference"] },
];

export const CREATOR_PALETTE_SWATCHES = [
  "#2557D6",
  "#0F766E",
  "#F59E0B",
  "#EF4444",
  "#7C3AED",
  "#0EA5E9",
  "#111827",
  "#F8FAFC",
  "#22C55E",
  "#F97316",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
  "#84CC16",
  "#EAB308",
] as const;

export const CREATOR_EXPORT_OPTIONS: CreatorLibraryItem[] = [
  { id: "lesson", label: "Lesson", description: "Save as an EdSync lesson with sections, quiz, and evidence.", tags: ["publish", "lesson"] },
  { id: "pptx", label: "PPTX", description: "Export slide-ready outlines and decks for presentation use.", tags: ["download", "slides"] },
  { id: "pdf", label: "PDF", description: "Prepare worksheet, rubric, or report print output.", tags: ["download", "print"] },
  { id: "html", label: "HTML", description: "Export clean content blocks for LMS-compatible review.", tags: ["download", "web"] },
  { id: "csv", label: "CSV", description: "Export rubrics, question banks, schedules, or score plans.", tags: ["download", "sheet"] },
];

export const NOTE_DESIGN_PRESETS: NoteDesignPreset[] = [
  {
    id: "clean",
    label: "Clean",
    description: "Quiet note card for plain study and planning.",
    accent: "#2557D6",
    className: "border-edsync-border bg-edsync-card",
  },
  {
    id: "focus",
    label: "Focus",
    description: "Blue focus treatment for key ideas and summaries.",
    accent: "#2557D6",
    className: "border-edsync-blue/30 bg-edsync-blue/10",
  },
  {
    id: "visual",
    label: "Visual",
    description: "Green media-first note for images, videos, and examples.",
    accent: "#0F766E",
    className: "border-edsync-emerald/30 bg-edsync-emerald/10",
  },
  {
    id: "review",
    label: "Review",
    description: "Amber review card for mistakes, feedback, and next steps.",
    accent: "#F59E0B",
    className: "border-edsync-amber/30 bg-edsync-amber/10",
  },
  {
    id: "planning",
    label: "Planning",
    description: "Teacher planning note for lesson prep and resources.",
    accent: "#7C3AED",
    className: "border-purple-500/30 bg-purple-500/10",
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "Teacher feedback card for student evidence and coaching.",
    accent: "#F59E0B",
    className: "border-edsync-amber/30 bg-edsync-amber/10",
  },
  {
    id: "resource",
    label: "Resource",
    description: "Reference note for links, media, documents, and citations.",
    accent: "#0F766E",
    className: "border-edsync-emerald/30 bg-edsync-emerald/10",
  },
];

export const PRACTICE_GAME_STYLE_PRESETS: CreatorLibraryItem[] = [
  { id: "classic-quiz", label: "Classic Quiz", description: "Clear choices, explanation, and points.", tags: ["quiz", "points"] },
  { id: "speed-sprint", label: "Speed Sprint", description: "Target time, streak, and speed meter.", tags: ["timer", "kahoot"] },
  { id: "matching-race", label: "Matching Race", description: "Pair terms quickly with accuracy feedback.", tags: ["matching", "game"] },
  { id: "mistake-retry", label: "Mistake Retry", description: "Retry missed items and save review cards.", tags: ["review", "mastery"] },
  { id: "scenario-challenge", label: "Scenario Challenge", description: "Apply concepts in realistic prompts.", tags: ["scenario", "practice"] },
];

export function noteDesignPresetById(id: unknown, fallback: NoteDesignPresetId = "clean") {
  return NOTE_DESIGN_PRESETS.find((preset) => preset.id === id) ?? NOTE_DESIGN_PRESETS.find((preset) => preset.id === fallback) ?? NOTE_DESIGN_PRESETS[0];
}
