import { describe, expect, it } from "vitest";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  validateLoginPassword,
  validateSignupPassword,
} from "@/lib/auth/password-validation";

describe("auth password validation", () => {
  it("accepts signup passwords at the minimum boundary", () => {
    const password = "x".repeat(AUTH_PASSWORD_MIN_LENGTH);

    expect(validateSignupPassword(password)).toBe(password);
  });

  it("rejects signup passwords below the minimum boundary", () => {
    expect(() => validateSignupPassword("x".repeat(AUTH_PASSWORD_MIN_LENGTH - 1))).toThrow(
      "Password must be at least 8 characters.",
    );
  });

  it("accepts login passwords below the signup minimum so credentials can fail normally", () => {
    expect(validateLoginPassword("short")).toBe("short");
  });

  it("rejects login passwords above the maximum boundary", () => {
    expect(() => validateLoginPassword("x".repeat(AUTH_PASSWORD_MAX_LENGTH + 1))).toThrow(
      "Password must be 256 characters or fewer.",
    );
  });
});
