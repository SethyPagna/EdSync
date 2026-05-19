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
    id: "mastery-unlock",
    title: "Mastery unlock",
    triggerKey: AUTOMATION_TRIGGERS.scoreMastery,
    conditions: { scoreGte: 90 },
    actions: [{ type: "unlock", target: "optional_work" }, { type: "award_badge", badge: "mastery" }],
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
const SUPPORTED_ACTION_TYPES = new Set(["notify", "unlock", "award_badge", "create_review", "assign_work"]);
const AUTOMATION_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

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
    return { ...entry, type };
  });
}

export function normalizeAutomationRulePayload(input: {
  title?: unknown;
  triggerKey?: unknown;
  conditions?: unknown;
  actions?: unknown;
  enabled?: unknown;
}): NormalizedAutomationRule {
  return {
    title: validateAutomationTitle(input.title),
    triggerKey: validateAutomationTrigger(input.triggerKey),
    conditions: validateAutomationConditions(input.conditions),
    actions: validateAutomationActions(input.actions),
    enabled: input.enabled !== false,
  };
}
