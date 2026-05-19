import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_CODE_MAX_LENGTH,
  createOrganizationSlug,
  normalizeOrganizationCode,
  validateOrganizationCode,
} from "@/lib/auth/organization-code";

describe("organization code helpers", () => {
  it("normalizes organization codes and slugs", () => {
    expect(normalizeOrganizationCode("  North Campus! ")).toBe("north-campus");
    expect(createOrganizationSlug("North Campus", "abc123")).toBe("north-campus-abc123");
  });

  it("validates organization lookup codes", () => {
    expect(validateOrganizationCode(" EdSync Academy ")).toBe("edsync-academy");
    expect(() => validateOrganizationCode("!!!")).toThrow("required");
    expect(() => validateOrganizationCode("x".repeat(ORGANIZATION_CODE_MAX_LENGTH + 1))).toThrow("characters");
  });
});
