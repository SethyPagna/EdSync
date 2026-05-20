import { describe, expect, it } from "vitest";
import {
  DESIGN_BLOCKS,
  DESIGN_TEMPLATES,
  LESSON_TEMPLATE_PRESETS,
  SLIDE_THEMES,
  buildLessonDesignPromptContext,
  listLessonTemplateOptions,
  lessonTemplateById,
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
    expect(context.requiredOutput.format).toContain("Studio");
    expect(context.reusableBlocks.some((block) => block.id === "media-safety-check")).toBe(true);
  });

  it("exposes design assets that can be inserted into learning workflows", () => {
    expect(DESIGN_TEMPLATES.some((template) => template.id === "practice-game-card")).toBe(true);
    expect(DESIGN_BLOCKS.some((block) => block.id === "media-safety-check")).toBe(true);
  });

  it("lists compact lesson template options for UI and AI controls", () => {
    const options = listLessonTemplateOptions();

    expect(options).toHaveLength(LESSON_TEMPLATE_PRESETS.length);
    expect(options.every((option) => option.id && option.label && option.themeId)).toBe(true);
    expect(options.find((option) => option.id === "evidence-lab")?.bestFor).toContain("media analysis");
  });
});
