import { validateEarnedWorkPoints, validateWorkPoints } from "@/lib/work/validation";

export const GRADE_CATEGORY_NAME_MAX_LENGTH = 80;
export const GRADE_TITLE_MAX_LENGTH = 160;
export const GRADE_FEEDBACK_MAX_LENGTH = 4_000;
export const GRADE_CATEGORY_WEIGHT_MAX = 100;

// Must match the gradebook_scores CHECK constraints in infra/database/migrations/0005_portal_expansion.sql.
export const GRADE_SOURCE_TYPES = ["lesson_quiz", "quiz", "test", "task", "discussion", "activity", "manual"] as const;
export const GRADE_STATUSES = ["draft", "submitted", "graded", "excused", "missing"] as const;

export type GradeSourceType = (typeof GRADE_SOURCE_TYPES)[number];
export type GradeStatus = (typeof GRADE_STATUSES)[number];

const GRADE_SOURCE_TYPE_SET: ReadonlySet<string> = new Set(GRADE_SOURCE_TYPES);

export type NormalizedManualGradeInput = {
  title: string;
  sourceType: GradeSourceType;
  pointsEarned: number;
  pointsPossible: number;
  feedback: string | null;
};

export function isGradeSourceType(value: unknown): value is GradeSourceType {
  return typeof value === "string" && GRADE_SOURCE_TYPE_SET.has(value);
}

export function validateGradeText(value: unknown, label: string, maxLength: number, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function validateGradeCategoryWeight(value: unknown) {
  const weight = Number(value ?? 1);
  if (!Number.isFinite(weight)) throw new Error("Category weight must be a valid number.");
  return Math.min(GRADE_CATEGORY_WEIGHT_MAX, Math.max(0, weight));
}

export function validateGradeSourceType(value: unknown): GradeSourceType {
  const sourceType = String(value ?? "").trim() || "manual";
  if (!isGradeSourceType(sourceType)) {
    throw new Error(`Grade source must be one of: ${GRADE_SOURCE_TYPES.join(", ")}.`);
  }
  return sourceType;
}

export function validateGradePercent(value: unknown) {
  const score = Number(value);
  if (value === null || value === "" || !Number.isFinite(score)) throw new Error("Score must be a valid number.");
  return Math.min(100, Math.max(0, score));
}

export function normalizeManualGradeInput(input: {
  title?: unknown;
  sourceType?: unknown;
  pointsEarned?: unknown;
  pointsPossible?: unknown;
  feedback?: unknown;
}): NormalizedManualGradeInput {
  const pointsPossible = validateWorkPoints(input.pointsPossible, 0);
  return {
    title: validateGradeText(input.title, "Score title", GRADE_TITLE_MAX_LENGTH),
    sourceType: validateGradeSourceType(input.sourceType),
    pointsEarned: validateEarnedWorkPoints(input.pointsEarned, pointsPossible),
    pointsPossible,
    feedback: validateGradeText(input.feedback, "Feedback", GRADE_FEEDBACK_MAX_LENGTH, false) || null,
  };
}
