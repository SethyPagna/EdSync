import { describe, expect, it } from "vitest";
import {
  EMAIL_MAX_RECIPIENTS,
  EMAIL_SUBJECT_MAX_LENGTH,
  normalizeEmailDisplay,
  validateEmailAddress,
  validateEmailBody,
  validateEmailSubject,
  validateRecipientList,
} from "@/lib/engagement/email-validation";

describe("email validation", () => {
  it("validates email addresses and subject boundaries", () => {
    expect(validateEmailAddress(" USER@example.COM ")).toBe("user@example.com");
    expect(validateEmailSubject("  Class update  ")).toBe("Class update");
    expect(() => validateEmailAddress("bad")).toThrow("valid email");
    expect(() => validateEmailSubject("Hi\r\nBcc:bad@example.com")).toThrow("line breaks");
    expect(() => validateEmailSubject("x".repeat(EMAIL_SUBJECT_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("validates bodies and sender display", () => {
    expect(validateEmailBody(" Hello ")).toBe("Hello");
    expect(normalizeEmailDisplay("", "teacher@example.com")).toBe("teacher@example.com");
    expect(() => validateEmailBody("")).toThrow("required");
    expect(() => normalizeEmailDisplay("Bad\nSender", "teacher@example.com")).toThrow("line breaks");
  });

  it("deduplicates and caps recipient lists", () => {
    expect(validateRecipientList([{ email: "a@example.com" }, { email: "A@example.com" }])).toHaveLength(1);
    expect(() => validateRecipientList([])).toThrow("At least one");
    expect(() =>
      validateRecipientList(Array.from({ length: EMAIL_MAX_RECIPIENTS + 1 }, (_, index) => ({ email: `${index}@example.com` }))),
    ).toThrow("people or fewer");
  });
});
