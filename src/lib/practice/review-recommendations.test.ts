import { describe, expect, it } from "vitest";
import { summarizePracticeReviewCards } from "@/lib/practice/review-recommendations";
import type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

const baseCard: PracticeReviewCardRow = {
  id: "card-1",
  prompt: "What is indexing?",
  correct_answer: "Lookup structure",
  explanation: "Indexes speed up lookup.",
  mastery: "again",
  next_review_at: null,
  created_at: "2026-05-21T00:00:00.000Z",
  source_type: "practice",
  source_id: "attempt-1",
  mode: "sprint",
  mode_label: "Sprint",
  loop: ["timer", "streak", "quick retry"],
  next_action: "Elapsed time, streak signal, points, and retry set.",
};

describe("practice review recommendations", () => {
  it("summarizes pending review cards into a practice action", () => {
    const recommendation = summarizePracticeReviewCards([
      baseCard,
      { ...baseCard, id: "card-2", mastery: "almost" },
    ]);

    expect(recommendation).toMatchObject({
      title: "Retry 2 missed items",
      label: "Sprint",
      href: "/practice?mode=sprint",
      count: 2,
      subtitle: expect.stringContaining("retry set"),
    });
  });

  it("ignores mastered cards and falls back for legacy metadata", () => {
    const recommendation = summarizePracticeReviewCards([
      { ...baseCard, mastery: "mastered" },
      {
        ...baseCard,
        id: "legacy",
        mastery: "almost",
        mode: null,
        mode_label: null,
        loop: [],
        next_action: null,
      },
    ]);

    expect(recommendation).toMatchObject({
      label: "Review",
      href: "/practice?mode=mistake_retry",
      subtitle: "Practice the items that need one more pass.",
    });
  });

  it("returns null when there is nothing to review", () => {
    expect(summarizePracticeReviewCards([{ ...baseCard, mastery: "mastered" }])).toBeNull();
  });
});
