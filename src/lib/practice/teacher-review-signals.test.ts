import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTeacherPracticeReviewSignal,
  summarizeTeacherPracticeReviews,
} from "@/lib/practice/teacher-review-signals";
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

const originalFetch = global.fetch;

describe("teacher practice review signals", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

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

  it("loads the server-scoped teacher review signal", async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            pendingCount: 3,
            againCount: 2,
            almostCount: 1,
            topModeLabel: "Sprint",
            copy: "2 need another try in Sprint",
          },
        }),
      )) as typeof fetch;

    await expect(fetchTeacherPracticeReviewSignal()).resolves.toMatchObject({
      pendingCount: 3,
      topModeLabel: "Sprint",
    });
  });

  it("falls back to an empty signal when the scoped endpoint fails", async () => {
    global.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;

    await expect(fetchTeacherPracticeReviewSignal()).resolves.toMatchObject({
      pendingCount: 0,
      copy: "No pending practice reviews",
    });
  });
});
