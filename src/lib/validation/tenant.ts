import type { TenantIsolationMode, TenantPlanTier } from "@/types";

export const TENANT_NAME_MAX_LENGTH = 120;
export const TENANT_SLUG_MAX_LENGTH = 80;

const TENANT_PLAN_TIERS = new Set(["solo", "team", "enterprise"]);
const TENANT_ISOLATION_MODES = new Set(["shared_d1", "dedicated_d1"]);

export type NormalizedTenantInput = {
  name: string;
  slug: string;
  planTier: TenantPlanTier;
  isolationMode: TenantIsolationMode;
};

export function validateTenantName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Tenant name is required.");
  if (name.length > TENANT_NAME_MAX_LENGTH) {
    throw new Error(`Tenant name must be ${TENANT_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return name;
}

export function normalizeTenantSlug(value: unknown, fallbackName?: unknown) {
  const rawValue = String(value ?? fallbackName ?? "").trim().toLowerCase();
  const slug = rawValue.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Tenant slug is required.");
  if (slug.length > TENANT_SLUG_MAX_LENGTH) {
    throw new Error(`Tenant slug must be ${TENANT_SLUG_MAX_LENGTH} characters or fewer.`);
  }
  return slug;
}

export function normalizeTenantPlanTier(value: unknown): TenantPlanTier {
  const tier = String(value ?? "solo").trim();
  return TENANT_PLAN_TIERS.has(tier) ? (tier as TenantPlanTier) : "solo";
}

export function normalizeTenantIsolationMode(value: unknown): TenantIsolationMode {
  const mode = String(value ?? "shared_d1").trim();
  return TENANT_ISOLATION_MODES.has(mode) ? (mode as TenantIsolationMode) : "shared_d1";
}

export function normalizeTenantInput(input: {
  name?: unknown;
  slug?: unknown;
  planTier?: unknown;
  isolationMode?: unknown;
}): NormalizedTenantInput {
  const name = validateTenantName(input.name);
  return {
    name,
    slug: normalizeTenantSlug(input.slug, name),
    planTier: normalizeTenantPlanTier(input.planTier),
    isolationMode: normalizeTenantIsolationMode(input.isolationMode),
  };
}
