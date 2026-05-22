export type StudentDashboardVisibility = {
  assignments: boolean;
  deadlines: boolean;
  feedback: boolean;
  grades: boolean;
  newContent: boolean;
  notifications: boolean;
  practice: boolean;
};

export const STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY = "edsync-student-dashboard-visibility";
export const ACTIVE_TIME_WEEKLY_TARGET_MINUTES = 240;

export const defaultStudentDashboardVisibility: StudentDashboardVisibility = {
  assignments: true,
  deadlines: true,
  feedback: true,
  grades: true,
  newContent: true,
  notifications: true,
  practice: true,
};

export const studentNotificationToggleOptions: Array<{
  key: keyof StudentDashboardVisibility;
  label: string;
  description: string;
}> = [
  { key: "notifications", label: "Master", description: "Show or pause dashboard notifications." },
  { key: "assignments", label: "Assignments", description: "Work, projects, and class tasks." },
  { key: "deadlines", label: "Deadlines", description: "Due dates and scheduled study blocks." },
  { key: "newContent", label: "New content", description: "New lessons, modules, and course updates." },
  { key: "practice", label: "Practice + AI", description: "Review cards, generated practice, and tutor prompts." },
  { key: "grades", label: "Grades", description: "Posted scores and gradebook visibility." },
  { key: "feedback", label: "Feedback", description: "Teacher notes, comments, and review suggestions." },
];

export const studentNotificationTypeKeys: Array<keyof StudentDashboardVisibility> = [
  "assignments",
  "deadlines",
  "newContent",
  "practice",
  "grades",
  "feedback",
];

export function mergeStudentDashboardVisibility(
  value: Partial<StudentDashboardVisibility> | null | undefined,
): StudentDashboardVisibility {
  return {
    ...defaultStudentDashboardVisibility,
    ...(value ?? {}),
  };
}

export function areStudentNotificationsPaused(visibility: StudentDashboardVisibility) {
  return !visibility.notifications || studentNotificationTypeKeys.every((key) => !visibility[key]);
}
