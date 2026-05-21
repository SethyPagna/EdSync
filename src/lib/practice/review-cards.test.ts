import { describe, expect, it } from "vitest";
import { normalizePracticeReviewCardRow } from "@/lib/practice/review-cards";

describe("practice review cards", () => {
  it("normalizes stored metadata into review guidance fields", () => {
    const card = normalizePracticeReviewCardRow({
      id: "card-1",
      prompt: "What is indexing?",
      correct_answer: "Lookup structure",
      explanation: "Indexes speed up lookups.",
      mastery: "almost",
      next_review_at: null,
      created_at: "2026-05-21T00:00:00.000Z",
      source_type: "practice",
      source_id: "attempt-1",
      metadata: JSON.stringify({
        mode: "sprint",
        modeLabel: "Sprint",
        loop: ["timer", "streak", "quick retry"],
        nextAction: "Elapsed time, streak signal, points, and retry set.",
      }),
    });

    expect(card).toMatchObject({
      id: "card-1",
      mastery: "almost",
      mode: "sprint",
      mode_label: "Sprint",
      loop: ["timer", "streak", "quick retry"],
      next_action: expect.stringContaining("retry set"),
    });
  });

  it("falls back safely for legacy cards with sparse metadata", () => {
    const card = normalizePracticeReviewCardRow({
      id: "legacy",
      prompt: "Legacy prompt",
      mastery: "done",
      metadata: "{bad-json",
    });

    expect(card.mastery).toBe("again");
    expect(card.mode).toBeNull();
    expect(card.loop).toEqual([]);
    expect(card.next_action).toBeNull();
  });
});
