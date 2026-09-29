import { describe, expect, it } from "vitest";
import { emptyQ } from "./QuestionBuilder";
import { persistQuestions, questionPayload } from "./persistQuestions";

describe("questionPayload", () => {
  it("preserves one correct choice and the point value", () => {
    const draft = emptyQ({ question_text: "Which gas?", points: 4, options: [
      { id: "a", text: "Oxygen", is_correct: true }, { id: "b", text: "Hydrogen", is_correct: false },
    ] });
    expect(questionPayload(draft, 2)).toMatchObject({ correct_answer: "a", points: 4, order_index: 2 });
  });

  it("rejects ambiguous choice keys before any write", () => {
    const draft = emptyQ({ question_text: "Which gas?", options: [
      { id: "a", text: "Oxygen", is_correct: true }, { id: "b", text: "Hydrogen", is_correct: true },
    ] });
    expect(() => questionPayload(draft, 0)).toThrow("one correct answer");
  });

  it("updates an existing question in place and inserts only a new question", async () => {
    const operations: string[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("quiz_questions");
        return {
          update() { operations.push("update"); return this; },
          delete() { operations.push("delete"); return this; },
          insert() { operations.push("insert"); return Promise.resolve({ error: null }); },
          eq() { return this; },
          is() { return this; },
          then(resolve: (value: { error: null }) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
        };
      },
    } as unknown as Parameters<typeof persistQuestions>[0]["edsync"];
    const choices = [{ id: "a", text: "Oxygen", is_correct: true }, { id: "b", text: "Hydrogen", is_correct: false }];
    await persistQuestions({
      edsync: client, lessonId: "lesson-1", sectionId: null, savedIds: ["existing"],
      drafts: [
        emptyQ({ id: "existing", question_text: "First?", options: choices }),
        emptyQ({ question_text: "Second?", options: choices }),
      ],
    });
    expect(operations).toEqual(["update", "insert"]);
  });
});
