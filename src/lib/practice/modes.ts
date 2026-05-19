import type { PracticeMode } from "@/types";

export const PRACTICE_MODE_VALUES = [
  "quiz",
  "exam",
  "flashcards",
  "matching",
  "sprint",
  "mistake_retry",
  "fill_blank",
  "true_false",
  "generated_from_studio",
] as const satisfies readonly PracticeMode[];

export type PracticeSearchParams = {
  mode?: string;
};

export function isPracticeMode(value: unknown): value is PracticeMode {
  return typeof value === "string" && PRACTICE_MODE_VALUES.includes(value as PracticeMode);
}

export function normalizePracticeMode(value: unknown, fallback: PracticeMode = "quiz"): PracticeMode {
  return isPracticeMode(value) ? value : fallback;
}
