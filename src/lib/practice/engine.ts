import type { PracticeAttemptSummary, PracticeMode, ReviewCard } from "@/types";

export type PracticeItem = {
  id: string;
  prompt: string;
  answer: string | boolean | string[];
  response?: string | boolean | string[];
  explanation?: string;
  points?: number;
};

export type PracticeAttemptInput = {
  mode: PracticeMode;
  items: PracticeItem[];
  elapsedSeconds: number;
  targetSeconds?: number | null;
};

function normalizeAnswer(value: PracticeItem["answer"]) {
  if (Array.isArray(value)) return value.map((item) => item.trim().toLowerCase()).sort().join("|");
  return String(value).trim().toLowerCase();
}

export function isPracticeItemCorrect(item: PracticeItem) {
  if (item.response === undefined || item.response === null) return false;
  return normalizeAnswer(item.answer) === normalizeAnswer(item.response);
}

export function summarizePracticeAttempt(input: PracticeAttemptInput): PracticeAttemptSummary {
  let correctItems = 0;
  let pointsEarned = 0;
  let pointsPossible = 0;
  const reviewCardIds: string[] = [];

  for (const item of input.items) {
    const points = Math.max(1, Number(item.points ?? 1));
    const correct = isPracticeItemCorrect(item);
    pointsPossible += points;
    if (correct) {
      correctItems += 1;
      pointsEarned += points;
    } else {
      reviewCardIds.push(item.id);
    }
  }

  const percent = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0;

  return {
    mode: input.mode,
    totalItems: input.items.length,
    correctItems,
    missedItems: input.items.length - correctItems,
    pointsEarned,
    pointsPossible,
    percent,
    elapsedSeconds: Math.max(0, input.elapsedSeconds),
    targetSeconds: input.targetSeconds ?? null,
    reviewCardIds,
  };
}

export function missedPracticeItems(items: PracticeItem[]) {
  return items.filter((item) => !isPracticeItemCorrect(item));
}

export function createReviewCards(items: PracticeItem[], sourceId: string): ReviewCard[] {
  return missedPracticeItems(items).map((item) => ({
    id: item.id,
    sourceType: "practice",
    sourceId,
    prompt: item.prompt,
    correctAnswer: Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer),
    explanation: item.explanation || "Review the concept, then retry this item.",
    nextReviewAt: null,
    mastery: "again",
    createdAt: new Date().toISOString(),
  }));
}

export function targetSecondsFromMinutes(minutes: number) {
  return Math.max(60, Math.round(minutes * 60));
}
