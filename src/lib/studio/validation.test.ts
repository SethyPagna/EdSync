import { describe, expect, it } from "vitest";
import {
  STUDIO_TITLE_MAX_LENGTH,
  normalizeStudioKind,
  validateStudioJsonObject,
  validateStudioTitle,
} from "@/lib/studio/validation";

describe("Studio validation", () => {
  it("normalizes unsupported or lesson kinds to document storage", () => {
    expect(normalizeStudioKind("lesson")).toBe("doc");
    expect(normalizeStudioKind("unknown")).toBe("doc");
    expect(normalizeStudioKind("slide")).toBe("slide");
  });

  it("validates title boundaries", () => {
    expect(validateStudioTitle("  My Draft  ")).toBe("My Draft");
    expect(() => validateStudioTitle("")).toThrow("Title is required");
    expect(() => validateStudioTitle("x".repeat(STUDIO_TITLE_MAX_LENGTH + 1))).toThrow("characters");
  });

  it("accepts plain objects and rejects oversized content", () => {
    expect(validateStudioJsonObject({ ok: true })).toEqual({ ok: true });
    expect(validateStudioJsonObject(null)).toEqual({});
    expect(() => validateStudioJsonObject({ text: "x".repeat(700_000) })).toThrow("too large");
  });
});
