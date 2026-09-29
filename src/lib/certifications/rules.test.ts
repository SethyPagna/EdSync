import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_ID_MAX_LENGTH,
  CERTIFICATION_RECIPES,
  CERTIFICATION_TITLE_MAX_LENGTH,
  normalizeCertificationExpiry,
  normalizeCertificationNotifyDays,
  normalizeCertificationCourseId,
  normalizeCertificationRulePayload,
  normalizeCertificationSettings,
  validateCertificationRuleId,
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
    expect(normalizeCertificationExpiry("45")).toBe(45);
    expect(normalizeCertificationNotifyDays(undefined)).toBe(30);
    expect(() => normalizeCertificationExpiry("soon")).toThrow("must be a number");
    expect(() => normalizeCertificationNotifyDays("later")).toThrow("must be a number");
  });

  it("requires object settings", () => {
    expect(normalizeCertificationSettings({ audit: "standard" })).toEqual({ audit: "standard" });
    expect(normalizeCertificationSettings(null)).toEqual({});
    expect(() => normalizeCertificationSettings([])).toThrow("JSON object");
    expect(normalizeCertificationSettings({ evidence: ["completion", "completion", "score"], scoreGte: 90 })).toEqual({ evidence: ["completion", "score"], scoreGte: 90 });
    expect(() => normalizeCertificationSettings({ evidence: [] })).toThrow("evidence");
    expect(() => normalizeCertificationSettings({ evidence: ["completion"], scoreGte: 90 })).toThrow("Score evidence");
    expect(() => normalizeCertificationSettings({ scoreGte: 101 })).toThrow("between 0 and 100");
    expect(() => normalizeCertificationSettings({ renewal: "weekly" })).toThrow("renewal");
  });

  it("validates rule and course identifiers", () => {
    expect(validateCertificationRuleId("rule-1")).toBe("rule-1");
    expect(normalizeCertificationCourseId("course_1")).toBe("course_1");
    expect(normalizeCertificationCourseId("")).toBeNull();
    expect(() => validateCertificationRuleId("bad id")).toThrow("short identifier");
    expect(() => validateCertificationRuleId("x".repeat(CERTIFICATION_ID_MAX_LENGTH + 1))).toThrow("short identifier");
    expect(() => normalizeCertificationCourseId("bad course")).toThrow("short identifier");
  });
});
