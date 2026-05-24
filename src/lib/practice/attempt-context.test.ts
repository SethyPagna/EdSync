import { describe, expect, it } from "vitest";
import {
  buildPracticeAttemptContext,
  buildPracticeItemContext,
  buildPracticeReviewContext,
  getPracticeModeContext,
} from "@/lib/practice/attempt-context";
import type { PracticeAttemptSummary } from "@/types";

const sprintSummary: PracticeAttemptSummary = {
  mode: "sprint",
  totalItems: 3,
  correctItems: 1,
  missedItems: 2,
  pointsEarned: 1,
  pointsPossible: 3,
  percent: 33,
  elapsedSeconds: 120,
  targetSeconds: 300,
  reviewCardIds: ["item-2", "item-3"],
};

describe("practice attempt context", () => {
  it("maps practice modes to dashboard-ready guidance", () => {
    const context = getPracticeModeContext("sprint");

    expect(context.label).toBe("Sprint");
    expect(context.loop).toEqual(["timer", "streak", "quick retry"]);
    expect(context.output).toContain("retry");
  });

  it("maps legacy generated practice links to the materials mode", () => {
    const context = getPracticeModeContext("generated_from_studio");

    expect(context.mode).toBe("generated_from_materials");
    expect(context.label).toBe("Generated from materials");
  });

  it("builds attempt context with source and recommendation metadata", () => {
    const context = buildPracticeAttemptContext({
      mode: "sprint",
      sourceType: "studio",
      sourceId: "note-1",
      summary: sprintSummary,
    });

    expect(context.source).toEqual({ type: "studio", id: "note-1" });
    expect(context.reviewCardCount).toBe(2);
    expect(context.recommendation).toContain("Review missed sprint items");
  });

  it("keeps item and review metadata tied to the selected mode", () => {
    const item = {
      id: "item-2",
      prompt: "What is an index?",
      answer: "Lookup structure",
      response: "Table",
      explanation: "Indexes make lookup faster.",
    };

    expect(buildPracticeItemContext({ item, mode: "sprint", isCorrect: false })).toMatchObject({
      clientItemId: "item-2",
      mode: "sprint",
      isCorrect: false,
    });
    expect(buildPracticeReviewContext({ item, mode: "sprint" })).toMatchObject({
      clientItemId: "item-2",
      modeLabel: "Sprint",
      nextAction: expect.stringContaining("retry"),
    });
  });
});
