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

export type AiSlideDesign = {
  variant: "hero" | "cards" | "split" | "steps" | "question" | "workshop" | "recap" | "ticket";
  accent: string;
  secondaryAccent: string;
  background: string;
  foreground: string;
  muted: string;
  titleSize: "large" | "medium";
  visual: "badge" | "cards" | "diagram" | "steps" | "question" | "activity" | "checklist" | "ticket";
};

const TYPE_DESIGNS: Record<AiSlideType, Omit<AiSlideDesign, "titleSize">> = {
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

export function resolveAiSlideDesign(slide: Pick<AiSlideMetadata, "type" | "title" | "visualSuggestion">): AiSlideDesign {
  const base = TYPE_DESIGNS[slide.type] ?? TYPE_DESIGNS.content;
  const visualSuggestion = slide.visualSuggestion.toLowerCase();
  const visual = visualSuggestion.includes("step") || visualSuggestion.includes("flow")
    ? "steps"
    : visualSuggestion.includes("question") || visualSuggestion.includes("socratic")
      ? "question"
      : visualSuggestion.includes("check") || visualSuggestion.includes("ticket")
        ? "ticket"
        : base.visual;

  return {
    ...base,
    visual,
    titleSize: slide.type === "title" || slide.title.length < 34 ? "large" : "medium",
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
