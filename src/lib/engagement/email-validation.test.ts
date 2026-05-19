import { describe, expect, it } from "vitest";
import {
  EMAIL_ADDRESS_MAX_LENGTH,
  EMAIL_ID_MAX_LENGTH,
  EMAIL_MAX_RECIPIENTS,
  EMAIL_METADATA_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
  normalizeEmailDisplay,
  normalizeEmailMetadata,
  normalizeOptionalEmailRecordId,
  validateEmailAddress,
  validateEmailBody,
  validateEmailHtml,
  validateEmailRecordId,
  validateEmailSubject,
  validateRecipientList,
} from "@/lib/engagement/email-validation";

describe("email validation", () => {
  it("validates email addresses and subject boundaries", () => {
    expect(validateEmailAddress(" USER@example.COM ")).toBe("user@example.com");
    expect(validateEmailSubject("  Class update  ")).toBe("Class update");
    expect(() => validateEmailAddress("bad")).toThrow("valid email");
    expect(() => validateEmailAddress(`${"x".repeat(EMAIL_ADDRESS_MAX_LENGTH)}@example.com`)).toThrow("characters");
    expect(() => validateEmailSubject("Hi\r\nBcc:bad@example.com")).toThrow("line breaks");
    expect(() => validateEmailSubject("x".repeat(EMAIL_SUBJECT_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("validates bodies and sender display", () => {
    expect(validateEmailBody(" Hello ")).toBe("Hello");
    expect(validateEmailHtml("<p>Hello</p>")).toBe("<p>Hello</p>");
    expect(validateEmailHtml("")).toBeNull();
    expect(normalizeEmailDisplay("", "teacher@example.com")).toBe("teacher@example.com");
    expect(() => validateEmailBody("")).toThrow("required");
    expect(() => validateEmailHtml('<img src="x" onerror="alert(1)" />')).toThrow("unsupported markup");
    expect(() => validateEmailHtml('<a href="javascript:alert(1)">Open</a>')).toThrow("unsupported markup");
    expect(() => normalizeEmailDisplay("Bad\nSender", "teacher@example.com")).toThrow("line breaks");
  });

  it("validates ids and metadata", () => {
    expect(validateEmailRecordId("class-1", "Class")).toBe("class-1");
    expect(normalizeOptionalEmailRecordId("", "Class")).toBeNull();
    expect(normalizeEmailMetadata({ sentBy: "teacher-1" })).toEqual({ sentBy: "teacher-1" });
    expect(() => validateEmailRecordId("bad id", "Class")).toThrow("short identifier");
    expect(() => validateEmailRecordId("x".repeat(EMAIL_ID_MAX_LENGTH + 1), "Class")).toThrow("short identifier");
    expect(() => normalizeEmailMetadata([])).toThrow("JSON object");
    expect(() => normalizeEmailMetadata({ value: "x".repeat(EMAIL_METADATA_MAX_LENGTH + 1) })).toThrow("characters");
  });

  it("deduplicates and caps recipient lists", () => {
    expect(validateRecipientList([{ email: "a@example.com" }, { email: "A@example.com" }])).toHaveLength(1);
    expect(() => validateRecipientList([])).toThrow("At least one");
    expect(() =>
      validateRecipientList(Array.from({ length: EMAIL_MAX_RECIPIENTS + 1 }, (_, index) => ({ email: `${index}@example.com` }))),
    ).toThrow("people or fewer");
  });
});
