import { describe, expect, it } from "vitest";
import {
  DISCUSSION_POST_MAX_LENGTH,
  DISCUSSION_TITLE_MAX_LENGTH,
  validateDiscussionText,
} from "@/lib/discussions/validation";

describe("discussion validation", () => {
  it("trims and returns valid text", () => {
    expect(validateDiscussionText("  Weekly reflection  ", "Title", DISCUSSION_TITLE_MAX_LENGTH)).toBe("Weekly reflection");
  });

  it("requires text when configured", () => {
    expect(() => validateDiscussionText("", "Post body", DISCUSSION_POST_MAX_LENGTH)).toThrow("Post body is required");
    expect(validateDiscussionText("", "Prompt", DISCUSSION_POST_MAX_LENGTH, false)).toBe("");
  });

  it("rejects oversized text", () => {
    expect(() => validateDiscussionText("x".repeat(DISCUSSION_TITLE_MAX_LENGTH + 1), "Title", DISCUSSION_TITLE_MAX_LENGTH)).toThrow("characters");
  });
});
