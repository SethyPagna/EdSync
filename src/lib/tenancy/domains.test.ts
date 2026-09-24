import { describe, expect, it } from "vitest";
import {
  normalizeRequestHost,
  portalAddress,
  portalBaseDomain,
  portalFromHostname,
  portalSubdomain,
} from "./domains";

describe("portal addresses", () => {
  it("works without buying a domain", () => {
    expect(portalAddress("school", "main", null)).toEqual({
      path: "/org/main?tenant=school",
      subdomain: "school--main",
      hostname: null,
      ready: false,
    });
  });
  it("resolves exactly one registered-domain label", () => {
    expect(
      portalFromHostname("School--Main.example.com:443", "example.com"),
    ).toEqual({ tenantSlug: "school", portalSlug: "main" });
    for (const host of [
      "school--main.example.com.evil.test",
      "a.school--main.example.com",
      "school--main--extra.example.com",
      "example.com",
      "example.com,evil.test",
    ])
      expect(portalFromHostname(host, "example.com")).toBeNull();
  });
  it("rejects ambiguous and oversized labels", () => {
    expect(portalSubdomain("school--other", "main")).toBeNull();
    expect(portalSubdomain("a".repeat(60), "main")).toBeNull();
    expect(portalBaseDomain("https://example.com/path")).toBeNull();
    expect(normalizeRequestHost("example.com:443")).toBe("example.com");
    expect(normalizeRequestHost("[::1]:3000")).toBe("::1");
    expect(normalizeRequestHost("good.test, evil.test")).toBe("");
  });
});
