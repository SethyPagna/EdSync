import { describe, expect, it } from "vitest";
import {
  normalizeAccountType,
  normalizeOrganizationMode,
  normalizeSignupRole,
  normalizeUserRole,
} from "@/lib/auth/roles";

describe("auth roles", () => {
  it("normalizes supported user roles", () => {
    expect(normalizeUserRole("admin")).toBe("admin");
    expect(normalizeUserRole("teacher")).toBe("teacher");
    expect(normalizeUserRole("student")).toBe("student");
    expect(normalizeUserRole("owner")).toBeNull();
    expect(normalizeUserRole(null)).toBeNull();
  });

  it("normalizes signup roles without allowing admin self-signup", () => {
    expect(normalizeSignupRole("teacher")).toBe("teacher");
    expect(normalizeSignupRole("student")).toBe("student");
    expect(normalizeSignupRole("admin")).toBeNull();
    expect(normalizeSignupRole(undefined)).toBeNull();
  });

  it("normalizes explicit account entry choices", () => {
    expect(normalizeAccountType("individual")).toBe("individual");
    expect(normalizeAccountType("organization")).toBe("organization");
    expect(normalizeAccountType("school")).toBeNull();
    expect(normalizeAccountType(undefined)).toBeNull();
  });

  it("normalizes explicit organization entry modes", () => {
    expect(normalizeOrganizationMode("join")).toBe("join");
    expect(normalizeOrganizationMode("create")).toBe("create");
    expect(normalizeOrganizationMode("invite")).toBeNull();
    expect(normalizeOrganizationMode(null)).toBeNull();
  });
});
