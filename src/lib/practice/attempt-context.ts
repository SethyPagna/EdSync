import { PRACTICE_MODES } from "@/lib/studio/catalog";
import type { PracticeAttemptSummary, PracticeMode } from "@/types";
import type { PracticeItem } from "./engine";

export type PracticeModeContext = {
  mode: PracticeMode;
  label: string;
  targetMinutes: number;
  loop: string[];
  bestFor: string;
  output: string;
};

export type PracticeAttemptContext = {
  mode: PracticeModeContext;
  source: {
    type: string;
    id: string | null;
  };
  reviewCardCount: number;
  recommendation: string;
};

export function getPracticeModeContext(mode: PracticeMode): PracticeModeContext {
  const modeConfig = PRACTICE_MODES.find((entry) => entry.mode === mode) ?? PRACTICE_MODES[0];

  return {
    mode: modeConfig.mode,
    label: modeConfig.label,
    targetMinutes: modeConfig.targetMinutes,
    loop: [...modeConfig.loop],
    bestFor: modeConfig.bestFor,
    output: modeConfig.output,
  };
}

export function buildPracticeAttemptContext(input: {
  mode: PracticeMode;
  sourceType: string;
  sourceId: string | null;
  summary: PracticeAttemptSummary;
}): PracticeAttemptContext {
  const modeContext = getPracticeModeContext(input.mode);

  return {
    mode: modeContext,
    source: {
      type: input.sourceType,
      id: input.sourceId,
    },
    reviewCardCount: input.summary.reviewCardIds.length,
    recommendation: getAttemptRecommendation(input.summary, modeContext),
  };
}

export function buildPracticeItemContext(input: {
  item: PracticeItem;
  mode: PracticeMode;
  isCorrect: boolean;
}) {
  const modeContext = getPracticeModeContext(input.mode);

  return {
    clientItemId: input.item.id,
    mode: modeContext.mode,
    modeLabel: modeContext.label,
    loop: modeContext.loop,
    isCorrect: input.isCorrect,
  };
}

export function buildPracticeReviewContext(input: { item: PracticeItem; mode: PracticeMode }) {
  const modeContext = getPracticeModeContext(input.mode);

  return {
    clientItemId: input.item.id,
    mode: modeContext.mode,
    modeLabel: modeContext.label,
    loop: modeContext.loop,
    nextAction: modeContext.output,
  };
}

function getAttemptRecommendation(summary: PracticeAttemptSummary, modeContext: PracticeModeContext) {
  if (summary.missedItems === 0) {
    return "Ready for the next challenge.";
  }

  if (summary.percent < 60) {
    return `Review missed ${modeContext.label.toLowerCase()} items before moving on.`;
  }

  return "Retry missed items, then continue.";
}
