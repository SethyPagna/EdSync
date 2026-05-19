import { describe, expect, it } from "vitest";
import { isPracticeMode, normalizePracticeMode } from "@/lib/practice/modes";

describe("practice modes", () => {
  it("accepts supported modes", () => {
    expect(isPracticeMode("quiz")).toBe(true);
    expect(isPracticeMode("generated_from_studio")).toBe(true);
  });

  it("rejects unsupported or malformed modes", () => {
    expect(isPracticeMode("speed_run")).toBe(false);
    expect(isPracticeMode(null)).toBe(false);
    expect(isPracticeMode(["quiz"])).toBe(false);
  });

  it("normalizes unsafe values to a stable fallback", () => {
    expect(normalizePracticeMode("exam")).toBe("exam");
    expect(normalizePracticeMode("bad-mode")).toBe("quiz");
    expect(normalizePracticeMode(undefined, "flashcards")).toBe("flashcards");
  });
});
