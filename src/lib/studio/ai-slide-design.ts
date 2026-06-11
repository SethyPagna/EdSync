export type AiSlideType =
  | "title"
  | "objectives"
  | "content"
  | "example"
  | "socratic"
  | "activity"
  | "summary"
  | "assessment";

export type AiSlideNavigation = {
  previous: string | null;
  next: string | null;
};

export type AiSlideMetadata = {
  slideNumber: number;
  title: string;
  type: AiSlideType;
  onScreenText: string[];
  speakerNotes: string;
  visualSuggestion: string;
  navigation: AiSlideNavigation;
};

export type AiSlideInteraction =
  | "discussion"
  | "quiz"
  | "fill_blank"
  | "matching"
  | "reflection"
  | "practice"
  | "poll"
  | "none";

export type AiSlideTemplateId =
  | "title-hero"
  | "objective-cards"
  | "concept-split"
  | "example-steps"
  | "socratic-question"
  | "discussion-board"
  | "practice-workshop"
  | "matching-pairs"
  | "poll-check"
  | "reflection-card"
  | "fill-blank-ticket"
  | "quiz-ticket"
  | "summary-recap";

export type AiSlideDesign = {
  templateId: AiSlideTemplateId;
  templateName: string;
  variant: "hero" | "cards" | "split" | "steps" | "question" | "workshop" | "recap" | "ticket";
  accent: string;
  secondaryAccent: string;
  background: string;
  foreground: string;
  muted: string;
  titleSize: "large" | "medium";
  visual: "badge" | "cards" | "diagram" | "steps" | "question" | "activity" | "checklist" | "ticket";
  interaction: AiSlideInteraction;
  actionLabel: string;
};

export type AiSlideInteractionTemplate = {
  kind: AiSlideInteraction;
  label: string;
  primaryPrompt: string;
  items: string[];
  teacherHint: string;
};

type AiSlideBaseDesign = Omit<AiSlideDesign, "templateId" | "templateName" | "titleSize" | "interaction" | "actionLabel">;

const TYPE_DESIGNS: Record<AiSlideType, AiSlideBaseDesign> = {
  title: {
    variant: "hero",
    accent: "#2458dc",
    secondaryAccent: "#0f9f82",
    background: "#f7fbff",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "badge",
  },
  objectives: {
    variant: "cards",
    accent: "#0f9f82",
    secondaryAccent: "#2458dc",
    background: "#f6fffb",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "cards",
  },
  content: {
    variant: "split",
    accent: "#2458dc",
    secondaryAccent: "#6d5dfc",
    background: "#f7fbff",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "diagram",
  },
  example: {
    variant: "steps",
    accent: "#0f9f82",
    secondaryAccent: "#2458dc",
    background: "#f8fbf9",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "steps",
  },
  socratic: {
    variant: "question",
    accent: "#6d5dfc",
    secondaryAccent: "#2458dc",
    background: "#fbf9ff",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "question",
  },
  activity: {
    variant: "workshop",
    accent: "#f59e0b",
    secondaryAccent: "#0f9f82",
    background: "#fffaf0",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "activity",
  },
  summary: {
    variant: "recap",
    accent: "#0f9f82",
    secondaryAccent: "#6d5dfc",
    background: "#f6fffb",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "checklist",
  },
  assessment: {
    variant: "ticket",
    accent: "#2458dc",
    secondaryAccent: "#f59e0b",
    background: "#f7fbff",
    foreground: "#0d1726",
    muted: "#526173",
    visual: "ticket",
  },
};

function searchableSlideText(slide: Pick<AiSlideMetadata, "title" | "visualSuggestion"> & Partial<Pick<AiSlideMetadata, "onScreenText" | "speakerNotes">>) {
  return [
    slide.title,
    slide.visualSuggestion,
    ...(slide.onScreenText ?? []),
    slide.speakerNotes ?? "",
  ].join(" ").toLowerCase();
}

export function resolveAiSlideInteraction(
  slide: Pick<AiSlideMetadata, "type" | "title" | "visualSuggestion"> & Partial<Pick<AiSlideMetadata, "onScreenText" | "speakerNotes">>,
): AiSlideInteraction {
  const text = searchableSlideText(slide);
  if (text.includes("fill in") || text.includes("fill-in") || text.includes("blank")) return "fill_blank";
  if (text.includes("multiple choice") || text.includes("quiz") || text.includes("test") || text.includes("exit ticket")) return "quiz";
  if (text.includes("match") || text.includes("matching") || text.includes("sort")) return "matching";
  if (text.includes("discuss") || text.includes("discussion") || text.includes("debate")) return "discussion";
  if (text.includes("poll") || text.includes("vote")) return "poll";
  if (text.includes("reflect") || text.includes("reflection")) return "reflection";
  if (text.includes("practice") || text.includes("activity") || text.includes("task")) return "practice";
  return slide.type === "activity" ? "practice" : slide.type === "assessment" ? "quiz" : "none";
}

function actionLabelForInteraction(interaction: AiSlideInteraction) {
  switch (interaction) {
    case "discussion":
      return "Discuss";
    case "quiz":
      return "Check";
    case "fill_blank":
      return "Fill";
    case "matching":
      return "Match";
    case "reflection":
      return "Reflect";
    case "practice":
      return "Practice";
    case "poll":
      return "Vote";
    case "none":
      return "Learn";
  }
}

type AiSlideTemplateRecipe = Pick<AiSlideDesign, "templateId" | "templateName" | "variant" | "visual">;

const TYPE_TEMPLATE_RECIPES: Record<AiSlideType, AiSlideTemplateRecipe> = {
  title: {
    templateId: "title-hero",
    templateName: "Title hero",
    variant: "hero",
    visual: "badge",
  },
  objectives: {
    templateId: "objective-cards",
    templateName: "Objective cards",
    variant: "cards",
    visual: "cards",
  },
  content: {
    templateId: "concept-split",
    templateName: "Concept split",
    variant: "split",
    visual: "diagram",
  },
  example: {
    templateId: "example-steps",
    templateName: "Example steps",
    variant: "steps",
    visual: "steps",
  },
  socratic: {
    templateId: "socratic-question",
    templateName: "Socratic question",
    variant: "question",
    visual: "question",
  },
  activity: {
    templateId: "practice-workshop",
    templateName: "Practice workshop",
    variant: "workshop",
    visual: "activity",
  },
  summary: {
    templateId: "summary-recap",
    templateName: "Summary recap",
    variant: "recap",
    visual: "checklist",
  },
  assessment: {
    templateId: "quiz-ticket",
    templateName: "Quiz ticket",
    variant: "ticket",
    visual: "ticket",
  },
};

const INTERACTION_TEMPLATE_RECIPES: Partial<Record<AiSlideInteraction, AiSlideTemplateRecipe>> = {
  discussion: {
    templateId: "discussion-board",
    templateName: "Discussion board",
    variant: "workshop",
    visual: "activity",
  },
  fill_blank: {
    templateId: "fill-blank-ticket",
    templateName: "Fill-in ticket",
    variant: "ticket",
    visual: "ticket",
  },
  matching: {
    templateId: "matching-pairs",
    templateName: "Matching pairs",
    variant: "workshop",
    visual: "activity",
  },
  poll: {
    templateId: "poll-check",
    templateName: "Poll check",
    variant: "workshop",
    visual: "activity",
  },
  reflection: {
    templateId: "reflection-card",
    templateName: "Reflection card",
    variant: "workshop",
    visual: "activity",
  },
  quiz: {
    templateId: "quiz-ticket",
    templateName: "Quiz ticket",
    variant: "ticket",
    visual: "ticket",
  },
};

function firstUsefulSentence(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find(Boolean) ?? "";
}

function recipeForSlide(
  slide: Pick<AiSlideMetadata, "type">,
  interaction: AiSlideInteraction,
  visual: AiSlideDesign["visual"],
): AiSlideTemplateRecipe {
  const interactionRecipe = INTERACTION_TEMPLATE_RECIPES[interaction];
  const typeRecipe = TYPE_TEMPLATE_RECIPES[slide.type] ?? TYPE_TEMPLATE_RECIPES.content;
  const recipe = interactionRecipe ?? typeRecipe;
  return {
    ...recipe,
    visual,
  };
}

export function markerForAiSlideInteraction(interaction: AiSlideInteraction, index: number): string {
  switch (interaction) {
    case "fill_blank":
      return "___";
    case "quiz":
      return "?";
    case "matching":
      return "=";
    case "discussion":
      return "D";
    case "poll":
      return "%";
    case "reflection":
      return "R";
    case "practice":
    case "none":
      return String(index + 1);
  }
}

export function resolveAiSlideDesign(
  slide: Pick<AiSlideMetadata, "type" | "title" | "visualSuggestion"> & Partial<Pick<AiSlideMetadata, "onScreenText" | "speakerNotes">>,
): AiSlideDesign {
  const base = TYPE_DESIGNS[slide.type] ?? TYPE_DESIGNS.content;
  const searchText = searchableSlideText(slide);
  const interaction = resolveAiSlideInteraction(slide);
  const visual = searchText.includes("step") || searchText.includes("flow")
    ? "steps"
    : searchText.includes("question") || searchText.includes("socratic")
      ? "question"
      : interaction === "fill_blank" || interaction === "quiz" || searchText.includes("check") || searchText.includes("ticket")
        ? "ticket"
        : interaction === "matching" || interaction === "discussion"
          ? "activity"
        : base.visual;
  const recipe = recipeForSlide(slide, interaction, visual);

  return {
    ...base,
    ...recipe,
    titleSize: slide.type === "title" || slide.title.length < 34 ? "large" : "medium",
    interaction,
    actionLabel: actionLabelForInteraction(interaction),
  };
}

export function normalizeAiSlideNavigation(slides: AiSlideMetadata[]): AiSlideMetadata[] {
  return slides.map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
    navigation: {
      previous: index === 0 ? null : slides[index - 1].title,
      next: index === slides.length - 1 ? null : slides[index + 1].title,
    },
  }));
}

export function linesForAiSlide(slide: Pick<AiSlideMetadata, "title" | "onScreenText" | "visualSuggestion">): string[] {
  const normalizedTitle = slide.title.trim().toLowerCase();
  const lines = slide.onScreenText
    .map((line) => line.replace(/\*\*/g, "").trim())
    .filter((line) => line && line.toLowerCase() !== normalizedTitle);
  return lines.length > 0 ? lines : [slide.visualSuggestion || "Review and edit this generated slide."];
}

export function buildAiSlideInteractionTemplate(slide: AiSlideMetadata): AiSlideInteractionTemplate {
  const kind = resolveAiSlideInteraction(slide);
  const label = actionLabelForInteraction(kind);
  const lines = linesForAiSlide(slide);
  const usefulLines = lines.map((line) => line.replace(/^(discussion|practice activity|activity|quiz|test|quick check|fill-in-the-blank|matching|poll|reflection)\s*:\s*/i, "").trim());
  const primaryPrompt = usefulLines[0] || slide.title;
  const items = usefulLines.slice(1, 5);
  const teacherHint = firstUsefulSentence(slide.speakerNotes) || slide.visualSuggestion;

  return {
    kind,
    label,
    primaryPrompt,
    items: items.length > 0 ? items : [slide.visualSuggestion],
    teacherHint,
  };
}
