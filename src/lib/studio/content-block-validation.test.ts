import { describe, expect, it } from "vitest";
import {
  normalizeContentBlockStatus,
  normalizeContentBlockTags,
  normalizeContentBlockType,
  validateContentBlockData,
  validateContentBlockTitle,
} from "@/lib/studio/content-block-validation";

describe("content block validation", () => {
  it("normalizes block types and statuses", () => {
    expect(normalizeContentBlockType("slide_deck")).toBe("slide_deck");
    expect(normalizeContentBlockType("unknown")).toBe("rich_text");
    expect(normalizeContentBlockStatus("published")).toBe("published");
    expect(normalizeContentBlockStatus("deleted")).toBe("draft");
  });

  it("cleans, de-duplicates, and limits tags", () => {
    expect(normalizeContentBlockTags(["Studio", "Studio", "Lesson Plan!", "", "A".repeat(80)])).toEqual([
      "studio",
      "lesson-plan-",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ]);
    expect(normalizeContentBlockTags(Array.from({ length: 20 }, (_, index) => `tag-${index}`))).toHaveLength(12);
  });

  it("validates titles and data boundaries", () => {
    expect(validateContentBlockTitle("  Activity Card  ")).toBe("Activity Card");
    expect(validateContentBlockData({ html: "<p>ok</p>" })).toEqual({ html: "<p>ok</p>" });
    expect(() => validateContentBlockTitle("")).toThrow("Title is required");
    expect(() => validateContentBlockData({ text: "x".repeat(700_000) })).toThrow("too large");
  });
});
