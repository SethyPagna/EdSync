import type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

export type { PracticeReviewCardRow } from "@/lib/practice/review-cards";

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

async function parseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Review request failed (${response.status})`);
  }
  return payload?.data ?? null;
}

export async function listPracticeReviews() {
  return fetch("/api/reviews", { credentials: "include" }).then(
    parseResponse<PracticeReviewCardRow[]>,
  );
}

export async function updatePracticeReview(input: {
  id: string;
  mastery: "again" | "almost" | "mastered";
  nextReviewAt?: string | null;
}) {
  return fetch("/api/reviews", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  }).then(parseResponse<{ id: string; mastery: string }>);
}

export async function deletePracticeReview(id: string) {
  return fetch(`/api/reviews?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  }).then(parseResponse<{ id: string; deleted: true }>);
}
