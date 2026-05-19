import type { WorkStatus, WorkType } from "@/types";

const WORK_TYPES = new Set(["quiz", "test", "task", "discussion", "activity"]);
const WORK_STATUSES = new Set(["draft", "published", "archived"]);

export const WORK_POINTS_MAX = 10_000;

export function isWorkType(value: unknown): value is WorkType {
  return typeof value === "string" && WORK_TYPES.has(value);
}

export function validateWorkType(value: unknown, fallback: WorkType = "task"): WorkType {
  if (value === undefined || value === null || value === "") return fallback;
  if (!isWorkType(value)) throw new Error("Choose a supported work type.");
  return value;
}

export function validateWorkStatus(
  value: unknown,
  options: { allowArchived?: boolean; fallback?: WorkStatus } = {},
): WorkStatus {
  const fallback = options.fallback ?? "draft";
  const allowArchived = options.allowArchived ?? true;
  if (value === undefined || value === null || value === "") return fallback;

  const status = String(value).trim();
  if (!WORK_STATUSES.has(status) || (!allowArchived && status === "archived")) {
    throw new Error("Choose a supported work status.");
  }
  return status as WorkStatus;
}

export function validateWorkPoints(value: unknown, fallback = 100) {
  const points = Number(value ?? fallback);
  if (!Number.isFinite(points)) throw new Error("Points must be a valid number.");
  return Math.min(WORK_POINTS_MAX, Math.max(0, points));
}

export function validateEarnedWorkPoints(value: unknown, pointsPossible: number) {
  const points = validateWorkPoints(value, 0);
  return Math.min(points, pointsPossible);
}
