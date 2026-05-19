import { describe, expect, it } from "vitest";
import {
  GRADE_CATEGORY_NAME_MAX_LENGTH,
  GRADE_FEEDBACK_MAX_LENGTH,
  GRADE_TITLE_MAX_LENGTH,
  normalizeManualGradeInput,
  validateGradeCategoryWeight,
  validateGradePercent,
  validateGradeSourceType,
  validateGradeText,
} from "@/lib/grades/validation";
import { WORK_POINTS_MAX } from "@/lib/work/validation";

describe("grade validation", () => {
  it("normalizes manual grade input", () => {
    expect(
      normalizeManualGradeInput({
        title: "  Unit quiz ",
        sourceType: "manual.override",
        pointsEarned: 120,
        pointsPossible: 100,
        feedback: "  Strong retry. ",
      }),
    ).toEqual({
      title: "Unit quiz",
      sourceType: "manual.override",
      pointsEarned: 100,
      pointsPossible: 100,
      feedback: "Strong retry.",
    });
  });

  it("validates category names and weights", () => {
    expect(validateGradeText("  Tests ", "Category name", GRADE_CATEGORY_NAME_MAX_LENGTH)).toBe("Tests");
    expect(validateGradeCategoryWeight(-3)).toBe(0);
    expect(validateGradeCategoryWeight(125)).toBe(100);
    expect(() => validateGradeCategoryWeight("heavy")).toThrow("valid number");
  });

  it("rejects unsafe or oversized grade fields", () => {
    expect(() => validateGradeText("", "Score title", GRADE_TITLE_MAX_LENGTH)).toThrow("required");
    expect(() => validateGradeText("x".repeat(GRADE_TITLE_MAX_LENGTH + 1), "Score title", GRADE_TITLE_MAX_LENGTH)).toThrow("characters");
    expect(() => validateGradeText("x".repeat(GRADE_FEEDBACK_MAX_LENGTH + 1), "Feedback", GRADE_FEEDBACK_MAX_LENGTH, false)).toThrow(
      "characters",
    );
    expect(() => validateGradeSourceType("manual grade")).toThrow("short identifier");
  });

  it("bounds score and point values", () => {
    expect(validateGradePercent(-1)).toBe(0);
    expect(validateGradePercent(105)).toBe(100);
    expect(() => validateGradePercent("great")).toThrow("valid number");
    expect(normalizeManualGradeInput({ title: "Big score", pointsEarned: WORK_POINTS_MAX + 20, pointsPossible: WORK_POINTS_MAX }).pointsEarned).toBe(
      WORK_POINTS_MAX,
    );
  });
});
