import { describe, expect, it } from "vitest";
import {
  createReviewCards,
  missedPracticeItems,
  summarizePracticeAttempt,
  targetSecondsFromMinutes,
} from "@/lib/practice/engine";

describe("practice engine", () => {
  it("summarizes points, misses, and percent", () => {
    const summary = summarizePracticeAttempt({
      mode: "quiz",
      elapsedSeconds: 95,
      targetSeconds: 300,
      items: [
        { id: "one", prompt: "2 + 2", answer: "4", response: "4", points: 2 },
        { id: "two", prompt: "Sky color", answer: "blue", response: "green", points: 3 },
      ],
    });

    expect(summary.correctItems).toBe(1);
    expect(summary.missedItems).toBe(1);
    expect(summary.pointsEarned).toBe(2);
    expect(summary.pointsPossible).toBe(5);
    expect(summary.percent).toBe(40);
    expect(summary.reviewCardIds).toEqual(["two"]);
  });

  it("creates review cards only for missed items", () => {
    const items = [
      { id: "one", prompt: "Term", answer: "definition", response: "definition" },
      { id: "two", prompt: "Concept", answer: "example", response: "wrong", explanation: "Use the model example." },
    ];

    expect(missedPracticeItems(items)).toHaveLength(1);
    expect(createReviewCards(items, "practice-1")).toMatchObject([
      {
        id: "two",
        sourceType: "practice",
        sourceId: "practice-1",
        explanation: "Use the model example.",
        mastery: "again",
      },
    ]);
  });

  it("enforces a minimum one-minute target", () => {
    expect(targetSecondsFromMinutes(0.1)).toBe(60);
    expect(targetSecondsFromMinutes(5)).toBe(300);
  });
});
