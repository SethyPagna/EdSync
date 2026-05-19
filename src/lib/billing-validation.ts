import type { BillingPrice, BillingProduct } from "@/types";

export const BILLING_ID_MAX_LENGTH = 160;
export const BILLING_TITLE_MAX_LENGTH = 160;
export const BILLING_DESCRIPTION_MAX_LENGTH = 1200;
export const BILLING_AMOUNT_MAX_CENTS = 100_000_000;
export const BILLING_URL_MAX_LENGTH = 2048;

const BILLING_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const BILLING_PRODUCT_TYPES = new Set(["course", "bundle", "membership", "subscription"]);
const BILLING_PRODUCT_STATUSES = new Set(["draft", "active", "archived"]);
const BILLING_INTERVALS = new Set(["one_time", "month", "year", "invoice"]);
const CURRENCY_PATTERN = /^[a-z]{3}$/;

export type NormalizedProductInput = {
  title: string;
  description: string | null;
  productType: BillingProduct["product_type"];
  courseId: string | null;
  status: BillingProduct["status"];
};

export type NormalizedPriceInput = {
  productId: string;
  currency: string;
  amountCents: number;
  billingInterval: BillingPrice["billing_interval"];
  active: boolean;
};

export function validateBillingId(value: unknown, label = "Record") {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} is required.`);
  if (id.length > BILLING_ID_MAX_LENGTH || !BILLING_ID_PATTERN.test(id)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return id;
}

export function normalizeOptionalBillingId(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  return validateBillingId(value, label);
}

export function validateBillingTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Product title is required.");
  if (title.length > BILLING_TITLE_MAX_LENGTH) {
    throw new Error(`Product title must be ${BILLING_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function normalizeBillingDescription(value: unknown) {
  const description = String(value ?? "").trim();
  if (!description) return null;
  if (description.length > BILLING_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Product description must be ${BILLING_DESCRIPTION_MAX_LENGTH} characters or fewer.`);
  }
  return description;
}

export function normalizeProductType(value: unknown): BillingProduct["product_type"] {
  const productType = String(value ?? "course").trim();
  return BILLING_PRODUCT_TYPES.has(productType) ? (productType as BillingProduct["product_type"]) : "course";
}

export function normalizeProductStatus(value: unknown): BillingProduct["status"] {
  const status = String(value ?? "draft").trim();
  return BILLING_PRODUCT_STATUSES.has(status) ? (status as BillingProduct["status"]) : "draft";
}

export function normalizeBillingCurrency(value: unknown) {
  const currency = String(value ?? "usd").trim().toLowerCase();
  if (!CURRENCY_PATTERN.test(currency)) throw new Error("Currency must be a three-letter code.");
  return currency;
}

export function normalizeBillingAmountCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Amount must be a valid number.");
  const amountCents = Math.round(amount);
  if (amountCents < 0 || amountCents > BILLING_AMOUNT_MAX_CENTS) {
    throw new Error(`Amount must be between 0 and ${BILLING_AMOUNT_MAX_CENTS} cents.`);
  }
  return amountCents;
}

export function normalizeBillingInterval(value: unknown): BillingPrice["billing_interval"] {
  const interval = String(value ?? "one_time").trim();
  return BILLING_INTERVALS.has(interval) ? (interval as BillingPrice["billing_interval"]) : "one_time";
}

export function normalizeCheckoutUrl(value: unknown, fallbackUrl: string) {
  const url = String(value ?? fallbackUrl).trim();
  if (url.length > BILLING_URL_MAX_LENGTH) throw new Error("Checkout URL is too long.");
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol.");
    return parsed.toString();
  } catch {
    throw new Error("Checkout URL must be a valid HTTP or HTTPS URL.");
  }
}

export function normalizeProductInput(input: {
  title?: unknown;
  description?: unknown;
  productType?: unknown;
  courseId?: unknown;
  status?: unknown;
}): NormalizedProductInput {
  return {
    title: validateBillingTitle(input.title),
    description: normalizeBillingDescription(input.description),
    productType: normalizeProductType(input.productType),
    courseId: normalizeOptionalBillingId(input.courseId, "Course") ?? null,
    status: normalizeProductStatus(input.status),
  };
}

export function normalizePriceInput(input: {
  productId?: unknown;
  currency?: unknown;
  amountCents?: unknown;
  billingInterval?: unknown;
  active?: unknown;
}): NormalizedPriceInput {
  return {
    productId: validateBillingId(input.productId, "Product"),
    currency: normalizeBillingCurrency(input.currency),
    amountCents: normalizeBillingAmountCents(input.amountCents),
    billingInterval: normalizeBillingInterval(input.billingInterval),
    active: input.active === false ? false : true,
  };
}
