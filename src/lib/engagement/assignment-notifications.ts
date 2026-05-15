const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AssignmentPreferences = {
  email_notifications?: boolean;
  assignment_notifications?: boolean;
};

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
    title: "New lesson assigned",
    message: `"${input.lessonTitle}" is ready for you.${dueText}`,
    subject: `EdSync lesson assigned: ${input.lessonTitle}`,
    bodyText: `Hi ${input.studentName || "there"},\n\nYour teacher assigned "${input.lessonTitle}".${dueText}\n\nOpen EdSync to start: ${baseUrl}${input.actionUrl}`,
  };
}
