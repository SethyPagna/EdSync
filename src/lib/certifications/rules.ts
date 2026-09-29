export const CERTIFICATION_TITLE_MAX_LENGTH = 140;
export const CERTIFICATION_DESCRIPTION_MAX_LENGTH = 600;
export const CERTIFICATION_ID_MAX_LENGTH = 160;
export const CERTIFICATION_MIN_NOTIFY_DAYS = 0;
export const CERTIFICATION_MAX_NOTIFY_DAYS = 365;
export const CERTIFICATION_MIN_EXPIRY_DAYS = 0;
export const CERTIFICATION_MAX_EXPIRY_DAYS = 3650;

const CERTIFICATION_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

export const CERTIFICATION_RECIPES = [
  {
    id: "annual-compliance",
    title: "Annual compliance renewal",
    description: "Recurring compliance training with a one-month renewal window.",
    expiresAfterDays: 365,
    notifyBeforeDays: 30,
    settings: { audit: "required", renewal: "annual", evidence: ["completion", "score"] },
  },
  {
    id: "safety-onboarding",
    title: "Safety onboarding",
    description: "Required onboarding proof for new learners before advanced access.",
    expiresAfterDays: 730,
    notifyBeforeDays: 45,
    settings: { audit: "required", renewal: "biennial", evidence: ["completion"] },
  },
  {
    id: "skill-mastery",
    title: "Skill mastery badge",
    description: "Mastery certificate for learners who complete a course and meet the score target.",
    expiresAfterDays: null,
    notifyBeforeDays: 0,
    settings: { audit: "light", renewal: "none", evidence: ["completion", "score"], scoreGte: 90 },
  },
  {
    id: "customer-training",
    title: "Customer training certificate",
    description: "External training certificate for customers, partners, or public catalog learners.",
    expiresAfterDays: 365,
    notifyBeforeDays: 21,
    settings: { audit: "standard", renewal: "annual", audience: "external" },
  },
];

export type NormalizedCertificationRule = {
  title: string;
  description: string | null;
  courseId: string | null;
  expiresAfterDays: number | null;
  notifyBeforeDays: number;
  settings: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeBoundedInteger(value: unknown, label: string, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  const normalized = Math.round(number);
  return Math.min(max, Math.max(min, normalized));
}

export function validateCertificationTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Certification title is required.");
  if (title.length > CERTIFICATION_TITLE_MAX_LENGTH) {
    throw new Error(`Certification title must be ${CERTIFICATION_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function validateCertificationRuleId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Rule is required.");
  if (id.length > CERTIFICATION_ID_MAX_LENGTH || !CERTIFICATION_ID_PATTERN.test(id)) {
    throw new Error("Rule id must be a short identifier.");
  }
  return id;
}

export function normalizeCertificationCourseId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) return null;
  if (id.length > CERTIFICATION_ID_MAX_LENGTH || !CERTIFICATION_ID_PATTERN.test(id)) {
    throw new Error("Course id must be a short identifier.");
  }
  return id;
}

export function normalizeCertificationDescription(value: unknown) {
  const description = String(value ?? "").trim();
  if (!description) return null;
  if (description.length > CERTIFICATION_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Description must be ${CERTIFICATION_DESCRIPTION_MAX_LENGTH} characters or fewer.`);
  }
  return description;
}

export function normalizeCertificationExpiry(value: unknown) {
  if (value === null || value === undefined || value === "" || Number(value) === 0) return null;
  return normalizeBoundedInteger(value, "Expiry days", CERTIFICATION_MIN_EXPIRY_DAYS, CERTIFICATION_MAX_EXPIRY_DAYS);
}

export function normalizeCertificationNotifyDays(value: unknown) {
  if (value === null || value === undefined || value === "") return 30;
  return normalizeBoundedInteger(value, "Notification days", CERTIFICATION_MIN_NOTIFY_DAYS, CERTIFICATION_MAX_NOTIFY_DAYS);
}

export function normalizeCertificationSettings(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error("Certification settings must be a JSON object.");
  const settings = { ...value };
  if (settings.evidence !== undefined) {
    if (!Array.isArray(settings.evidence) || settings.evidence.length === 0 ||
        settings.evidence.some((item) => item !== "completion" && item !== "score")) {
      throw new Error("Choose completion or score evidence.");
    }
    settings.evidence = [...new Set(settings.evidence)];
  }
  if (settings.scoreGte !== undefined &&
      (typeof settings.scoreGte !== "number" || !Number.isInteger(settings.scoreGte) || settings.scoreGte < 0 || settings.scoreGte > 100)) {
    throw new Error("Minimum score must be between 0 and 100.");
  }
  if (settings.scoreGte !== undefined && Array.isArray(settings.evidence) && !settings.evidence.includes("score")) {
    throw new Error("Score evidence is required when a minimum score is set.");
  }
  if (settings.renewal !== undefined && !["none", "annual", "biennial"].includes(String(settings.renewal))) {
    throw new Error("Choose a supported renewal policy.");
  }
  if (settings.audit !== undefined && !["light", "standard", "required"].includes(String(settings.audit))) {
    throw new Error("Choose a supported audit level.");
  }
  if (settings.audience !== undefined && !["internal", "external"].includes(String(settings.audience))) {
    throw new Error("Choose a supported audience.");
  }
  return settings;
}

export function normalizeCertificationRulePayload(input: {
  title?: unknown;
  description?: unknown;
  courseId?: unknown;
  expiresAfterDays?: unknown;
  notifyBeforeDays?: unknown;
  settings?: unknown;
}): NormalizedCertificationRule {
  return {
    title: validateCertificationTitle(input.title),
    description: normalizeCertificationDescription(input.description),
    courseId: normalizeCertificationCourseId(input.courseId),
    expiresAfterDays: normalizeCertificationExpiry(input.expiresAfterDays),
    notifyBeforeDays: normalizeCertificationNotifyDays(input.notifyBeforeDays),
    settings: normalizeCertificationSettings(input.settings),
  };
}
