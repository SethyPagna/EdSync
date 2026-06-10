import {
  linesForAiSlide,
  normalizeAiSlideNavigation,
  resolveAiSlideDesign,
  type AiSlideMetadata,
} from "./ai-slide-design";

export type AiStudioPageDraft = {
  id: string;
  name: string;
  seed: {
    title: string;
    body: string;
    accent: string;
  };
  snapshot: null;
  aiSlide: AiSlideMetadata;
};

function cleanSlideText(line: string) {
  return line.replace(/\*\*(.*?)\*\*/g, "$1").trim();
}

export function buildAiSlideStudioPages(
  slides: AiSlideMetadata[],
  createId: () => string = () => crypto.randomUUID(),
): AiStudioPageDraft[] {
  const validSlides = normalizeAiSlideNavigation(slides.filter((slide) => slide.title.trim() && slide.onScreenText.length > 0));

  return validSlides.map((slide) => {
    const bodyLines = linesForAiSlide(slide).map(cleanSlideText).filter(Boolean);
    const design = resolveAiSlideDesign(slide);
    return {
      id: createId(),
      name: slide.title,
      seed: {
        title: slide.title,
        body: bodyLines.join("\n") || slide.visualSuggestion || "Review and edit this generated slide.",
        accent: design.accent,
      },
      snapshot: null,
      aiSlide: {
        ...slide,
        onScreenText: slide.onScreenText.map(cleanSlideText).filter(Boolean),
      },
    };
  });
}
