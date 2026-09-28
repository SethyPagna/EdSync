import { readSettingsRecord } from "@/lib/work/grading";

export type WorkSubmissionPolicy = {
  /** Lets a student submit again after the teacher has graded the work. */
  allowResubmission: boolean;
  /** Total submissions allowed; null means unlimited. */
  maxAttempts: number | null;
};

export type ExistingSubmission = {
  status: string;
  /** Highest recorded attempt number (0 when none are recorded). */
  attempts: number;
};

export type SubmissionDecision =
  | { ok: true; attemptNumber: number; late: boolean }
  | { ok: false; status: 403 | 409; error: string };

export const WORK_MAX_ATTEMPTS_LIMIT = 100;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(?:z|[+-]\d{2}:?\d{2})$/i;
// UTC-12 is the latest zone a local time can be in.
const ZONELESS_GRACE_MS = 12 * 60 * 60 * 1000;

function toIsoText(text: string) {
  return DATE_ONLY.test(text) ? `${text}T23:59:59` : text.replace(" ", "T");
}

function hasZone(text: string) {
  return HAS_ZONE.test(toIsoText(text.trim()));
}

export function normalizeWorkSubmissionPolicy(value: unknown): WorkSubmissionPolicy {
  const record = readSettingsRecord(value);
  const rawMax = record.maxAttempts;
  const max = rawMax === null || rawMax === undefined || rawMax === "" ? Number.NaN : Number(rawMax);
  return {
    allowResubmission: record.allowResubmission === true,
    maxAttempts: Number.isFinite(max) && max >= 1 ? Math.min(WORK_MAX_ATTEMPTS_LIMIT, Math.floor(max)) : null,
  };
}

/**
 * Parses a stored due date to epoch ms; a bare date means the end of that day. Values without a zone are
 * parsed as UTC here; evaluateWorkSubmission allows for their unknown zone when it enforces them.
 */
export function parseWorkDueAt(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  const iso = toIsoText(text);
  const ms = Date.parse(HAS_ZONE.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Normalizes a due date sent by a teacher: a value with a zone (Z or an offset) is stored as UTC ISO text.
 * Zoneless values (the teacher page's datetime-local input) are stored as sent.
 */
export function validateWorkDueAt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const ms = typeof value === "string" ? parseWorkDueAt(value) : null;
  if (typeof value !== "string" || ms === null) throw new Error("Choose a valid due date.");
  const text = value.trim();
  return hasZone(text) ? new Date(ms).toISOString() : text;
}

/**
 * The instant a stored due date is enforced from. A zoneless value is the author's local time in a zone that
 * is not stored, so it is read at the latest zone it could mean (UTC-12) and never blocks a student early.
 */
function enforcedDueAt(value: string | null) {
  const ms = parseWorkDueAt(value);
  if (ms === null || !value) return null;
  return hasZone(value) ? ms : ms + ZONELESS_GRACE_MS;
}

export function evaluateWorkSubmission(input: {
  now: number;
  dueAt: string | null;
  allowLate: boolean;
  policy: WorkSubmissionPolicy;
  existing: ExistingSubmission | null;
}): SubmissionDecision {
  const attempts = Math.max(0, Math.floor(Number(input.existing?.attempts ?? 0)) || 0);
  if (input.existing?.status === "graded" && !input.policy.allowResubmission) {
    return { ok: false, status: 409, error: "This work is already graded." };
  }
  if (input.policy.maxAttempts !== null && attempts >= input.policy.maxAttempts) {
    return { ok: false, status: 409, error: "No attempts left." };
  }
  const due = enforcedDueAt(input.dueAt);
  const late = due !== null && input.now > due;
  if (late && !input.allowLate) {
    return { ok: false, status: 403, error: "The due date has passed." };
  }
  return { ok: true, attemptNumber: attempts + 1, late };
}
