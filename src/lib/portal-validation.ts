export const PORTAL_ID_MAX_LENGTH = 160;
export const PORTAL_NAME_MAX_LENGTH = 120;
export const PORTAL_SLUG_MAX_LENGTH = 80;
export const PORTAL_DOMAIN_MAX_LENGTH = 253;

const PORTAL_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const PORTAL_AUDIENCES = new Set(["internal", "customer", "partner", "public"]);
const HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export type PortalAudience = "internal" | "customer" | "partner" | "public";

export type NormalizedPortalInput = {
  name: string;
  slug: string;
  audience: PortalAudience;
  domain: string | null;
  catalogSettings: {
    enabled: boolean;
    featuredOnly: boolean;
  };
};

export function validatePortalId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Portal is required.");
  if (id.length > PORTAL_ID_MAX_LENGTH || !PORTAL_ID_PATTERN.test(id)) {
    throw new Error("Portal id must be a short identifier.");
  }
  return id;
}

export function validatePortalName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Portal name is required.");
  if (name.length > PORTAL_NAME_MAX_LENGTH) {
    throw new Error(`Portal name must be ${PORTAL_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return name;
}

export function normalizePortalSlug(value: unknown, fallbackName?: unknown) {
  const rawValue = String(value ?? fallbackName ?? "").trim().toLowerCase();
  const slug = rawValue.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Portal slug is required.");
  if (slug.length > PORTAL_SLUG_MAX_LENGTH) {
    throw new Error(`Portal slug must be ${PORTAL_SLUG_MAX_LENGTH} characters or fewer.`);
  }
  return slug;
}

export function normalizePortalAudience(value: unknown): PortalAudience {
  const audience = String(value ?? "internal").trim();
  return PORTAL_AUDIENCES.has(audience) ? (audience as PortalAudience) : "internal";
}

export function normalizePortalDomain(value: unknown) {
  const hostname = String(value ?? "").trim().toLowerCase();
  if (!hostname) return null;
  if (
    hostname.length > PORTAL_DOMAIN_MAX_LENGTH ||
    hostname.includes("..") ||
    hostname.startsWith("-") ||
    hostname.endsWith("-")
  ) {
    throw new Error("Portal domain must be a valid hostname.");
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))) {
    throw new Error("Portal domain must be a valid hostname.");
  }
  return hostname;
}

export function normalizePortalCatalogSettings(input: { catalogEnabled?: unknown; featuredOnly?: unknown }) {
  return {
    enabled: input.catalogEnabled !== false,
    featuredOnly: Boolean(input.featuredOnly),
  };
}

export function normalizePortalInput(input: {
  name?: unknown;
  slug?: unknown;
  audience?: unknown;
  domain?: unknown;
  catalogEnabled?: unknown;
  featuredOnly?: unknown;
}): NormalizedPortalInput {
  const name = validatePortalName(input.name);
  return {
    name,
    slug: normalizePortalSlug(input.slug, name),
    audience: normalizePortalAudience(input.audience),
    domain: normalizePortalDomain(input.domain),
    catalogSettings: normalizePortalCatalogSettings(input),
  };
}
