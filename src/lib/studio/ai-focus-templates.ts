export type AiLessonFocus =
  | "flow"
  | "quiz"
  | "discussion"
  | "slides"
  | "activity"
  | "fill_blank"
  | "matching"
  | "poll"
  | "reflection";

export type AiFocusTemplateOption = {
  id: AiLessonFocus;
  label: string;
  detail: string;
  promptCue: string;
  templateName: string;
};

export const AI_FOCUS_OPTIONS = [
  {
    id: "flow",
    label: "Flow",
    detail: "warmup, concept, practice loop, proof check",
    promptCue: "Lesson flow:",
    templateName: "Learning sequence",
  },
  {
    id: "quiz",
    label: "Quiz",
    detail: "game-style checks, feedback, review cards",
    promptCue: "Quiz:",
    templateName: "Quiz ticket",
  },
  {
    id: "discussion",
    label: "Discuss",
    detail: "prompts, roles, rubrics, participation checks",
    promptCue: "Discussion:",
    templateName: "Discussion board",
  },
  {
    id: "slides",
    label: "PPT",
    detail: "visual slide structure and speaker notes",
    promptCue: "Slide deck:",
    templateName: "Presentation deck",
  },
  {
    id: "activity",
    label: "Activity",
    detail: "interactive tasks, Kahoot-style rounds, reflection",
    promptCue: "Practice activity:",
    templateName: "Practice workshop",
  },
  {
    id: "fill_blank",
    label: "Fill blanks",
    detail: "fill-in-the-blank checks with answer keys",
    promptCue: "Fill-in-the-blank:",
    templateName: "Fill-in ticket",
  },
  {
    id: "matching",
    label: "Match",
    detail: "matching pairs, sorting, and classification prompts",
    promptCue: "Matching:",
    templateName: "Matching pairs",
  },
  {
    id: "poll",
    label: "Poll",
    detail: "quick votes, confidence checks, and compare responses",
    promptCue: "Poll:",
    templateName: "Poll check",
  },
  {
    id: "reflection",
    label: "Reflect",
    detail: "learner reflection, proof of progress, next steps",
    promptCue: "Reflection:",
    templateName: "Reflection card",
  },
] satisfies AiFocusTemplateOption[];

export function selectedAiFocusOptions(focuses: AiLessonFocus[]) {
  const selected = new Set(focuses);
  return AI_FOCUS_OPTIONS.filter((option) => selected.has(option.id));
}

export function buildAiFocusTemplateCueSummary(focuses: AiLessonFocus[]) {
  const options = selectedAiFocusOptions(focuses);
  const templateNames = options.map((option) => option.templateName);
  const promptCues = options.map((option) => option.promptCue);
  const details = options.map((option) => `${option.label}: ${option.detail}`);

  return {
    options,
    labels: options.map((option) => option.label),
    templateNames,
    promptCues,
    details,
    outputSummary: options.length > 0 ? details.join("; ") : "Flow: complete lesson sequence",
    promptCueSummary: promptCues.length > 0 ? promptCues.join(", ") : "Lesson flow:",
    templateSummary: templateNames.length > 0 ? templateNames.join(", ") : "Learning sequence",
  };
}
