// @vitest-environment node

import { describe, expect, it } from "vitest";
import { outlineFromText } from "@/lib/compose";
import { moveOutlineSection, removeOutlineSection } from "./model";

describe("outline preview section edits", () => {
  it("keeps question links attached when sections are reordered or removed", () => {
    const outline = outlineFromText("Water\n\n## First\nWater boils.\n\n## Second\nWater freezes.");
    const withQuestion = { ...outline, questions: [{ type: "short" as const, prompt: "Why?", answer: "Heat", section: 0 }] };
    const moved = moveOutlineSection(withQuestion, 0, 1);
    expect(moved.sections[1].heading).toBe(withQuestion.sections[0].heading);
    expect(moved.questions[0].section).toBe(1);
    const removed = removeOutlineSection(moved, 1);
    expect(removed.questions[0].section).toBeUndefined();
  });
});
