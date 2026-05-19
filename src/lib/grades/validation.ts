import { validateEarnedWorkPoints, validateWorkPoints } from "@/lib/work/validation";

export const GRADE_CATEGORY_NAME_MAX_LENGTH = 80;
export const GRADE_TITLE_MAX_LENGTH = 160;
export const GRADE_FEEDBACK_MAX_LENGTH = 4_000;
export const GRADE_SOURCE_TYPE_MAX_LENGTH = 80;
export const GRADE_CATEGORY_WEIGHT_MAX = 100;

const GRADE_SOURCE_TYPE_PATTERN = /^[a-z0-9_.:-]+$/i;

export type NormalizedManualGradeInput = {
  title: string;
  sourceType: string;
  pointsEarned: number;
  pointsPossible: number;
  feedback: string | null;
};

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

export function validateGradeSourceType(value: unknown) {
  const sourceType = String(value ?? "manual").trim() || "manual";
  if (sourceType.length > GRADE_SOURCE_TYPE_MAX_LENGTH || !GRADE_SOURCE_TYPE_PATTERN.test(sourceType)) {
    throw new Error("Grade source type must be a short identifier.");
  }
  return sourceType;
}

export function validateGradePercent(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new Error("Score must be a valid number.");
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
