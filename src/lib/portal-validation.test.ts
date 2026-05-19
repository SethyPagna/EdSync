import { describe, expect, it } from "vitest";
import {
  PORTAL_ID_MAX_LENGTH,
  PORTAL_NAME_MAX_LENGTH,
  PORTAL_SLUG_MAX_LENGTH,
  normalizePortalAudience,
  normalizePortalDomain,
  normalizePortalInput,
  normalizePortalSlug,
  validatePortalId,
  validatePortalName,
} from "@/lib/portal-validation";

describe("portal validation", () => {
  it("normalizes portal input", () => {
    expect(
      normalizePortalInput({
        name: "  Customer Academy ",
        slug: " Customer Academy! ",
        audience: "public",
        domain: " Portal.Example.COM ",
        catalogEnabled: true,
        featuredOnly: true,
      }),
    ).toEqual({
      name: "Customer Academy",
      slug: "customer-academy",
      audience: "public",
      domain: "portal.example.com",
      catalogSettings: {
        enabled: true,
        featuredOnly: true,
      },
    });
  });

  it("builds a slug from the portal name when missing", () => {
    expect(normalizePortalSlug(undefined, "North Campus Portal")).toBe("north-campus-portal");
  });

  it("validates portal ids, names, and slugs", () => {
    expect(validatePortalId("portal-1")).toBe("portal-1");
    expect(() => validatePortalId("bad id")).toThrow("short identifier");
    expect(() => validatePortalId("x".repeat(PORTAL_ID_MAX_LENGTH + 1))).toThrow("short identifier");
    expect(() => validatePortalName("")).toThrow("required");
    expect(() => validatePortalName("x".repeat(PORTAL_NAME_MAX_LENGTH + 1))).toThrow("characters");
    expect(() => normalizePortalSlug("!!!")).toThrow("required");
    expect(() => normalizePortalSlug("x".repeat(PORTAL_SLUG_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("defaults unsupported audiences", () => {
    expect(normalizePortalAudience("customer")).toBe("customer");
    expect(normalizePortalAudience("global")).toBe("internal");
  });

  it("validates portal hostnames", () => {
    expect(normalizePortalDomain("School.Example.com")).toBe("school.example.com");
    expect(normalizePortalDomain("ed-sync.org")).toBe("ed-sync.org");
    expect(normalizePortalDomain("")).toBeNull();
    expect(() => normalizePortalDomain("https://bad.example.com")).toThrow("valid hostname");
    expect(() => normalizePortalDomain("bad_domain.example.com")).toThrow("valid hostname");
    expect(() => normalizePortalDomain("localhost")).toThrow("valid hostname");
    expect(() => normalizePortalDomain("bad..example.com")).toThrow("valid hostname");
    expect(() => normalizePortalDomain("-bad.example.com")).toThrow("valid hostname");
  });
});
