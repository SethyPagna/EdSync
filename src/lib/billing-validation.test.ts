import { describe, expect, it } from "vitest";
import {
  BILLING_AMOUNT_MAX_CENTS,
  BILLING_DESCRIPTION_MAX_LENGTH,
  BILLING_ID_MAX_LENGTH,
  BILLING_TITLE_MAX_LENGTH,
  normalizeBillingAmountCents,
  normalizeBillingCurrency,
  normalizeCheckoutUrl,
  normalizeOptionalBillingId,
  normalizePriceInput,
  normalizeProductInput,
  validateBillingId,
  validateBillingTitle,
} from "@/lib/billing-validation";

describe("billing validation", () => {
  it("normalizes product input", () => {
    expect(
      normalizeProductInput({
        title: "  Algebra Sprint ",
        description: "  Practice pack ",
        productType: "bundle",
        courseId: "course-1",
        status: "active",
      }),
    ).toEqual({
      title: "Algebra Sprint",
      description: "Practice pack",
      productType: "bundle",
      courseId: "course-1",
      status: "active",
    });
  });

  it("normalizes price input", () => {
    expect(
      normalizePriceInput({
        productId: "product-1",
        currency: " USD ",
        amountCents: 1299.4,
        billingInterval: "month",
        active: false,
      }),
    ).toEqual({
      productId: "product-1",
      currency: "usd",
      amountCents: 1299,
      billingInterval: "month",
      active: false,
    });
  });

  it("validates identifiers, titles, and descriptions", () => {
    expect(validateBillingId("price_1")).toBe("price_1");
    expect(normalizeOptionalBillingId("", "Portal")).toBeNull();
    expect(normalizeOptionalBillingId(undefined, "Portal")).toBeUndefined();
    expect(() => validateBillingId("bad id", "Product")).toThrow("short identifier");
    expect(() => validateBillingId("x".repeat(BILLING_ID_MAX_LENGTH + 1), "Product")).toThrow("short identifier");
    expect(() => validateBillingTitle("")).toThrow("required");
    expect(() => validateBillingTitle("x".repeat(BILLING_TITLE_MAX_LENGTH + 1))).toThrow("characters");
    expect(() => normalizeProductInput({ title: "Ok", description: "x".repeat(BILLING_DESCRIPTION_MAX_LENGTH + 1) })).toThrow(
      "characters",
    );
  });

  it("validates currency, amount, and checkout URLs", () => {
    expect(normalizeBillingCurrency("KHR")).toBe("khr");
    expect(normalizeBillingAmountCents(BILLING_AMOUNT_MAX_CENTS)).toBe(BILLING_AMOUNT_MAX_CENTS);
    expect(normalizeCheckoutUrl("https://edsync.example/success", "https://fallback.example")).toBe("https://edsync.example/success");
    expect(() => normalizeBillingCurrency("US")).toThrow("three-letter");
    expect(() => normalizeBillingAmountCents(Number.NaN)).toThrow("valid number");
    expect(() => normalizeBillingAmountCents(BILLING_AMOUNT_MAX_CENTS + 1)).toThrow("between");
    expect(() => normalizeCheckoutUrl("javascript:alert(1)", "https://fallback.example")).toThrow("HTTP or HTTPS");
  });

  it("defaults unsupported product and interval values safely", () => {
    expect(normalizeProductInput({ title: "Course", productType: "unknown", status: "hidden" }).productType).toBe("course");
    expect(normalizeProductInput({ title: "Course", productType: "unknown", status: "hidden" }).status).toBe("draft");
    expect(normalizePriceInput({ productId: "product-1", amountCents: 0, billingInterval: "forever" }).billingInterval).toBe("one_time");
  });
});
