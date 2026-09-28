import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerQuestion } from "@/lib/lessons/quiz";
import { allAnswered, checkAnswer, loadQuestions, questionsForSection, saveProgress, submitFinal } from "./api";

const choice: PlayerQuestion = {
  id: "q1", sectionId: "s1", type: "mcq", prompt: "What changed?",
  options: [{ id: "a", text: "First" }, { id: "b", text: "Second" }],
  points: 2, isFinal: false, order: 0,
};

afterEach(() => vi.unstubAllGlobals());

describe("lesson player API", () => {
  it("only treats nonblank answers as ready, including multi-select answers", () => {
    const multi: PlayerQuestion = { ...choice, id: "q2", type: "multi" };
    expect(allAnswered([choice, multi], { q1: "a", q2: [] })).toBe(false);
    expect(allAnswered([choice, multi], { q1: " ", q2: ["a"] })).toBe(false);
    expect(allAnswered([choice, multi], { q1: "a", q2: ["a", "b"] })).toBe(true);
    expect(allAnswered([], {})).toBe(false);
    expect(questionsForSection([choice, { ...multi, isFinal: true }, { ...choice, id: "q3", purpose: "diagnostic" }], "s1")).toEqual([choice]);
  });

  it("loads only the answer-free quiz contract and uses the section check endpoint", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { questions: [choice] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { correct: true, correctOptionIds: ["a"] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadQuestions("lesson/1")).toEqual([choice]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lessons/lesson%2F1/quiz");
    expect(await checkAnswer("lesson/1", "q1", "a")).toEqual({ correct: true, correctOptionIds: ["a"] });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/lessons/lesson%2F1/check");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ questionId: "q1", answer: "a" });
  });

  it("sends final answers and progress without a client score", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { score: 0, maxScore: 2, percent: 0, status: "graded", results: [], recorded: true } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "completed", sectionsCompleted: ["s1"], progress: 1, completed: true, streakDays: 2 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await submitFinal("l1", { q1: "b" })).percent).toBe(0);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ lessonId: "l1", answers: { q1: "b" } });
    await saveProgress("l1", { completedSectionIds: ["s1"], completed: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ completedSectionIds: ["s1"], completed: true });
  });

  it("surfaces a server rejection instead of treating it as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Finish every section first." } }), { status: 409 })));
    await expect(saveProgress("l1", { completed: true })).rejects.toThrow("Finish every section first.");
  });
});
