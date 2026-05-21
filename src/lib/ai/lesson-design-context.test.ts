import { describe, expect, it } from "vitest";
import {
  buildCreateLessonDesignInstruction,
  outputLengthFromGenerationDepth,
} from "@/lib/ai/lesson-design-context";

describe("lesson design context", () => {
  it("maps teacher depth controls to lesson output lengths", () => {
    expect(outputLengthFromGenerationDepth("quick")).toBe("micro");
    expect(outputLengthFromGenerationDepth("standard")).toBe("standard");
    expect(outputLengthFromGenerationDepth("zero_to_expert")).toBe("extended");
    expect(outputLengthFromGenerationDepth("unknown")).toBe("standard");
  });

  it("builds create-lesson instructions with template, motion, practice, and review context", () => {
    const { designContext, instruction } = buildCreateLessonDesignInstruction({
      designTemplateId: "exam-prep",
      depth: "zero_to_expert",
    });

    expect(designContext.template.id).toBe("exam-prep");
    expect(designContext.outputLength.id).toBe("extended");
    expect(instruction).toContain("Default transition: zoom");
    expect(instruction).toContain("default animation: highlight");
    expect(instruction).toContain("Practice modes:");
    expect(instruction).toContain("reduced-motion-safe");
  });
});
