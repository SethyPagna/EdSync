import { describe, expect, it } from "vitest";
import {
  ROLE_PROFILE_DESCRIPTION_MAX_LENGTH,
  ROLE_PROFILE_ID_MAX_LENGTH,
  ROLE_PROFILE_LABEL_MAX_LENGTH,
  makeRoleProfileKey,
  normalizeRoleProfileInput,
  normalizeRoleProfilePermissions,
  validateRoleProfileId,
  validateRoleProfileText,
} from "@/lib/permission-profile-validation";

describe("permission profile validation", () => {
  it("normalizes role profile input", () => {
    expect(
      normalizeRoleProfileInput({
        label: "  Branch Manager ",
        description: "  Manages local users. ",
        permissions: ["users.manage", "reports.view", "users.manage", ""],
        fallbackId: "profile-1",
      }),
    ).toEqual({
      label: "Branch Manager",
      description: "Manages local users.",
      permissions: ["users.manage", "reports.view"],
      profileKey: "branch_manager",
    });
  });

  it("validates role profile ids and text", () => {
    expect(validateRoleProfileId("profile-1")).toBe("profile-1");
    expect(() => validateRoleProfileId("bad id")).toThrow("short identifier");
    expect(() => validateRoleProfileId("x".repeat(ROLE_PROFILE_ID_MAX_LENGTH + 1))).toThrow("short identifier");
    expect(() => validateRoleProfileText("", "Profile label", ROLE_PROFILE_LABEL_MAX_LENGTH)).toThrow("required");
    expect(() => validateRoleProfileText("x".repeat(ROLE_PROFILE_LABEL_MAX_LENGTH + 1), "Profile label", ROLE_PROFILE_LABEL_MAX_LENGTH)).toThrow(
      "characters",
    );
    expect(() =>
      validateRoleProfileText("x".repeat(ROLE_PROFILE_DESCRIPTION_MAX_LENGTH + 1), "Profile description", ROLE_PROFILE_DESCRIPTION_MAX_LENGTH, false),
    ).toThrow("characters");
  });

  it("rejects unknown permissions", () => {
    expect(normalizeRoleProfilePermissions(["learn", "ai.manage"])).toEqual(["learn", "ai.manage"]);
    expect(() => normalizeRoleProfilePermissions(["database.admin"])).toThrow("Unsupported permission");
  });

  it("builds stable role profile keys", () => {
    expect(makeRoleProfileKey("Billing Admin", "id-1")).toBe("billing_admin");
    expect(makeRoleProfileKey("!!!", "id-1")).toBe("profile_id_1");
  });
});
