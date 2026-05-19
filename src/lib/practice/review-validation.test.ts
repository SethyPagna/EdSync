import { describe, expect, it } from "vitest";
import {
  REVIEW_CARD_ID_MAX_LENGTH,
  normalizeReviewUpdate,
  validateNextReviewAt,
  validateReviewCardId,
  validateReviewMastery,
} from "@/lib/practice/review-validation";

describe("practice review validation", () => {
  it("normalizes a safe review update", () => {
    expect(
      normalizeReviewUpdate({
        id: " card-1 ",
        mastery: "almost",
        nextReviewAt: "2026-05-20T10:00:00.000Z",
      }),
    ).toEqual({
      id: "card-1",
      mastery: "almost",
      nextReviewAt: "2026-05-20T10:00:00.000Z",
    });
  });

  it("validates review card ids", () => {
    expect(() => validateReviewCardId("")).toThrow("required");
    expect(() => validateReviewCardId("bad id")).toThrow("short identifier");
    expect(() => validateReviewCardId("x".repeat(REVIEW_CARD_ID_MAX_LENGTH + 1))).toThrow("short identifier");
  });

  it("validates supported mastery states", () => {
    expect(validateReviewMastery(undefined)).toBe("again");
    expect(validateReviewMastery("mastered")).toBe("mastered");
    expect(() => validateReviewMastery("done")).toThrow("supported review mastery");
  });

  it("validates optional next review dates", () => {
    expect(validateNextReviewAt(null)).toBeNull();
    expect(validateNextReviewAt("")).toBeNull();
    expect(validateNextReviewAt("2026-05-20")).toBe("2026-05-20T00:00:00.000Z");
    expect(() => validateNextReviewAt("tomorrow-ish")).toThrow("valid date");
    expect(() => validateNextReviewAt("2200-01-01")).toThrow("supported range");
  });
});
