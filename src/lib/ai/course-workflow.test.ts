import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCourseWorkflow } from "@/lib/ai/course-workflow";
import { generateAIChat } from "@/lib/ai/chat";

vi.mock("@/lib/ai/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/chat")>("@/lib/ai/chat");
  return {
    ...actual,
    generateAIChat: vi.fn(),
  };
});

const generateAIChatMock = vi.mocked(generateAIChat);

function jsonForFeature(feature: string) {
  if (feature === "course_workflow.review") {
    return JSON.stringify({
      readability: "clear",
      accessibility: "needs alt text check",
      fairness: "review examples",
      publishRecommendation: "review_required",
    });
  }
  if (feature === "course_workflow.tags") {
    return JSON.stringify(["energy", "science", "practice"]);
  }
  return JSON.stringify({ feature, modules: [{ title: "Module 1" }] });
}

describe("generateCourseWorkflow", () => {
  beforeEach(() => {
    generateAIChatMock.mockReset();
    generateAIChatMock.mockImplementation(async ({ feature }) => jsonForFeature(feature ?? ""));
  });

  it("passes template, output length, tools, and practice expectations into AI steps", async () => {
    await generateCourseWorkflow({
      topic: "Energy transfer",
      audience: "Grade 8 science",
      durationMinutes: 35,
      designTemplateId: "exam-prep",
      outputLength: "extended",
      practiceMode: "exam and mistake retry",
    });

    const calls = generateAIChatMock.mock.calls.map(([input]) => input);
    const outlinePrompt = calls.find((call) => call.feature === "course_workflow.outline")?.messages.at(-1)?.content ?? "";
    const modulePrompt = calls.find((call) => call.feature === "course_workflow.modules")?.messages.at(-1)?.content ?? "";
    const practicePrompt = calls.find((call) => call.feature === "course_workflow.practice_plan")?.messages.at(-1)?.content ?? "";

    expect(outlinePrompt).toContain('"id":"extended"');
    expect(outlinePrompt).toContain("10-14 slides");
    expect(modulePrompt).toContain("toolGroups");
    expect(modulePrompt).toContain("ai-practice-loop");
    expect(practicePrompt).toContain("10-16 questions");
    expect(practicePrompt).toContain("exam and mistake retry");
  });
});
