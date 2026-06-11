import { describe, expect, it } from "vitest";
import {
  buildAiSlideInteractionTemplate,
  linesForAiSlide,
  markerForAiSlideInteraction,
  normalizeAiSlideNavigation,
  resolveAiSlideInteraction,
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
    expect(resolveAiSlideDesign({ ...baseSlide, type: "title" })).toMatchObject({ variant: "hero", templateId: "title-hero" });
    expect(resolveAiSlideDesign({ ...baseSlide, type: "objectives" })).toMatchObject({ variant: "cards", templateId: "objective-cards" });
    expect(resolveAiSlideDesign({ ...baseSlide, type: "socratic" })).toMatchObject({ variant: "question", templateId: "socratic-question" });
    expect(resolveAiSlideDesign({ ...baseSlide, type: "assessment" })).toMatchObject({ variant: "ticket", templateId: "quiz-ticket" });
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

  it("infers EdSync learning interactions from slide text, notes, and visual suggestions", () => {
    expect(resolveAiSlideInteraction({
      ...baseSlide,
      type: "assessment",
      onScreenText: ["Fill-in-the-blank: A valid proof needs ___."],
    })).toBe("fill_blank");
    expect(resolveAiSlideInteraction({
      ...baseSlide,
      type: "activity",
      speakerNotes: "Run this as a discussion with roles and evidence prompts.",
    })).toBe("discussion");
    expect(resolveAiSlideInteraction({
      ...baseSlide,
      type: "activity",
      visualSuggestion: "Use a matching activity layout.",
    })).toBe("matching");
    expect(resolveAiSlideInteraction({
      ...baseSlide,
      type: "assessment",
      onScreenText: ["Multiple choice quiz: choose the strongest evidence."],
    })).toBe("quiz");
  });

  it("adds interaction labels to activity and assessment designs", () => {
    expect(resolveAiSlideDesign({
      ...baseSlide,
      type: "assessment",
      onScreenText: ["Fill in the blank: The missing term is ___."],
    })).toMatchObject({
      interaction: "fill_blank",
      actionLabel: "Fill",
      visual: "ticket",
      templateId: "fill-blank-ticket",
      templateName: "Fill-in ticket",
    });
    expect(resolveAiSlideDesign({
      ...baseSlide,
      type: "activity",
      onScreenText: ["Discussion: compare two solutions."],
    })).toMatchObject({
      interaction: "discussion",
      actionLabel: "Discuss",
      visual: "activity",
      templateId: "discussion-board",
      templateName: "Discussion board",
    });
  });

  it("maps interaction-specific lessons to named render templates and preview markers", () => {
    expect(resolveAiSlideDesign({
      ...baseSlide,
      type: "activity",
      visualSuggestion: "Use a matching activity layout.",
    })).toMatchObject({ interaction: "matching", templateId: "matching-pairs" });
    expect(resolveAiSlideDesign({
      ...baseSlide,
      type: "activity",
      onScreenText: ["Poll: which evidence source should we trust first?"],
    })).toMatchObject({ interaction: "poll", templateId: "poll-check" });
    expect(markerForAiSlideInteraction("fill_blank", 0)).toBe("___");
    expect(markerForAiSlideInteraction("quiz", 0)).toBe("?");
    expect(markerForAiSlideInteraction("matching", 0)).toBe("=");
    expect(markerForAiSlideInteraction("discussion", 0)).toBe("D");
    expect(markerForAiSlideInteraction("poll", 0)).toBe("%");
    expect(markerForAiSlideInteraction("reflection", 0)).toBe("R");
    expect(markerForAiSlideInteraction("practice", 2)).toBe("3");
  });

  it("builds structured interaction templates from slide-ready AI text", () => {
    expect(buildAiSlideInteractionTemplate({
      ...baseSlide,
      type: "activity",
      title: "Partner Discussion",
      onScreenText: [
        "Discussion: Compare the two strongest solutions.",
        "Use one evidence card.",
        "Name one risk.",
      ],
      speakerNotes: "Expected response: learners cite evidence before making a claim. Then compare groups.",
    })).toMatchObject({
      kind: "discussion",
      label: "Discuss",
      primaryPrompt: "Compare the two strongest solutions.",
      items: ["Use one evidence card.", "Name one risk."],
      teacherHint: "Expected response: learners cite evidence before making a claim.",
    });

    expect(buildAiSlideInteractionTemplate({
      ...baseSlide,
      type: "assessment",
      title: "Exit Ticket",
      onScreenText: [
        "Fill-in-the-blank: A strong claim needs ___.",
        "Short answer: Name one evidence source.",
      ],
      speakerNotes: "Answer key: evidence; acceptable sources include observations or submitted work.",
      visualSuggestion: "Use a compact fill-in-the-blank quiz card.",
    })).toMatchObject({
      kind: "fill_blank",
      label: "Fill",
      primaryPrompt: "A strong claim needs ___.",
      items: ["Short answer: Name one evidence source."],
      teacherHint: "Answer key: evidence; acceptable sources include observations or submitted work.",
    });
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
