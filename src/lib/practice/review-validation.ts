export const REVIEW_CARD_ID_MAX_LENGTH = 160;
export const REVIEW_NEXT_DATE_MIN_YEAR = 2020;
export const REVIEW_NEXT_DATE_MAX_YEAR = 2100;

const REVIEW_CARD_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const REVIEW_MASTERIES = new Set(["again", "almost", "mastered"]);

export type ReviewMastery = "again" | "almost" | "mastered";

export type NormalizedReviewUpdate = {
  id: string;
  mastery: ReviewMastery;
  nextReviewAt: string | null;
};

export function validateReviewCardId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Review card id is required.");
  if (id.length > REVIEW_CARD_ID_MAX_LENGTH || !REVIEW_CARD_ID_PATTERN.test(id)) {
    throw new Error("Review card id must be a short identifier.");
  }
  return id;
}

export function validateReviewMastery(value: unknown): ReviewMastery {
  const mastery = String(value ?? "again").trim();
  if (!REVIEW_MASTERIES.has(mastery)) {
    throw new Error("Choose a supported review mastery.");
  }
  return mastery as ReviewMastery;
}

export function validateNextReviewAt(value: unknown) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Next review date must be a valid date.");
  }
  const year = date.getUTCFullYear();
  if (year < REVIEW_NEXT_DATE_MIN_YEAR || year > REVIEW_NEXT_DATE_MAX_YEAR) {
    throw new Error("Next review date is outside the supported range.");
  }
  return date.toISOString();
}

export function normalizeReviewUpdate(input: {
  id?: unknown;
  mastery?: unknown;
  nextReviewAt?: unknown;
}): NormalizedReviewUpdate {
  return {
    id: validateReviewCardId(input.id),
    mastery: validateReviewMastery(input.mastery),
    nextReviewAt: validateNextReviewAt(input.nextReviewAt),
  };
}
