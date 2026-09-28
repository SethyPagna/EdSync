export type ScoreValue = number | string | null | undefined;

export function numericScore(value: ScoreValue): number | null {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

export function averageScore(values: readonly ScoreValue[]): number | null {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const score = numericScore(value);
    if (score === null) continue;
    total += score;
    count += 1;
  }
  return count ? Math.round(total / count) : null;
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
