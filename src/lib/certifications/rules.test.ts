import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_RECIPES,
  CERTIFICATION_TITLE_MAX_LENGTH,
  normalizeCertificationRulePayload,
  normalizeCertificationSettings,
  validateCertificationTitle,
} from "@/lib/certifications/rules";

describe("certification rule validation", () => {
  it("keeps starter recipes compatible with validation", () => {
    for (const recipe of CERTIFICATION_RECIPES) {
      expect(normalizeCertificationRulePayload(recipe).title).toBe(recipe.title);
    }
  });

  it("validates title and normalizes timing", () => {
    expect(validateCertificationTitle("  Safety  ")).toBe("Safety");
    expect(() => validateCertificationTitle("")).toThrow("required");
    expect(() => validateCertificationTitle("x".repeat(CERTIFICATION_TITLE_MAX_LENGTH + 1))).toThrow("characters");

    expect(normalizeCertificationRulePayload({ title: "No expiry", expiresAfterDays: 0 }).expiresAfterDays).toBeNull();
    expect(normalizeCertificationRulePayload({ title: "Long", expiresAfterDays: 99999 }).expiresAfterDays).toBe(3650);
    expect(normalizeCertificationRulePayload({ title: "Notify", notifyBeforeDays: -5 }).notifyBeforeDays).toBe(0);
  });

  it("requires object settings", () => {
    expect(normalizeCertificationSettings({ audit: "standard" })).toEqual({ audit: "standard" });
    expect(normalizeCertificationSettings(null)).toEqual({});
    expect(() => normalizeCertificationSettings([])).toThrow("JSON object");
  });
});
