const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ASSIGNMENT_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

export const ASSIGNMENT_ID_MAX_LENGTH = 160;

export type AssignmentPreferences = {
  email_notifications?: boolean;
  assignment_notifications?: boolean;
};

export type NormalizedAssignmentNotificationPayload = {
  lessonId: string;
  classId: string | null;
  studentId: string | null;
  dueDate: string | null;
};

export function validateAssignmentRecordId(value: unknown, label: string) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} is required.`);
  if (id.length > ASSIGNMENT_ID_MAX_LENGTH || !ASSIGNMENT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return id;
}

export function normalizeOptionalAssignmentRecordId(value: unknown, label: string) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return validateAssignmentRecordId(value, label);
}

export function normalizeAssignmentDueDate(value: unknown) {
  const dueDate = String(value ?? "").trim();
  if (!dueDate) return null;
  if (!DATE_ONLY_PATTERN.test(dueDate)) throw new Error("Due date must use YYYY-MM-DD format.");

  const parsed = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
    throw new Error("Due date must be a real calendar date.");
  }
  return dueDate;
}

export function normalizeAssignmentNotificationPayload(input: {
  lessonId?: unknown;
  classId?: unknown;
  studentId?: unknown;
  dueDate?: unknown;
}): NormalizedAssignmentNotificationPayload {
  const lessonId = validateAssignmentRecordId(input.lessonId, "Lesson");
  const classId = normalizeOptionalAssignmentRecordId(input.classId, "Class");
  const studentId = normalizeOptionalAssignmentRecordId(input.studentId, "Student");
  if (!classId && !studentId) throw new Error("Class or student is required.");
  return {
    lessonId,
    classId,
    studentId,
    dueDate: normalizeAssignmentDueDate(input.dueDate),
  };
}

export function parseAssignmentPreferences(value: string | null): AssignmentPreferences {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function wantsAssignmentEmail(preferences: AssignmentPreferences) {
  return preferences.email_notifications !== false && preferences.assignment_notifications !== false;
}

export function formatAssignmentDueText(dueDate: string | null) {
  return dueDate ? ` Due ${dueDate}.` : "";
}

export function buildLessonAssignmentCopy(input: {
  lessonTitle: string;
  dueDate: string | null;
  studentName?: string | null;
  actionUrl: string;
  appUrl?: string | null;
}) {
  const dueText = formatAssignmentDueText(input.dueDate);
  const baseUrl = String(input.appUrl ?? "").replace(/\/$/, "");
  return {
    title: "New course shared",
    message: `"${input.lessonTitle}" is ready for you.${dueText}`,
    subject: `EdSync course ready: ${input.lessonTitle}`,
    bodyText: `Hi ${input.studentName || "there"},\n\n"${input.lessonTitle}" is ready for you.${dueText}\n\nOpen EdSync to start: ${baseUrl}${input.actionUrl}`,
  };
}
