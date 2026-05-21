import type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

export type TeacherPracticeReviewSignal = {
  pendingCount: number;
  againCount: number;
  almostCount: number;
  topModeLabel: string;
  copy: string;
};

export function summarizeTeacherPracticeReviews(
  cards: PracticeReviewCardRow[],
): TeacherPracticeReviewSignal {
  const pendingCards = cards.filter((card) => card.mastery !== "mastered");
  const againCount = pendingCards.filter((card) => card.mastery === "again").length;
  const almostCount = pendingCards.filter((card) => card.mastery === "almost").length;
  const topModeLabel = topReviewMode(pendingCards);

  return {
    pendingCount: pendingCards.length,
    againCount,
    almostCount,
    topModeLabel,
    copy: reviewSignalCopy({ pendingCount: pendingCards.length, againCount, topModeLabel }),
  };
}

function topReviewMode(cards: PracticeReviewCardRow[]) {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const label = card.mode_label || "Review";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let topLabel = "Review";
  let topCount = 0;
  counts.forEach((count, label) => {
    if (count > topCount) {
      topLabel = label;
      topCount = count;
    }
  });
  return topLabel;
}

function reviewSignalCopy(input: {
  pendingCount: number;
  againCount: number;
  topModeLabel: string;
}) {
  if (input.pendingCount === 0) return "No pending practice reviews";
  if (input.againCount > 0) {
    return `${input.againCount} need another try in ${input.topModeLabel}`;
  }
  return `${input.pendingCount} almost mastered in ${input.topModeLabel}`;
}
