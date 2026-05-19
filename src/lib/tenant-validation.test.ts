import { describe, expect, it } from "vitest";
import {
  TENANT_NAME_MAX_LENGTH,
  TENANT_SLUG_MAX_LENGTH,
  normalizeTenantInput,
  normalizeTenantIsolationMode,
  normalizeTenantPlanTier,
  normalizeTenantSlug,
  validateTenantName,
} from "@/lib/tenant-validation";

describe("tenant validation", () => {
  it("normalizes tenant input", () => {
    expect(
      normalizeTenantInput({
        name: "  North Campus ",
        slug: " North Campus! ",
        planTier: "enterprise",
        isolationMode: "dedicated_d1",
      }),
    ).toEqual({
      name: "North Campus",
      slug: "north-campus",
      planTier: "enterprise",
      isolationMode: "dedicated_d1",
    });
  });

  it("builds a slug from the name when missing", () => {
    expect(normalizeTenantSlug(undefined, "EdSync Academy")).toBe("edsync-academy");
  });

  it("validates tenant names and slugs", () => {
    expect(() => validateTenantName("")).toThrow("required");
    expect(() => validateTenantName("x".repeat(TENANT_NAME_MAX_LENGTH + 1))).toThrow("characters");
    expect(() => normalizeTenantSlug("!!!")).toThrow("required");
    expect(() => normalizeTenantSlug("x".repeat(TENANT_SLUG_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("defaults unsupported plan and isolation values", () => {
    expect(normalizeTenantPlanTier("team")).toBe("team");
    expect(normalizeTenantPlanTier("global")).toBe("solo");
    expect(normalizeTenantIsolationMode("dedicated_d1")).toBe("dedicated_d1");
    expect(normalizeTenantIsolationMode("postgres")).toBe("shared_d1");
  });
});
