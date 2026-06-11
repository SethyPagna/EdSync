import { describe, expect, it } from "vitest";
import {
  AI_FOCUS_OPTIONS,
  buildAiFocusTemplateCueSummary,
  selectedAiFocusOptions,
  type AiLessonFocus,
} from "./ai-focus-templates";

describe("AI focus template helpers", () => {
  it("defines Studio template-ready cues for every AI focus option", () => {
    expect(AI_FOCUS_OPTIONS).toHaveLength(9);
    expect(AI_FOCUS_OPTIONS.map((option) => option.id)).toEqual([
      "flow",
      "quiz",
      "discussion",
      "slides",
      "activity",
      "fill_blank",
      "matching",
      "poll",
      "reflection",
    ]);
    expect(AI_FOCUS_OPTIONS.every((option) => option.promptCue.endsWith(":"))).toBe(true);
    expect(AI_FOCUS_OPTIONS.every((option) => option.templateName.length > 0)).toBe(true);
  });

  it("keeps selected focus order stable according to the UI option order", () => {
    const selected: AiLessonFocus[] = ["matching", "flow", "quiz"];

    expect(selectedAiFocusOptions(selected).map((option) => option.id)).toEqual(["flow", "quiz", "matching"]);
  });

  it("builds a prompt summary that connects output choices to render templates", () => {
    const summary = buildAiFocusTemplateCueSummary(["discussion", "fill_blank", "poll"]);

    expect(summary.labels).toEqual(["Discuss", "Fill blanks", "Poll"]);
    expect(summary.promptCueSummary).toBe("Discussion:, Fill-in-the-blank:, Poll:");
    expect(summary.templateSummary).toBe("Discussion board, Fill-in ticket, Poll check");
    expect(summary.outputSummary).toContain("Discuss: prompts");
    expect(summary.outputSummary).toContain("Fill blanks: fill-in-the-blank");
  });

  it("falls back to a complete lesson flow when no focus is selected", () => {
    const summary = buildAiFocusTemplateCueSummary([]);

    expect(summary.outputSummary).toBe("Flow: complete lesson sequence");
    expect(summary.promptCueSummary).toBe("Lesson flow:");
    expect(summary.templateSummary).toBe("Learning sequence");
  });
});
