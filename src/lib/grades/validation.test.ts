import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GRADE_CATEGORY_NAME_MAX_LENGTH,
  GRADE_FEEDBACK_MAX_LENGTH,
  GRADE_SOURCE_TYPES,
  GRADE_STATUSES,
  GRADE_TITLE_MAX_LENGTH,
  isGradeSourceType,
  normalizeManualGradeInput,
  validateGradeCategoryWeight,
  validateGradePercent,
  validateGradeSourceType,
  validateGradeText,
} from "@/lib/grades/validation";
import { WORK_POINTS_MAX } from "@/lib/work/validation";

function checkList(sql: string, column: string) {
  const match = sql.match(new RegExp(`${column} TEXT[^,]*CHECK \\(${column} IN \\(([^)]*)\\)\\)`));
  if (!match) throw new Error(`No CHECK constraint for ${column}.`);
  return match[1].split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

describe("grade validation", () => {
  it("normalizes manual grade input", () => {
    expect(
      normalizeManualGradeInput({
        title: "  Unit quiz ",
        sourceType: "manual",
        pointsEarned: 120,
        pointsPossible: 100,
        feedback: "  Strong retry. ",
      }),
    ).toEqual({
      title: "Unit quiz",
      sourceType: "manual",
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
    expect(() => validateGradeSourceType("manual grade")).toThrow("Grade source must be one of");
  });

  it("only accepts source types the database allows", () => {
    expect(validateGradeSourceType(undefined)).toBe("manual");
    expect(validateGradeSourceType(" task ")).toBe("task");
    expect(() => validateGradeSourceType("manual.override")).toThrow("Grade source must be one of");
    expect(() => validateGradeSourceType("homework")).toThrow("Grade source must be one of");
    expect(isGradeSourceType("lesson_quiz")).toBe(true);
    expect(isGradeSourceType("learning_work_item")).toBe(false);
  });

  it("matches the gradebook_scores CHECK constraints", () => {
    const sql = readFileSync(join(process.cwd(), "infra/database/migrations/0005_portal_expansion.sql"), "utf8");
    const table = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS gradebook_scores"));
    expect(checkList(table, "source_type")).toEqual([...GRADE_SOURCE_TYPES]);
    expect(checkList(table, "status")).toEqual([...GRADE_STATUSES]);
  });

  it("bounds score and point values", () => {
    expect(validateGradePercent(-1)).toBe(0);
    expect(validateGradePercent(105)).toBe(100);
    expect(() => validateGradePercent("great")).toThrow("valid number");
    expect(() => validateGradePercent(null)).toThrow("valid number");
    expect(normalizeManualGradeInput({ title: "Big score", pointsEarned: WORK_POINTS_MAX + 20, pointsPossible: WORK_POINTS_MAX }).pointsEarned).toBe(
      WORK_POINTS_MAX,
    );
  });
});
