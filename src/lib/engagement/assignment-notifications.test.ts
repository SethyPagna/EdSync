import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_ID_MAX_LENGTH,
  buildLessonAssignmentCopy,
  formatAssignmentDueText,
  normalizeAssignmentDueDate,
  normalizeAssignmentNotificationPayload,
  normalizeOptionalAssignmentRecordId,
  parseAssignmentPreferences,
  validateAssignmentRecordId,
  wantsAssignmentEmail,
} from "@/lib/engagement/assignment-notifications";

describe("assignment notification helpers", () => {
  it("validates date-only assignment deadlines", () => {
    expect(normalizeAssignmentDueDate("2026-05-16")).toBe("2026-05-16");
    expect(normalizeAssignmentDueDate("")).toBeNull();
    expect(() => normalizeAssignmentDueDate("tomorrow")).toThrow("YYYY-MM-DD");
    expect(() => normalizeAssignmentDueDate("2026-02-31")).toThrow("real calendar");
  });

  it("validates assignment notification ids", () => {
    expect(validateAssignmentRecordId("lesson-1", "Lesson")).toBe("lesson-1");
    expect(normalizeOptionalAssignmentRecordId("", "Class")).toBeNull();
    expect(() => validateAssignmentRecordId("bad id", "Lesson")).toThrow("short identifier");
    expect(() => validateAssignmentRecordId("x".repeat(ASSIGNMENT_ID_MAX_LENGTH + 1), "Lesson")).toThrow("short identifier");
  });

  it("normalizes assignment notification payloads", () => {
    expect(
      normalizeAssignmentNotificationPayload({
        lessonId: " lesson-1 ",
        classId: "class-1",
        dueDate: "2026-05-16",
      }),
    ).toEqual({
      lessonId: "lesson-1",
      classId: "class-1",
      studentId: null,
      dueDate: "2026-05-16",
    });
    expect(() => normalizeAssignmentNotificationPayload({ lessonId: "lesson-1" })).toThrow("Class or student");
  });

  it("parses assignment notification preferences defensively", () => {
    expect(parseAssignmentPreferences('{"email_notifications":false}')).toEqual({ email_notifications: false });
    expect(parseAssignmentPreferences("not-json")).toEqual({});
    expect(wantsAssignmentEmail({})).toBe(true);
    expect(wantsAssignmentEmail({ assignment_notifications: false })).toBe(false);
    expect(wantsAssignmentEmail({ email_notifications: false })).toBe(false);
  });

  it("builds consistent student-facing assignment copy", () => {
    const copy = buildLessonAssignmentCopy({
      lessonTitle: "Fractions",
      dueDate: "2026-05-16",
      studentName: "Mina",
      actionUrl: "/student/lessons/lesson-1",
      appUrl: "https://edsync.example/",
    });

    expect(formatAssignmentDueText("2026-05-16")).toBe(" Due 2026-05-16.");
    expect(copy.message).toContain('"Fractions" is ready');
    expect(copy.bodyText).toContain("Hi Mina");
    expect(copy.bodyText).toContain("https://edsync.example/student/lessons/lesson-1");
  });
});
