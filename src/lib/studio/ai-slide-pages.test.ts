import { describe, expect, it } from "vitest";
import { buildAiSlideStudioPages } from "./ai-slide-pages";
import type { AiSlideMetadata } from "./ai-slide-design";

const slides: AiSlideMetadata[] = [
  {
    slideNumber: 4,
    title: "Course Launch",
    type: "title",
    onScreenText: ["Course Launch", "A practical slide lesson.", "Estimated time: 45 minutes."],
    speakerNotes: "Open with the learner goal.",
    visualSuggestion: "Use a hero badge.",
    navigation: { previous: "wrong", next: "wrong" },
  },
  {
    slideNumber: 2,
    title: "Socratic: Evidence",
    type: "socratic",
    onScreenText: ["**What would prove progress?**", "Which signal can we observe?"],
    speakerNotes: "Expected response: a visible before/after comparison.",
    visualSuggestion: "Use a question bubble.",
    navigation: { previous: null, next: null },
  },
];

describe("AI slide studio page conversion", () => {
  it("builds editable studio pages with cleaned seed text and preserved AI metadata", () => {
    let id = 0;
    const pages = buildAiSlideStudioPages(slides, () => `page-${++id}`);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      id: "page-1",
      name: "Course Launch",
      seed: {
        title: "Course Launch",
        body: "A practical slide lesson.\nEstimated time: 45 minutes.",
        accent: "#2458dc",
      },
      snapshot: null,
    });
    expect(pages[1].seed.body).toBe("What would prove progress?\nWhich signal can we observe?");
    expect(pages[1].aiSlide.speakerNotes).toContain("Expected response");
    expect(pages[1].aiSlide.visualSuggestion).toBe("Use a question bubble.");
  });

  it("repairs linear navigation according to the rendered page order", () => {
    const pages = buildAiSlideStudioPages(slides, () => "page");

    expect(pages[0].aiSlide.navigation).toEqual({ previous: null, next: "Socratic: Evidence" });
    expect(pages[1].aiSlide.navigation).toEqual({ previous: "Course Launch", next: null });
    expect(pages.map((page) => page.aiSlide.slideNumber)).toEqual([1, 2]);
  });

  it("keeps fill-in-the-blank assessment text ready for the assessment template", () => {
    const [page] = buildAiSlideStudioPages([
      {
        slideNumber: 1,
        title: "Exit Ticket",
        type: "assessment",
        onScreenText: [
          "Fill-in-the-blank: A strong claim needs ___.",
          "Short answer: Name one evidence source.",
        ],
        speakerNotes: "Answer key: evidence; acceptable sources include observations or submitted work.",
        visualSuggestion: "Use a compact fill-in-the-blank quiz card.",
        navigation: { previous: null, next: null },
      },
    ], () => "assessment-page");

    expect(page.seed.body).toContain("Fill-in-the-blank");
    expect(page.seed.accent).toBe("#2458dc");
    expect(page.aiSlide.speakerNotes).toContain("Answer key");
  });

  it("keeps discussion activity text ready for interaction template rendering", () => {
    const [page] = buildAiSlideStudioPages([
      {
        slideNumber: 1,
        title: "Team Discussion",
        type: "activity",
        onScreenText: [
          "Discussion: Compare two solution paths.",
          "Choose one evidence card.",
          "Name one assumption.",
        ],
        speakerNotes: "Expected response: learners justify the stronger path with evidence.",
        visualSuggestion: "Use a discussion card with role chips.",
        navigation: { previous: null, next: null },
      },
    ], () => "discussion-page");

    expect(page.seed.body).toContain("Discussion");
    expect(page.aiSlide.onScreenText).toContain("Discussion: Compare two solution paths.");
    expect(page.aiSlide.visualSuggestion).toContain("discussion card");
  });
});
