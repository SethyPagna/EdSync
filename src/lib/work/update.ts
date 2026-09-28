import type { WorkStatus, WorkType } from "@/types";
import { normalizeWorkGradingSettings, readSettingsRecord, type WorkGradingSettings } from "@/lib/work/grading";
import { normalizeWorkSubmissionPolicy, validateWorkDueAt, type WorkSubmissionPolicy } from "@/lib/work/policy";
import { validateWorkPoints, validateWorkStatus, validateWorkType } from "@/lib/work/validation";

export type WorkSettings = WorkGradingSettings & WorkSubmissionPolicy;

/** Stored learning_work_items columns a teacher can edit. */
export type WorkItemRecord = {
  title: string;
  description: string | null;
  work_type: WorkType;
  instructions: string | null;
  points_possible: number;
  due_at: string | null;
  status: WorkStatus;
  allow_late: number;
  lesson_id: string | null;
  category_id: string | null;
  rubric: string;
  settings: string;
};

const NEW_WORK_ITEM: WorkItemRecord = {
  title: "",
  description: null,
  work_type: "task",
  instructions: null,
  points_possible: 100,
  due_at: null,
  status: "draft",
  allow_late: 1,
  lesson_id: null,
  category_id: null,
  rubric: "[]",
  settings: "{}",
};

// Top-level request fields that map onto keys of the stored settings JSON.
const SETTINGS_FIELDS = {
  gradingMode: "mode",
  gradeWeightPercent: "gradeWeightPercent",
  countsTowardGrade: "countsTowardGrade",
  participationCriteria: "participationCriteria",
  allowResubmission: "allowResubmission",
  maxAttempts: "maxAttempts",
} as const;

export function normalizeWorkSettings(value: unknown): WorkSettings {
  return { ...normalizeWorkGradingSettings(value), ...normalizeWorkSubmissionPolicy(value) };
}

/** Applies the settings a request provides (nested `settings` or top-level fields) on top of the stored settings. */
export function buildWorkSettings(stored: unknown, body: Record<string, unknown>): WorkSettings {
  const next: Record<string, unknown> = { ...normalizeWorkSettings(stored) };
  for (const [key, value] of Object.entries(readSettingsRecord(body.settings))) {
    if (value !== undefined) next[key === "gradingMode" ? "mode" : key] = value;
  }
  for (const [field, key] of Object.entries(SETTINGS_FIELDS)) {
    if (body[field] !== undefined) next[key] = body[field];
  }
  return normalizeWorkSettings(next);
}

function nullableText(value: unknown, label: string) {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new Error(`${label} must be text.`);
}

function nullableId(value: unknown, label: string) {
  if (value === null || value === "") return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Choose a valid ${label}.`);
}

/** Merges only the fields present in `body` into the stored work item; omitted fields keep their stored values. */
export function mergeWorkItemPatch(existing: WorkItemRecord, body: Record<string, unknown>): WorkItemRecord {
  const has = (key: string) => body[key] !== undefined;

  let title = existing.title;
  if (has("title")) {
    title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new Error("Title is required.");
  }
  let rubric = existing.rubric;
  if (has("rubric")) {
    if (!Array.isArray(body.rubric)) throw new Error("Rubric must be a list.");
    rubric = JSON.stringify(body.rubric);
  }
  if (has("allowLate") && typeof body.allowLate !== "boolean") throw new Error("Late work must be on or off.");

  return {
    title,
    description: has("description") ? nullableText(body.description, "Description") : existing.description,
    work_type: has("workType") ? validateWorkType(body.workType, existing.work_type) : existing.work_type,
    instructions: has("instructions") ? nullableText(body.instructions, "Instructions") : existing.instructions,
    points_possible: has("pointsPossible")
      ? validateWorkPoints(body.pointsPossible, existing.points_possible)
      : existing.points_possible,
    due_at: has("dueAt") ? validateWorkDueAt(body.dueAt) : existing.due_at,
    status: has("status") ? validateWorkStatus(body.status, { fallback: existing.status }) : existing.status,
    allow_late: has("allowLate") ? (body.allowLate ? 1 : 0) : existing.allow_late,
    lesson_id: has("lessonId") ? nullableId(body.lessonId, "lesson") : existing.lesson_id,
    category_id: has("categoryId") ? nullableId(body.categoryId, "category") : existing.category_id,
    rubric,
    settings: JSON.stringify(buildWorkSettings(existing.settings, body)),
  };
}

export function newWorkItemRecord(body: Record<string, unknown>): WorkItemRecord {
  validateWorkStatus(body.status, { allowArchived: false });
  const record = mergeWorkItemPatch(NEW_WORK_ITEM, body);
  if (!record.title) throw new Error("Title is required.");
  return record;
}
