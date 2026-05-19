export const FEATURE_FLAG_ID_MAX_LENGTH = 160;
export const FEATURE_FLAG_KEY_MAX_LENGTH = 80;
export const FEATURE_FLAG_LABEL_MAX_LENGTH = 120;
export const FEATURE_FLAG_DESCRIPTION_MAX_LENGTH = 600;

const FEATURE_FLAG_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const FEATURE_FLAG_AUDIENCES = new Set(["all", "admin", "teacher", "student"]);

export type FeatureFlagAudience = "all" | "admin" | "teacher" | "student";

export type NormalizedFeatureFlagInput = {
  flagKey: string;
  label: string;
  description: string | null;
  enabled: boolean;
  audience: FeatureFlagAudience;
};

export function validateFeatureFlagId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Flag is required.");
  if (id.length > FEATURE_FLAG_ID_MAX_LENGTH || !FEATURE_FLAG_ID_PATTERN.test(id)) {
    throw new Error("Flag id must be a short identifier.");
  }
  return id;
}

export function normalizeFeatureFlagKey(value: unknown) {
  const rawKey = String(value ?? "").trim().toLowerCase();
  const key = rawKey.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key) throw new Error("Flag key is required.");
  if (key.length > FEATURE_FLAG_KEY_MAX_LENGTH) {
    throw new Error(`Flag key must be ${FEATURE_FLAG_KEY_MAX_LENGTH} characters or fewer.`);
  }
  return key;
}

export function validateFeatureFlagText(value: unknown, label: string, maxLength: number, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function normalizeFeatureFlagAudience(value: unknown): FeatureFlagAudience {
  const audience = String(value ?? "all").trim();
  return FEATURE_FLAG_AUDIENCES.has(audience) ? (audience as FeatureFlagAudience) : "all";
}

export function normalizeFeatureFlagInput(input: {
  flagKey?: unknown;
  label?: unknown;
  description?: unknown;
  enabled?: unknown;
  audience?: unknown;
}): NormalizedFeatureFlagInput {
  return {
    flagKey: normalizeFeatureFlagKey(input.flagKey),
    label: validateFeatureFlagText(input.label, "Flag label", FEATURE_FLAG_LABEL_MAX_LENGTH),
    description: validateFeatureFlagText(input.description, "Flag description", FEATURE_FLAG_DESCRIPTION_MAX_LENGTH, false) || null,
    enabled: Boolean(input.enabled),
    audience: normalizeFeatureFlagAudience(input.audience),
  };
}
