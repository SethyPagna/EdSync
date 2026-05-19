import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from "@/lib/auth/display-name";

describe("display name validation", () => {
  it("normalizes blank display names to null", () => {
    expect(validateDisplayName("   ")).toBeNull();
    expect(validateDisplayName(undefined)).toBeNull();
  });

  it("trims valid display names", () => {
    expect(validateDisplayName("  Mina Park  ")).toBe("Mina Park");
  });

  it("rejects display names above the maximum length", () => {
    expect(() => validateDisplayName("x".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toThrow(
      "Full name must be 120 characters or fewer.",
    );
  });

  it("rejects multi-line display names", () => {
    expect(() => validateDisplayName("Mina\nBcc: other@example.com")).toThrow("Full name must be a single line.");
  });
});
