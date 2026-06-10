import { describe, expect, it } from "vitest";
import {
  linesForAiSlide,
  normalizeAiSlideNavigation,
  resolveAiSlideDesign,
  type AiSlideMetadata,
} from "./ai-slide-design";

const baseSlide: AiSlideMetadata = {
  slideNumber: 1,
  title: "Evidence of Learning",
  type: "content",
  onScreenText: ["Evidence of Learning", "Use proof cards.", "Compare before and after work."],
  speakerNotes: "Ask learners to name one observable signal.",
  visualSuggestion: "Use a simple diagram with proof cards.",
  navigation: { previous: null, next: null },
};

describe("AI slide design helpers", () => {
  it("selects a distinct visual recipe by slide type", () => {
    expect(resolveAiSlideDesign({ ...baseSlide, type: "title" }).variant).toBe("hero");
    expect(resolveAiSlideDesign({ ...baseSlide, type: "objectives" }).variant).toBe("cards");
    expect(resolveAiSlideDesign({ ...baseSlide, type: "socratic" }).variant).toBe("question");
    expect(resolveAiSlideDesign({ ...baseSlide, type: "assessment" }).variant).toBe("ticket");
  });

  it("lets concrete visual suggestions refine the visual motif without changing the schema", () => {
    const design = resolveAiSlideDesign({
      ...baseSlide,
      type: "content",
      visualSuggestion: "Use a three-step flow from prompt to evidence.",
    });

    expect(design.variant).toBe("split");
    expect(design.visual).toBe("steps");
  });

  it("repairs slide numbers and linear navigation from current order", () => {
    const slides = normalizeAiSlideNavigation([
      { ...baseSlide, slideNumber: 8, title: "Start" },
      { ...baseSlide, slideNumber: 2, title: "Middle" },
      { ...baseSlide, slideNumber: 1, title: "Finish" },
    ]);

    expect(slides.map((slide) => slide.slideNumber)).toEqual([1, 2, 3]);
    expect(slides[0].navigation).toEqual({ previous: null, next: "Middle" });
    expect(slides[1].navigation).toEqual({ previous: "Start", next: "Finish" });
    expect(slides[2].navigation).toEqual({ previous: "Middle", next: null });
  });

  it("removes duplicated title text and markdown emphasis from slide body lines", () => {
    expect(linesForAiSlide({
      ...baseSlide,
      title: "Socratic: Evidence",
      onScreenText: ["Socratic: Evidence", "**What would count as proof?**", "Which signal is observable?"],
    })).toEqual(["What would count as proof?", "Which signal is observable?"]);
  });
});
