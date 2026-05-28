import { describe, expect, it } from "vitest";
import {
  ADMIN_USER_ID_MAX_LENGTH,
  ADMIN_USER_SEARCH_MAX_LENGTH,
  normalizeAdminToggle,
  normalizeAdminUserPatch,
  normalizeAdminUserSearch,
  validateAdminUserId,
} from "@/lib/validation/admin-users";

describe("admin user validation", () => {
  it("normalizes admin user patch payloads", () => {
    expect(normalizeAdminUserPatch({ userId: " user-1 ", admin: true })).toEqual({
      userId: "user-1",
      admin: true,
    });
    expect(normalizeAdminUserPatch({ userId: "user-1", admin: false })).toEqual({
      userId: "user-1",
      admin: false,
    });
  });

  it("validates user ids", () => {
    expect(validateAdminUserId("user_1")).toBe("user_1");
    expect(() => validateAdminUserId("")).toThrow("required");
    expect(() => validateAdminUserId("bad id")).toThrow("short identifier");
    expect(() => validateAdminUserId("x".repeat(ADMIN_USER_ID_MAX_LENGTH + 1))).toThrow("short identifier");
  });

  it("validates admin toggles", () => {
    expect(normalizeAdminToggle(true)).toBe(true);
    expect(normalizeAdminToggle(false)).toBe(false);
    expect(() => normalizeAdminToggle("true")).toThrow("true or false");
    expect(() => normalizeAdminToggle(undefined)).toThrow("true or false");
  });

  it("bounds search text", () => {
    expect(normalizeAdminUserSearch(" Mina@Example.COM ")).toBe("mina@example.com");
    expect(() => normalizeAdminUserSearch("x".repeat(ADMIN_USER_SEARCH_MAX_LENGTH + 1))).toThrow("characters");
  });
});
