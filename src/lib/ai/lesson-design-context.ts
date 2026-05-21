import {
  buildLessonDesignPromptContext,
  type LessonOutputLength,
} from "@/lib/learning/design-system";

export type LessonGenerationDepth = "quick" | "standard" | "zero_to_expert";

export function outputLengthFromGenerationDepth(depth: unknown): LessonOutputLength {
  if (depth === "quick") return "micro";
  if (depth === "zero_to_expert") return "extended";
  return "standard";
}

export function buildCreateLessonDesignInstruction({
  designTemplateId,
  outputLength,
  depth,
}: {
  designTemplateId?: string;
  outputLength?: string;
  depth?: LessonGenerationDepth | string;
}) {
  const resolvedLength = outputLength || outputLengthFromGenerationDepth(depth);
  const designContext = buildLessonDesignPromptContext(designTemplateId, resolvedLength);

  return {
    designContext,
    instruction: [
      "Design system:",
      `- Template: ${designContext.template.label} (${designContext.template.id})`,
      `- Theme: ${designContext.theme.name}`,
      `- Output length: ${designContext.outputLength.label} (${designContext.outputLength.slideCount}; ${designContext.outputLength.practiceCount})`,
      `- Default transition: ${designContext.template.transition}; default animation: ${designContext.template.animation}`,
      `- Design notes: ${designContext.template.designNotes.join(" ")}`,
      `- Practice modes: ${designContext.template.practiceModes.join(", ")}`,
      `- Review signals: ${designContext.template.reviewSignals.join(", ")}`,
      "- Each lesson section should include editable Studio-friendly HTML, media/link safety notes when relevant, transition/animation suggestions in plain text, and a quick practice/review action.",
      "- Keep motion reduced-motion-safe and never require animation to understand the content.",
    ].join("\n"),
  };
}
