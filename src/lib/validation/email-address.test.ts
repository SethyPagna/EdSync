import { describe, expect, it } from "vitest";
import { EMAIL_ADDRESS_MAX_LENGTH, validateEmailAddress } from "@/lib/validation/email-address";

describe("email address validation", () => {
  it("normalizes valid email addresses", () => {
    expect(validateEmailAddress("  Teacher@Example.COM ")).toBe("teacher@example.com");
  });

  it("rejects missing, malformed, dangerous, and overlong email addresses", () => {
    expect(() => validateEmailAddress("")).toThrow("required");
    expect(() => validateEmailAddress("bad")).toThrow("valid email");
    expect(() => validateEmailAddress("name@example.com\r\nbcc:bad@example.com")).toThrow("valid email");
    expect(() => validateEmailAddress(`${"x".repeat(EMAIL_ADDRESS_MAX_LENGTH)}@example.com`)).toThrow("characters");
  });
});
