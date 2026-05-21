import { describe, expect, it } from "vitest";
import { summarizeTeacherPracticeReviews } from "@/lib/practice/teacher-review-signals";
import type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

const card: PracticeReviewCardRow = {
  id: "review-1",
  prompt: "Explain indexes",
  correct_answer: "Lookup structure",
  explanation: "Indexes help lookup.",
  mastery: "again",
  next_review_at: null,
  created_at: "2026-05-21T00:00:00.000Z",
  source_type: "practice",
  source_id: "attempt-1",
  mode: "sprint",
  mode_label: "Sprint",
  loop: ["timer", "streak", "quick retry"],
  next_action: "Retry missed items.",
};

describe("teacher practice review signals", () => {
  it("summarizes pending student review cards for teacher attention", () => {
    const signal = summarizeTeacherPracticeReviews([
      card,
      { ...card, id: "review-2", mastery: "almost" },
      { ...card, id: "review-3", mastery: "mastered" },
    ]);

    expect(signal).toMatchObject({
      pendingCount: 2,
      againCount: 1,
      almostCount: 1,
      topModeLabel: "Sprint",
      copy: "1 need another try in Sprint",
    });
  });

  it("returns a clear empty signal when review cards are mastered", () => {
    const signal = summarizeTeacherPracticeReviews([{ ...card, mastery: "mastered" }]);

    expect(signal).toMatchObject({
      pendingCount: 0,
      againCount: 0,
      almostCount: 0,
      topModeLabel: "Review",
      copy: "No pending practice reviews",
    });
  });
});
