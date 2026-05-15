import { describe, expect, it } from "vitest";
import {
  buildLessonAssignmentCopy,
  formatAssignmentDueText,
  normalizeAssignmentDueDate,
  parseAssignmentPreferences,
  wantsAssignmentEmail,
} from "@/lib/engagement/assignment-notifications";

describe("assignment notification helpers", () => {
  it("validates date-only assignment deadlines", () => {
    expect(normalizeAssignmentDueDate("2026-05-16")).toBe("2026-05-16");
    expect(normalizeAssignmentDueDate("")).toBeNull();
    expect(() => normalizeAssignmentDueDate("tomorrow")).toThrow("YYYY-MM-DD");
    expect(() => normalizeAssignmentDueDate("2026-02-31")).toThrow("real calendar");
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
