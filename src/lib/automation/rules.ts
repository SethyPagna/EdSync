export const AUTOMATION_TITLE_MAX_LENGTH = 140;
export const AUTOMATION_ID_MAX_LENGTH = 180;
export const AUTOMATION_TRIGGERS = {
  learnerInactive: "learner.inactive",
  scoreMastery: "score.mastery",
  deadlineUpcoming: "deadline.upcoming",
  certificationExpiring: "certification.expiring",
  workSubmitted: "work.submitted",
} as const;

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  [AUTOMATION_TRIGGERS.learnerInactive]: "Learner inactive",
  [AUTOMATION_TRIGGERS.scoreMastery]: "Mastery score",
  [AUTOMATION_TRIGGERS.deadlineUpcoming]: "Deadline upcoming",
  [AUTOMATION_TRIGGERS.certificationExpiring]: "Certification expiring",
  [AUTOMATION_TRIGGERS.workSubmitted]: "Work submitted",
};

export const AUTOMATION_RECIPES = [
  {
    id: "inactive-nudge",
    title: "Inactive learner nudge",
    triggerKey: AUTOMATION_TRIGGERS.learnerInactive,
    conditions: { inactiveDays: 5 },
    actions: [{ type: "notify", channel: "in_app", template: "gentle_nudge" }],
  },
  {
    id: "mastery-badge",
    title: "Mastery badge",
    triggerKey: AUTOMATION_TRIGGERS.scoreMastery,
    conditions: { scoreGte: 90 },
    actions: [{ type: "award_badge", badge: "mastery" }, { type: "notify", channel: "in_app", template: "mastery" }],
  },
  {
    id: "deadline-reminder",
    title: "Deadline reminder",
    triggerKey: AUTOMATION_TRIGGERS.deadlineUpcoming,
    conditions: { hoursBeforeDue: 24 },
    actions: [{ type: "notify", channel: "in_app", template: "deadline_reminder" }],
  },
  {
    id: "submission-review",
    title: "Submission review queue",
    triggerKey: AUTOMATION_TRIGGERS.workSubmitted,
    conditions: { workTypes: ["task", "discussion", "activity"], needsReview: true },
    actions: [{ type: "notify", channel: "in_app", template: "teacher_review" }],
  },
  {
    id: "certification-renewal",
    title: "Certification renewal notice",
    triggerKey: AUTOMATION_TRIGGERS.certificationExpiring,
    conditions: { daysBeforeExpiry: 30 },
    actions: [{ type: "notify", channel: "in_app", template: "certification_renewal" }],
  },
];

const SUPPORTED_TRIGGER_KEYS = new Set<string>(Object.values(AUTOMATION_TRIGGERS));
const SUPPORTED_ACTION_TYPES = new Set(["notify", "award_badge"]);
const AUTOMATION_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const BADGE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const WORK_TYPES = new Set(["quiz", "test", "task", "discussion", "activity"]);

export type NormalizedAutomationRule = {
  title: string;
  triggerKey: string;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateAutomationTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Rule title is required.");
  if (title.length > AUTOMATION_TITLE_MAX_LENGTH) {
    throw new Error(`Rule title must be ${AUTOMATION_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function validateAutomationRuleId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Rule is required.");
  if (id.length > AUTOMATION_ID_MAX_LENGTH || !AUTOMATION_ID_PATTERN.test(id)) {
    throw new Error("Rule id must be a short identifier.");
  }
  return id;
}

export function validateAutomationTrigger(value: unknown) {
  const triggerKey = String(value ?? "").trim();
  if (!SUPPORTED_TRIGGER_KEYS.has(triggerKey)) throw new Error("Choose a supported automation trigger.");
  return triggerKey;
}

export function validateAutomationConditions(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error("Conditions must be a JSON object.");
  return value;
}

export function validateAutomationActions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("At least one automation action is required.");
  }

  return value.map((entry) => {
    if (!isPlainObject(entry)) throw new Error("Each automation action must be a JSON object.");
    const type = String(entry.type ?? "").trim();
    if (!SUPPORTED_ACTION_TYPES.has(type)) throw new Error(`Unsupported automation action: ${type || "missing type"}.`);
    if (type === "notify") {
      if (entry.channel !== undefined && entry.channel !== "in_app") throw new Error("Notifications currently support the in-app channel only.");
      return { type, channel: "in_app", ...(typeof entry.template === "string" ? { template: entry.template.slice(0, 80) } : {}) };
    }
    const badge = String(entry.badge ?? "").trim();
    if (!BADGE_PATTERN.test(badge)) throw new Error("Badge must be a short identifier.");
    return { type, badge };
  });
}

function integerCondition(value: unknown, label: string, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function normalizeConditions(triggerKey: string, value: unknown) {
  const conditions = validateAutomationConditions(value);
  switch (triggerKey) {
    case AUTOMATION_TRIGGERS.learnerInactive:
      return { inactiveDays: integerCondition(conditions.inactiveDays, "Inactive days", 5, 1, 365) };
    case AUTOMATION_TRIGGERS.scoreMastery:
      return { scoreGte: integerCondition(conditions.scoreGte, "Mastery score", 90, 0, 100) };
    case AUTOMATION_TRIGGERS.deadlineUpcoming:
      return { hoursBeforeDue: integerCondition(conditions.hoursBeforeDue, "Reminder hours", 24, 1, 168) };
    case AUTOMATION_TRIGGERS.certificationExpiring:
      return { daysBeforeExpiry: integerCondition(conditions.daysBeforeExpiry, "Expiry days", 30, 1, 365) };
    case AUTOMATION_TRIGGERS.workSubmitted: {
      const workTypes = conditions.workTypes === undefined ? [...WORK_TYPES] : conditions.workTypes;
      if (!Array.isArray(workTypes) || workTypes.length === 0 || workTypes.some((item) => typeof item !== "string" || !WORK_TYPES.has(item))) {
        throw new Error("Choose supported work types.");
      }
      if (conditions.needsReview !== undefined && typeof conditions.needsReview !== "boolean") {
        throw new Error("Needs review must be true or false.");
      }
      return { workTypes: [...new Set(workTypes)], needsReview: conditions.needsReview ?? true };
    }
    default:
      throw new Error("Choose a supported automation trigger.");
  }
}

export function normalizeAutomationEnabled(value: unknown, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error("Automation enabled state must be true or false.");
  return value;
}

export function normalizeAutomationRulePayload(input: {
  title?: unknown;
  triggerKey?: unknown;
  conditions?: unknown;
  actions?: unknown;
  enabled?: unknown;
}): NormalizedAutomationRule {
  const triggerKey = validateAutomationTrigger(input.triggerKey);
  const actions = validateAutomationActions(input.actions);
  if (actions.some((action) => action.type === "award_badge") && triggerKey !== AUTOMATION_TRIGGERS.scoreMastery) {
    throw new Error("Badges can only be awarded for mastery scores.");
  }
  return {
    title: validateAutomationTitle(input.title),
    triggerKey,
    conditions: normalizeConditions(triggerKey, input.conditions),
    actions,
    enabled: normalizeAutomationEnabled(input.enabled),
  };
}
