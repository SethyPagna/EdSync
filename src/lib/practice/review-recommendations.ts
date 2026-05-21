import type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

export type PracticeReviewRecommendation = {
  title: string;
  subtitle: string;
  label: string;
  href: string;
  count: number;
  loop: string[];
};

export function summarizePracticeReviewCards(
  cards: PracticeReviewCardRow[],
): PracticeReviewRecommendation | null {
  const pendingCards = cards.filter((card) => card.mastery !== "mastered");
  if (pendingCards.length === 0) return null;

  const priorityCard = pendingCards.find((card) => card.mastery === "again") ?? pendingCards[0];
  const label = priorityCard.mode_label ?? "Review";

  return {
    title: pendingCards.length === 1 ? "Retry 1 missed item" : `Retry ${pendingCards.length} missed items`,
    subtitle: priorityCard.next_action || loopSubtitle(priorityCard.loop),
    label,
    href: priorityCard.mode ? `/practice?mode=${priorityCard.mode}` : "/practice?mode=mistake_retry",
    count: pendingCards.length,
    loop: priorityCard.loop,
  };
}

function loopSubtitle(loop: string[]) {
  if (loop.length === 0) return "Practice the items that need one more pass.";
  return loop.join(" -> ");
}
