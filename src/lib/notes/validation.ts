import { validateNotificationPriority, type NotificationPriority } from "@/lib/engagement/notification-validation";

export const STUDENT_NOTE_TITLE_MAX_LENGTH = 140;
export const STUDENT_NOTE_BODY_MAX_LENGTH = 5_000;

const NOTE_VISIBILITIES = new Set(["teacher", "student", "guardian"]);

export type StudentNoteVisibility = "teacher" | "student" | "guardian";

export type NormalizedStudentNoteInput = {
  title: string;
  body: string;
  visibility: StudentNoteVisibility;
  priority: NotificationPriority;
};

export function validateStudentNoteText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function validateStudentNoteVisibility(value: unknown): StudentNoteVisibility {
  return NOTE_VISIBILITIES.has(String(value)) ? (value as StudentNoteVisibility) : "student";
}

export function normalizeStudentNoteInput(input: {
  title?: unknown;
  body?: unknown;
  visibility?: unknown;
  priority?: unknown;
}): NormalizedStudentNoteInput {
  return {
    title: validateStudentNoteText(input.title, "Note title", STUDENT_NOTE_TITLE_MAX_LENGTH),
    body: validateStudentNoteText(input.body, "Note body", STUDENT_NOTE_BODY_MAX_LENGTH),
    visibility: validateStudentNoteVisibility(input.visibility),
    priority: validateNotificationPriority(input.priority),
  };
}
