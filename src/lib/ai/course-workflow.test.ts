// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { generateAIJson } from "@/lib/ai/chat";
import { outlineFromText } from "@/lib/compose";
import { generateCourseWorkflow } from "./course-workflow";

vi.mock("@/lib/ai/chat", () => ({ generateAIJson: vi.fn() }));

describe("course workflow", () => {
  it("uses one outline call and derives the rest without additional AI requests", async () => {
    vi.mocked(generateAIJson).mockResolvedValueOnce(outlineFromText("Water cycle\n\n## Evaporation\nHeat turns water into vapor.\n\n## Condensation\nCooling turns vapor into droplets."));
    const draft = await generateCourseWorkflow({ topic: "Water cycle", audience: "Grade 5", userId: "teacher-1" });
    expect(generateAIJson).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateAIJson).mock.calls[0][0]).toMatchObject({ userId: "teacher-1", feature: "course-workflow-outline" });
    expect(draft.outline.title).toBe("Water cycle");
    expect(draft.modules.length).toBeGreaterThan(0);
    expect(draft.rubric.reduce((sum, row) => sum + row.points, 0)).toBe(100);
    expect(draft.practicePlan.retryMissed).toBe(true);
  });
});
