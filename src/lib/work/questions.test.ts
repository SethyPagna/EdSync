import { describe, expect, it } from "vitest";
import { studentWorkQuestion, validatedQuestionResponse, type WorkQuestionRow } from "./questions";

const question = (fields: Partial<WorkQuestionRow> = {}): WorkQuestionRow => ({
  id: "q1",
  work_item_id: "w1",
  prompt: "Which gas?",
  question_type: "multiple_choice",
  options: '["Oxygen","Nitrogen"]',
  points: 2,
  order_index: 0,
  ...fields,
});

describe("student work questions", () => {
  it("exposes choices and prompts without an answer key", () => {
    const publicQuestion = studentWorkQuestion({ ...question(), correct_answer: "Oxygen" } as WorkQuestionRow);
    expect(publicQuestion).toEqual({
      id: "q1", prompt: "Which gas?", kind: "choice", options: ["Oxygen", "Nitrogen"], points: 2,
    });
    expect(JSON.stringify(publicQuestion)).not.toContain("correct_answer");
  });

  it("uses a text response when a choice question has no usable options", () => {
    expect(studentWorkQuestion(question({ options: "[null]" })).kind).toBe("short");
    expect(studentWorkQuestion(question({ question_type: "short_answer" })).options).toEqual([]);
    expect(studentWorkQuestion(question({ question_type: "long_answer" })).kind).toBe("long");
  });

  it("stores only authorized answers with server-owned prompts", () => {
    const questions = [studentWorkQuestion(question()), studentWorkQuestion(question({ id: "q2", prompt: "Why?", question_type: "short_answer" }))];
    expect(validatedQuestionResponse({
      answers: [{ questionId: "q2", prompt: "forged", answer: "  Because light helps.  " }, { questionId: "q1", answer: "Oxygen" }],
    }, questions)).toEqual({ answers: [
      { questionId: "q1", prompt: "Which gas?", answer: "Oxygen" },
      { questionId: "q2", prompt: "Why?", answer: "Because light helps." },
    ] });
  });

  it("rejects missing, duplicate, foreign and invalid-choice answers", () => {
    const questions = [studentWorkQuestion(question())];
    expect(() => validatedQuestionResponse({}, questions)).toThrow("Answer every question");
    expect(() => validatedQuestionResponse({ answers: [{ questionId: "foreign", answer: "Oxygen" }] }, questions)).toThrow("one answer");
    expect(() => validatedQuestionResponse({ answers: [{ questionId: "q1", answer: "Helium" }] }, questions)).toThrow("available answer");
    expect(() => validatedQuestionResponse({ answers: [{ questionId: "q1", answer: " " }] }, questions)).toThrow("1 to 4000");
    expect(() => validatedQuestionResponse({ answers: [{ questionId: "q1", answer: "Oxygen" }, { questionId: "q1", answer: "Oxygen" }] }, [questions[0], studentWorkQuestion(question({ id: "q2" }))])).toThrow("one answer");
  });
});
