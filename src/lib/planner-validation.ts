export const PLANNER_TITLE_MAX_LENGTH = 140;
export const PLANNER_BODY_MAX_LENGTH = 2_000;
export const PLANNER_LOCATION_MAX_LENGTH = 240;

export type PlannerPriority = "low" | "normal" | "high";
export type PlannerEventType = "deadline" | "class" | "office_hours" | "study" | "announcement" | "other";

const EVENT_TYPES = new Set<PlannerEventType>([
  "deadline",
  "class",
  "office_hours",
  "study",
  "announcement",
  "other",
]);

export function normalizePlannerText(value: unknown, label: string, maxLength: number, required = true) {
  const text = String(value ?? "").trim();
  if (!text) {
    if (required) throw new Error(`${label} is required.`);
    return null;
  }
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text;
}

export function normalizePlannerPriority(value: unknown): PlannerPriority {
  if (value === "low" || value === "normal" || value === "high") return value;
  return "normal";
}

export function normalizePlannerEventType(value: unknown, fallback: PlannerEventType): PlannerEventType {
  return typeof value === "string" && EVENT_TYPES.has(value as PlannerEventType)
    ? (value as PlannerEventType)
    : fallback;
}

export function normalizePlannerDateTime(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return text;
}

export function validatePlannerDateOrder(input: { startsAt?: string | null; endsAt?: string | null }) {
  if (!input.startsAt || !input.endsAt) return;
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt) && endsAt < startsAt) {
    throw new Error("End time must be after start time.");
  }
}
