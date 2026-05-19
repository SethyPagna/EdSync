export type CatalogPriceFilter = "all" | "free" | "paid";

export type CatalogFilters = {
  query: string;
  portalSlug: string | null;
  tenantSlug: string | null;
  featuredOnly: boolean;
  price: CatalogPriceFilter;
  category: string;
  difficulty: string;
  language: string;
  courseLanguage: string;
  maxDuration: number | null;
};

export type CatalogSearchParams = {
  q?: string;
  query?: string;
  portal?: string;
  portalSlug?: string;
  tenant?: string;
  tenantSlug?: string;
  featured?: string;
  featuredOnly?: string;
  price?: string;
  category?: string;
  difficulty?: string;
  language?: string;
  courseLanguage?: string;
  catalogLanguage?: string;
  maxDuration?: string;
  duration?: string;
};

const TEXT_FILTER_MAX_LENGTH = 80;
const SEARCH_MAX_LENGTH = 120;
const MAX_DURATION_LIMIT = 600;

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeNullableSlug(value: unknown) {
  const slug = normalizeText(value, TEXT_FILTER_MAX_LENGTH).toLowerCase();
  return slug || null;
}

function normalizePrice(value: unknown): CatalogPriceFilter {
  return value === "free" || value === "paid" ? value : "all";
}

function normalizeMaxDuration(value: unknown) {
  const text = normalizeText(value, 10);
  if (!text) return null;
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(Math.round(minutes), MAX_DURATION_LIMIT);
}

export function normalizeCatalogFilters(input: {
  q?: unknown;
  query?: unknown;
  portal?: unknown;
  portalSlug?: unknown;
  tenant?: unknown;
  tenantSlug?: unknown;
  featured?: unknown;
  featuredOnly?: unknown;
  price?: unknown;
  category?: unknown;
  difficulty?: unknown;
  language?: unknown;
  courseLanguage?: unknown;
  catalogLanguage?: unknown;
  maxDuration?: unknown;
  duration?: unknown;
} = {}): CatalogFilters {
  return {
    query: normalizeText(input.query ?? input.q, SEARCH_MAX_LENGTH),
    portalSlug: normalizeNullableSlug(input.portalSlug ?? input.portal),
    tenantSlug: normalizeNullableSlug(input.tenantSlug ?? input.tenant),
    featuredOnly: input.featuredOnly === true || input.featured === "true",
    price: normalizePrice(input.price),
    category: normalizeText(input.category, TEXT_FILTER_MAX_LENGTH),
    difficulty: normalizeText(input.difficulty, TEXT_FILTER_MAX_LENGTH),
    language: normalizeText(input.language, TEXT_FILTER_MAX_LENGTH),
    courseLanguage: normalizeText(input.courseLanguage ?? input.catalogLanguage, TEXT_FILTER_MAX_LENGTH),
    maxDuration: normalizeMaxDuration(input.maxDuration ?? input.duration),
  };
}

export function hasCatalogFilters(filters: CatalogFilters) {
  return Boolean(
    filters.query ||
      filters.portalSlug ||
      filters.tenantSlug ||
      filters.featuredOnly ||
      filters.price !== "all" ||
      filters.category ||
      filters.difficulty ||
      filters.courseLanguage ||
      filters.maxDuration,
  );
}
