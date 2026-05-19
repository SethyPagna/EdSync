import { describe, expect, it } from "vitest";
import {
  STUDENT_NOTE_BODY_MAX_LENGTH,
  STUDENT_NOTE_TITLE_MAX_LENGTH,
  normalizeStudentNoteInput,
  validateStudentNoteText,
  validateStudentNoteVisibility,
} from "@/lib/notes/validation";

describe("student note validation", () => {
  it("normalizes a safe student note", () => {
    expect(
      normalizeStudentNoteInput({
        title: "  Progress check ",
        body: "  Student improved on retry. ",
        visibility: "guardian",
        priority: "high",
      }),
    ).toEqual({
      title: "Progress check",
      body: "Student improved on retry.",
      visibility: "guardian",
      priority: "high",
    });
  });

  it("rejects missing or oversized note text", () => {
    expect(() => validateStudentNoteText("", "Note title", STUDENT_NOTE_TITLE_MAX_LENGTH)).toThrow("required");
    expect(() => validateStudentNoteText("x".repeat(STUDENT_NOTE_TITLE_MAX_LENGTH + 1), "Note title", STUDENT_NOTE_TITLE_MAX_LENGTH)).toThrow(
      "characters",
    );
    expect(() => normalizeStudentNoteInput({ title: "Title", body: "x".repeat(STUDENT_NOTE_BODY_MAX_LENGTH + 1) })).toThrow("Note body");
  });

  it("defaults unsafe visibility and priority values", () => {
    expect(validateStudentNoteVisibility("private")).toBe("student");
    expect(normalizeStudentNoteInput({ title: "Title", body: "Body", priority: "urgent" }).priority).toBe("normal");
  });
});
