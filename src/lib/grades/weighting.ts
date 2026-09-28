export type WeightedScore = {
  category_id: string | null;
  percent: number | null;
  status: string;
};

export type CategoryWeight = {
  id: string;
  weight: number | null;
};

const UNCATEGORIZED = "uncategorized";

/** Averages graded scores per category, then weights the category averages (uncategorized and unknown categories weigh 1). */
export function weightedAverage(scores: WeightedScore[], categories: CategoryWeight[]) {
  const weights = new Map(categories.map((category) => [category.id, Number(category.weight ?? 0)]));
  const grouped = new Map<string, number[]>();

  for (const score of scores) {
    if (score.status !== "graded" || score.percent === null || score.percent === undefined) continue;
    const key = score.category_id || UNCATEGORIZED;
    grouped.set(key, [...(grouped.get(key) ?? []), Number(score.percent)]);
  }

  let weightedTotal = 0;
  let weightTotal = 0;
  for (const [categoryId, values] of grouped) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const weight = weights.get(categoryId) ?? 1;
    weightedTotal += average * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round((weightedTotal / weightTotal) * 100) / 100 : null;
}

export function referencedCategoryIds(scores: Array<{ category_id: string | null }>) {
  return Array.from(new Set(scores.map((score) => score.category_id).filter((id): id is string => Boolean(id))));
}
