import { generateAIJson } from "@/lib/ai/chat";
import {
  OUTLINE_SYSTEM_PROMPT,
  buildOutlineUserPrompt,
  deriveLessonDraft,
  derivePracticeItems,
  outlineMaxTokens,
  parseOutline,
  type LessonOutline,
} from "@/lib/compose";
import { buildLessonDesignPromptContext } from "@/lib/learning/design-system";

export type CourseWorkflowInput = {
  topic: string;
  audience?: string;
  durationMinutes?: number;
  tone?: string;
  sourceText?: string;
  designTemplateId?: string;
  practiceMode?: string;
  outputLength?: string;
  userId?: string;
};

export type CourseWorkflowDraft = {
  outline: LessonOutline;
  modules: ReturnType<typeof deriveLessonDraft>["sections"];
  quiz: ReturnType<typeof deriveLessonDraft>["quizQuestions"];
  rubric: { criterion: string; points: number }[];
  tags: string[];
  design: ReturnType<typeof buildLessonDesignPromptContext>;
  practicePlan: { mode: string; targetSeconds: number; retryMissed: true; items: ReturnType<typeof derivePracticeItems> };
  review: {
    readability: string;
    accessibility: string;
    fairness: string;
    publishRecommendation: "review_required" | "ready";
  };
};

function isOutlineShape(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).title === "string" &&
    Array.isArray((value as Record<string, unknown>).sections);
}

export async function generateCourseWorkflow(input: CourseWorkflowInput): Promise<CourseWorkflowDraft> {
  const promptInput = {
    topic: input.topic.trim(),
    sourceText: input.sourceText,
    audience: input.audience,
    style: input.tone,
    sectionCount: input.outputLength === "short" ? 3 : input.outputLength === "long" ? 9 : 5,
    questionCount: input.outputLength === "short" ? 3 : input.outputLength === "long" ? 9 : 5,
  };
  const raw = await generateAIJson({
    feature: "course-workflow-outline",
    userId: input.userId,
    maxTokens: outlineMaxTokens(promptInput),
    temperature: 0.25,
    messages: [
      { role: "system", content: OUTLINE_SYSTEM_PROMPT },
      { role: "user", content: buildOutlineUserPrompt(promptInput) },
    ],
  }, isOutlineShape);
  const { outline, issues } = parseOutline(raw);
  const draft = deriveLessonDraft(outline);
  const practiceItems = derivePracticeItems(outline);
  const reviewRequired = issues.length > 0 || !draft.sections.length || draft.quizQuestions.length < 2 ||
    outline.questions.some((question) => question.placeholder);
  const criterionPoints = Math.floor(100 / Math.max(1, outline.objectives.length));
  return {
    outline,
    modules: draft.sections,
    quiz: draft.quizQuestions,
    rubric: outline.objectives.map((criterion, index) => ({ criterion, points: index === outline.objectives.length - 1 ? 100 - criterionPoints * index : criterionPoints })),
    tags: draft.lesson.tags,
    design: buildLessonDesignPromptContext(input.designTemplateId, input.outputLength),
    practicePlan: {
      mode: input.practiceMode?.trim() || "quiz",
      targetSeconds: Math.max(300, Math.min(7200, Math.round(Number(input.durationMinutes) || 45) * 60)),
      retryMissed: true,
      items: practiceItems,
    },
    review: {
      readability: "Review age level and clarity before publishing.",
      accessibility: "Check media descriptions and keyboard access in the final layout.",
      fairness: "Check examples and answer choices for bias.",
      publishRecommendation: reviewRequired ? "review_required" : "ready",
    },
  };
}
