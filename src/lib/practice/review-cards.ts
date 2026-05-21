import { isPracticeMode } from "@/lib/practice/modes";
import type { PracticeMode } from "@/types";

export type PracticeReviewCardRow = {
  id: string;
  prompt: string;
  correct_answer: string | null;
  explanation: string | null;
  mastery: "again" | "almost" | "mastered";
  next_review_at: string | null;
  created_at: string;
  source_type: string | null;
  source_id: string | null;
  mode: PracticeMode | null;
  mode_label: string | null;
  loop: string[];
  next_action: string | null;
};

type ReviewMetadata = {
  mode?: unknown;
  modeLabel?: unknown;
  loop?: unknown;
  nextAction?: unknown;
};

export function normalizePracticeReviewCardRow(row: Record<string, unknown>): PracticeReviewCardRow {
  const metadata = parseReviewMetadata(row.metadata);
  const mode = isPracticeMode(metadata.mode) ? metadata.mode : null;

  return {
    id: stringValue(row.id),
    prompt: stringValue(row.prompt),
    correct_answer: nullableString(row.correct_answer),
    explanation: nullableString(row.explanation),
    mastery: reviewMastery(row.mastery),
    next_review_at: nullableString(row.next_review_at),
    created_at: stringValue(row.created_at),
    source_type: nullableString(row.source_type),
    source_id: nullableString(row.source_id),
    mode,
    mode_label: nullableString(metadata.modeLabel),
    loop: stringList(metadata.loop),
    next_action: nullableString(metadata.nextAction),
  };
}

function parseReviewMetadata(value: unknown): ReviewMetadata {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as ReviewMetadata;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as ReviewMetadata)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function reviewMastery(value: unknown): PracticeReviewCardRow["mastery"] {
  return value === "almost" || value === "mastered" ? value : "again";
}
