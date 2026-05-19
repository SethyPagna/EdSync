import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAG_DESCRIPTION_MAX_LENGTH,
  FEATURE_FLAG_ID_MAX_LENGTH,
  FEATURE_FLAG_KEY_MAX_LENGTH,
  FEATURE_FLAG_LABEL_MAX_LENGTH,
  normalizeFeatureFlagAudience,
  normalizeFeatureFlagInput,
  normalizeFeatureFlagKey,
  validateFeatureFlagId,
  validateFeatureFlagText,
} from "@/lib/admin-settings-validation";

describe("admin settings validation", () => {
  it("normalizes feature flag input", () => {
    expect(
      normalizeFeatureFlagInput({
        flagKey: " AI Provider Fallback ",
        label: "  Smart AI ",
        description: "  Fallback providers. ",
        enabled: 1,
        audience: "teacher",
      }),
    ).toEqual({
      flagKey: "ai_provider_fallback",
      label: "Smart AI",
      description: "Fallback providers.",
      enabled: true,
      audience: "teacher",
    });
  });

  it("validates flag ids and keys", () => {
    expect(validateFeatureFlagId("flag-1")).toBe("flag-1");
    expect(() => validateFeatureFlagId("")).toThrow("required");
    expect(() => validateFeatureFlagId("bad id")).toThrow("short identifier");
    expect(() => validateFeatureFlagId("x".repeat(FEATURE_FLAG_ID_MAX_LENGTH + 1))).toThrow("short identifier");
    expect(normalizeFeatureFlagKey("Teacher tools!")).toBe("teacher_tools");
    expect(() => normalizeFeatureFlagKey("!")).toThrow("required");
    expect(() => normalizeFeatureFlagKey("x".repeat(FEATURE_FLAG_KEY_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("validates labels and descriptions", () => {
    expect(validateFeatureFlagText("  Label ", "Flag label", FEATURE_FLAG_LABEL_MAX_LENGTH)).toBe("Label");
    expect(() => validateFeatureFlagText("", "Flag label", FEATURE_FLAG_LABEL_MAX_LENGTH)).toThrow("required");
    expect(() => validateFeatureFlagText("x".repeat(FEATURE_FLAG_LABEL_MAX_LENGTH + 1), "Flag label", FEATURE_FLAG_LABEL_MAX_LENGTH)).toThrow(
      "characters",
    );
    expect(() =>
      validateFeatureFlagText("x".repeat(FEATURE_FLAG_DESCRIPTION_MAX_LENGTH + 1), "Flag description", FEATURE_FLAG_DESCRIPTION_MAX_LENGTH, false),
    ).toThrow("characters");
  });

  it("defaults unsupported audiences", () => {
    expect(normalizeFeatureFlagAudience("admin")).toBe("admin");
    expect(normalizeFeatureFlagAudience("owner")).toBe("all");
  });
});
