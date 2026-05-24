import { describe, expect, it } from "vitest";
import {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_DESIGN_TOOL_GROUPS,
  LESSON_OUTPUT_LENGTHS,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
  buildLessonDesignPromptContext,
  listLessonTemplateOptions,
  lessonTemplateById,
  resolveLessonOutputLength,
} from "@/lib/learning/design-system";

describe("lesson design system", () => {
  it("resolves known templates and falls back predictably", () => {
    expect(lessonTemplateById("evidence-lab").label).toBe("Evidence Lab");
    expect(lessonTemplateById("unknown").id).toBe(LESSON_TEMPLATE_PRESETS[0].id);
  });

  it("keeps every template connected to an existing slide theme", () => {
    const themeIds = new Set(SLIDE_THEMES.map((theme) => theme.id));

    LESSON_TEMPLATE_PRESETS.forEach((template) => {
      expect(themeIds.has(template.themeId)).toBe(true);
    });
  });

  it("builds AI prompt context with templates, themes, motion, and required output", () => {
    const context = buildLessonDesignPromptContext("kid-friendly");

    expect(context.template.id).toBe("kid-friendly");
    expect(context.theme.id).toBe("warm-workshop");
    expect(context.allowedTransitions).toContain("slide_left");
    expect(context.allowedAnimations).toContain("scale");
    expect(context.requiredOutput.practice).toContain("retry-missed");
    expect(context.requiredOutput.format).toContain("docs");
    expect(context.reusableBlocks.some((block) => block.id === "media-safety-check")).toBe(true);
    expect(context.toolGroups.some((group) => group.id === "motion")).toBe(true);
  });

  it("exposes design assets that can be inserted into learning workflows", () => {
    expect(DESIGN_TEMPLATES.some((template) => template.id === "practice-game-card")).toBe(true);
    expect(DESIGN_TEMPLATES.some((template) => template.id === "animation-pack")).toBe(true);
    expect(DESIGN_BLOCKS.some((block) => block.id === "media-safety-check")).toBe(true);
    expect(DESIGN_BLOCKS.some((block) => block.id === "ai-practice-loop")).toBe(true);
  });

  it("lists compact lesson template options for UI and AI controls", () => {
    const options = listLessonTemplateOptions();

    expect(options).toHaveLength(LESSON_TEMPLATE_PRESETS.length);
    expect(options.every((option) => option.id && option.label && option.themeId)).toBe(true);
    expect(options.find((option) => option.id === "evidence-lab")?.bestFor).toContain("media analysis");
  });

  it("supports output length controls for AI lesson generation", () => {
    const context = buildLessonDesignPromptContext("exam-prep", "extended");

    expect(resolveLessonOutputLength("tiny")).toBe("standard");
    expect(context.outputLength.id).toBe("extended");
    expect(context.outputLength.slideCount).toBe(LESSON_OUTPUT_LENGTHS.extended.slideCount);
    expect(context.requiredOutput.aiInstruction).toContain("differentiation");
  });

  it("keeps every tool group compact and connected to a visible authoring need", () => {
    expect(LESSON_DESIGN_TOOL_GROUPS.length).toBeGreaterThanOrEqual(6);
    expect(LESSON_DESIGN_TOOL_GROUPS.every((group) => group.tools.length >= 4)).toBe(true);
    expect(LESSON_DESIGN_TOOL_GROUPS.find((group) => group.id === "practice")?.tools).toContain("retry missed");
  });
});
