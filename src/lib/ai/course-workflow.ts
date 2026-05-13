import { generateAIChat, parseJsonResponse } from "@/lib/ai/chat";

export type CourseWorkflowInput = {
  topic: string;
  audience?: string;
  durationMinutes?: number;
  tone?: string;
  sourceText?: string;
};

export type CourseWorkflowDraft = {
  outline: unknown;
  modules: unknown;
  quiz: unknown;
  rubric: unknown;
  tags: string[];
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

  const outline = await jsonStep(
    "course_workflow.outline",
    "You are a master instructional designer using ADDIE and Bloom's Taxonomy.",
    `Design a ${duration}-minute course on "${topic}" for ${audience}. Include 3-5 modules, learning objectives, estimated time, and prerequisite assumptions.${source}`,
  );
  const modules = await jsonStep(
    "course_workflow.modules",
    "You write polished LMS lesson content that is concise, accurate, accessible, and editable.",
    `Create lesson scripts and activities for this outline, using a ${tone} tone:\n${JSON.stringify(outline)}`,
  );
  const quiz = await jsonStep(
    "course_workflow.quiz",
    "You create assessment questions with plausible distractors and point values.",
    `Create Bloom-balanced quiz and practice questions from these modules. Include points, correct answers, explanations, and difficulty:\n${JSON.stringify(modules)}`,
  );
  const rubric = await jsonStep(
    "course_workflow.rubric",
    "You create teacher-controlled rubrics and feedback criteria.",
    `Create a concise rubric for the course and grading guidance for tasks or discussions:\n${JSON.stringify({ outline, quiz })}`,
  );
  const review = await jsonStep<CourseWorkflowDraft["review"]>(
    "course_workflow.review",
    "You are a learning quality reviewer. Check readability, accessibility, fairness, and hallucination risk.",
    `Review this generated course package and return readability, accessibility, fairness, and publishRecommendation. Always choose review_required unless all issues are minor:\n${JSON.stringify({ outline, modules, quiz, rubric })}`,
  );
  const tags = await jsonStep<string[]>(
    "course_workflow.tags",
    "You generate searchable LMS taxonomy tags.",
    `Return 5-10 concise tags for this course:\n${JSON.stringify({ topic, outline })}`,
  );

  return { outline, modules, quiz, rubric, tags, review };
}
