import { generateAIChat, parseJsonResponse } from "@/lib/ai/chat";
import { buildLessonDesignPromptContext } from "@/lib/learning/design-system";

export type CourseWorkflowInput = {
  topic: string;
  audience?: string;
  durationMinutes?: number;
  tone?: string;
  sourceText?: string;
  designTemplateId?: string;
  practiceMode?: string;
};

export type CourseWorkflowDraft = {
  outline: unknown;
  modules: unknown;
  quiz: unknown;
  rubric: unknown;
  tags: string[];
  design: unknown;
  practicePlan: unknown;
  review: {
    readability: string;
    accessibility: string;
    fairness: string;
    publishRecommendation: "review_required" | "ready";
  };
};

async function jsonStep<T>(feature: string, system: string, user: string) {
  const raw = await generateAIChat({
    feature,
    temperature: 0.2,
    maxTokens: 1800,
    messages: [
      { role: "system", content: `${system}\nReturn only valid compact JSON.` },
      { role: "user", content: user },
    ],
  });
  return parseJsonResponse<T>(raw);
}

export async function generateCourseWorkflow(input: CourseWorkflowInput): Promise<CourseWorkflowDraft> {
  const topic = input.topic.trim();
  const audience = input.audience?.trim() || "mixed learners";
  const duration = Math.max(5, Number(input.durationMinutes || 45));
  const tone = input.tone?.trim() || "clear, professional, encouraging";
  const source = input.sourceText ? `\nSource context:\n${input.sourceText.slice(0, 6000)}` : "";
  const designContext = buildLessonDesignPromptContext(input.designTemplateId);
  const practiceMode = input.practiceMode?.trim() || "mixed quiz, flashcards, retry missed, and sprint";

  const outline = await jsonStep(
    "course_workflow.outline",
    "You are a master instructional designer using ADDIE and Bloom's Taxonomy.",
    `Design a ${duration}-minute course on "${topic}" for ${audience}. Include 3-5 modules, learning objectives, estimated time, prerequisite assumptions, and where practice should happen.${source}`,
  );
  const design = await jsonStep(
    "course_workflow.design",
    "You are an LMS-native lesson designer. Create accessible editable slide and section design specs, not static images.",
    `Use this EdSync design system context to plan lesson templates, colors, layout, transitions, animations, and reduced-motion behavior:\n${JSON.stringify(designContext)}\n\nCourse outline:\n${JSON.stringify(outline)}`,
  );
  const modules = await jsonStep(
    "course_workflow.modules",
    "You write polished LMS lesson content that is concise, accurate, accessible, editable, and compatible with Studio blocks.",
    `Create lesson scripts, slide-ready sections, media notes, teacher review flags, and activity blocks for this outline, using a ${tone} tone and this design spec:\n${JSON.stringify({ outline, design })}`,
  );
  const practicePlan = await jsonStep(
    "course_workflow.practice_plan",
    "You design learning practice loops with target time, points, explanations, retry missed, and review-card output.",
    `Create a ${practiceMode} practice plan from these modules. Include mode, targetSeconds, points, explanations, retryMissed, reviewCards, and dashboardRecommendation:\n${JSON.stringify(modules)}`,
  );
  const quiz = await jsonStep(
    "course_workflow.quiz",
    "You create assessment questions with plausible distractors and point values.",
    `Create Bloom-balanced quiz and practice questions from these modules and practice plan. Include points, correct answers, explanations, difficulty, and which practice mode should use each item:\n${JSON.stringify({ modules, practicePlan })}`,
  );
  const rubric = await jsonStep(
    "course_workflow.rubric",
    "You create teacher-controlled rubrics and feedback criteria.",
    `Create a concise rubric for the course and grading guidance for tasks or discussions:\n${JSON.stringify({ outline, quiz })}`,
  );
  const review = await jsonStep<CourseWorkflowDraft["review"]>(
    "course_workflow.review",
    "You are a learning quality reviewer. Check readability, accessibility, fairness, and hallucination risk.",
    `Review this generated course package and return readability, accessibility, fairness, and publishRecommendation. Check visual contrast, reduced-motion fallback, media/link safety notes, quiz clarity, and teacher control. Always choose review_required unless all issues are minor:\n${JSON.stringify({ outline, design, modules, practicePlan, quiz, rubric })}`,
  );
  const tags = await jsonStep<string[]>(
    "course_workflow.tags",
    "You generate searchable LMS taxonomy tags.",
    `Return 5-10 concise tags for this course:\n${JSON.stringify({ topic, outline })}`,
  );

  return { outline, modules, quiz, rubric, tags, design, practicePlan, review };
}
