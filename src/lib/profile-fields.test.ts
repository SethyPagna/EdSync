import { describe, expect, it } from "vitest";
import {
  PROFILE_LIST_MAX_ITEMS,
  PROFILE_TEXT_MAX_LENGTH,
  validateGradeLevel,
  validateInterestAreas,
  validateOptionalProfileLine,
  validateSubjectAreas,
} from "@/lib/profile-fields";

describe("profile field validation", () => {
  it("normalizes optional single-line text", () => {
    expect(validateOptionalProfileLine("  EdSync Academy  ", "School")).toBe("EdSync Academy");
    expect(validateOptionalProfileLine("   ", "School")).toBeNull();
  });

  it("rejects unsafe or oversized single-line text", () => {
    expect(() => validateOptionalProfileLine("School\nInjected", "School")).toThrow(
      "School must be a single line.",
    );
    expect(() => validateOptionalProfileLine("x".repeat(PROFILE_TEXT_MAX_LENGTH + 1), "School")).toThrow(
      `School must be ${PROFILE_TEXT_MAX_LENGTH} characters or fewer.`,
    );
  });

  it("accepts only supported grade levels", () => {
    expect(validateGradeLevel(" Grade 8 ")).toBe("Grade 8");
    expect(validateGradeLevel("")).toBeNull();
    expect(() => validateGradeLevel("Grade 99")).toThrow("Choose a supported grade level.");
  });

  it("deduplicates supported subjects", () => {
    expect(validateSubjectAreas(["Science", "Science", "Mathematics"])).toEqual([
      "Science",
      "Mathematics",
    ]);
  });

  it("rejects unsupported or excessive list items", () => {
    expect(() => validateSubjectAreas(["Science", "Unknown"])).toThrow(
      "Subjects contains an unsupported item.",
    );
    expect(() => validateInterestAreas(Array(PROFILE_LIST_MAX_ITEMS + 1).fill("Sports"))).toThrow(
      `Interests can include at most ${PROFILE_LIST_MAX_ITEMS} items.`,
    );
  });
});
