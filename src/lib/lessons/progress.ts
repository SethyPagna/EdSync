import { d1Query } from "@/lib/db/d1";
import { BadRequestError, ConflictError } from "@/lib/security/http-errors";

type ProgressBody = {
  currentSectionId?: unknown;
  completedSectionIds?: unknown;
  timeSpentSeconds?: unknown;
  completed?: unknown;
};

type ProgressRow = {
  id: string;
  status: string;
  sections_completed: string | null;
  time_spent: number | null;
};

type ProfileRow = { streak_days: number | null; preferences: string | null; last_active_at: string | null };

function completedIds(raw: string | null, validIds: Set<string>) {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((id): id is string => typeof id === "string" && validIds.has(id))));
  } catch {
    return [];
  }
}

function calendarDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timezoneFromPreferences(preferences: Record<string, unknown>) {
  const requested = preferences.timezone ?? preferences.timeZone;
  if (typeof requested !== "string") return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: requested });
    return requested;
  } catch {
    return "UTC";
  }
}

function readPreferences(raw: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function nextStreakDays(current: number, lastDate: string | null, today: string) {
  if (lastDate === today) return Math.max(1, current);
  const [year, month, day] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return lastDate === yesterday ? current + 1 : 1;
}

async function recordDailyStreak(studentId: string, now: Date) {
  const [profile] = await d1Query<ProfileRow>(
    "SELECT streak_days, preferences, last_active_at FROM profiles WHERE id = ? LIMIT 1",
    [studentId],
  );
  if (!profile) return 0;
  const preferences = readPreferences(profile.preferences);
  const timezone = timezoneFromPreferences(preferences);
  const today = calendarDate(now, timezone);
  const previousActivity = profile.last_active_at
    ? new Date(profile.last_active_at.includes("T") ? profile.last_active_at : `${profile.last_active_at.replace(" ", "T")}Z`)
    : null;
  const previous = previousActivity && Number.isFinite(previousActivity.getTime())
    ? calendarDate(previousActivity, timezone)
    : null;
  if (previous !== today || !profile.streak_days) {
    const next = nextStreakDays(Number(profile.streak_days) || 0, previous, today);
    await d1Query(
      `UPDATE profiles
          SET streak_days = ?,
              last_active_at = ?, updated_at = ?
        WHERE id = ? AND last_active_at IS ?`,
      [next, now.toISOString(), now.toISOString(), studentId, profile.last_active_at],
    );
  } else {
    await d1Query("UPDATE profiles SET last_active_at = ? WHERE id = ?", [now.toISOString(), studentId]);
  }
  const [saved] = await d1Query<{ streak_days: number }>("SELECT streak_days FROM profiles WHERE id = ?", [studentId]);
  return Number(saved?.streak_days) || 0;
}

function parseProgressBody(body: ProgressBody) {
  const currentSectionId = body.currentSectionId;
  if (currentSectionId !== undefined && (typeof currentSectionId !== "string" || !currentSectionId.trim() || currentSectionId.length > 200)) {
    throw new BadRequestError("Current section must be a section id.");
  }
  const completedSectionIds = body.completedSectionIds;
  if (completedSectionIds !== undefined &&
      (!Array.isArray(completedSectionIds) || completedSectionIds.length > 500 ||
       !completedSectionIds.every((id) => typeof id === "string" && Boolean(id.trim()) && id.length <= 200))) {
    throw new BadRequestError("Completed sections must be a list of section ids.");
  }
  const timeSpentSeconds = body.timeSpentSeconds;
  if (timeSpentSeconds !== undefined &&
      (typeof timeSpentSeconds !== "number" || !Number.isSafeInteger(timeSpentSeconds) || timeSpentSeconds < 0)) {
    throw new BadRequestError("Time spent must be whole seconds.");
  }
  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    throw new BadRequestError("Completed must be true or false.");
  }
  return {
    currentSectionId: currentSectionId as string | undefined,
    completedSectionIds: (completedSectionIds ?? []) as string[],
    timeSpentSeconds: Math.min(timeSpentSeconds as number | undefined ?? 0, 600),
    completed: body.completed === true,
  };
}

export async function saveLessonProgress(input: {
  lessonId: string;
  studentId: string;
  body: ProgressBody;
  now?: Date;
}) {
  const parsed = parseProgressBody(input.body);
  const sections = await d1Query<{ id: string }>(
    "SELECT id FROM lesson_sections WHERE lesson_id = ? ORDER BY order_index, id",
    [input.lessonId],
  );
  const validIds = new Set(sections.map((section) => section.id));
  if ((parsed.currentSectionId && !validIds.has(parsed.currentSectionId)) ||
      parsed.completedSectionIds.some((id) => !validIds.has(id))) {
    throw new BadRequestError("A section does not belong to this lesson.");
  }

  if (parsed.completed) {
    const [prior] = await d1Query<Pick<ProgressRow, "sections_completed">>(
      "SELECT sections_completed FROM student_progress WHERE student_id = ? AND lesson_id = ? LIMIT 1",
      [input.studentId, input.lessonId],
    );
    const proposed = new Set([...completedIds(prior?.sections_completed ?? null, validIds), ...parsed.completedSectionIds]);
    if (proposed.size !== sections.length) {
      const [attemptRow] = await d1Query<{ id: string }>(
        `SELECT qa.id FROM quiz_attempts qa
           JOIN quiz_questions q ON q.id = qa.question_id AND q.lesson_id = qa.lesson_id
          WHERE qa.student_id = ? AND qa.lesson_id = ? AND q.is_final_quiz = 1 LIMIT 1`,
        [input.studentId, input.lessonId],
      );
      if (!attemptRow) throw new ConflictError("Finish every section or submit the final quiz first.");
    }
  }

  const now = input.now ?? new Date();
  await d1Query(
    `INSERT OR IGNORE INTO student_progress
      (id, student_id, lesson_id, status, sections_completed, time_spent, started_at, last_active)
     VALUES (?, ?, ?, 'in_progress', '[]', 0, ?, ?)`,
    [crypto.randomUUID(), input.studentId, input.lessonId, now.toISOString(), now.toISOString()],
  );

  let saved: ProgressRow | undefined;
  let sectionIds: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const [current] = await d1Query<ProgressRow>(
      "SELECT id, status, sections_completed, time_spent FROM student_progress WHERE student_id = ? AND lesson_id = ? LIMIT 1",
      [input.studentId, input.lessonId],
    );
    if (!current) throw new Error("Progress row was not created.");
    sectionIds = Array.from(new Set([...completedIds(current.sections_completed, validIds), ...parsed.completedSectionIds]));
    const allSectionsComplete = sectionIds.length === sections.length;
    let hasFinalAttempt = false;
    if (parsed.completed && !allSectionsComplete) {
      const [attemptRow] = await d1Query<{ id: string }>(
        `SELECT qa.id FROM quiz_attempts qa
           JOIN quiz_questions q ON q.id = qa.question_id AND q.lesson_id = qa.lesson_id
          WHERE qa.student_id = ? AND qa.lesson_id = ? AND q.is_final_quiz = 1 LIMIT 1`,
        [input.studentId, input.lessonId],
      );
      hasFinalAttempt = Boolean(attemptRow);
    }
    if (parsed.completed && !allSectionsComplete && !hasFinalAttempt) {
      throw new ConflictError("Finish every section or submit the final quiz first.");
    }
    const [updated] = await d1Query<ProgressRow>(
      `UPDATE student_progress
          SET current_section_id = COALESCE(?, current_section_id),
              sections_completed = ?,
              time_spent = COALESCE(time_spent, 0) + ?,
              status = CASE WHEN ? THEN 'completed' WHEN status = 'completed' THEN status ELSE 'in_progress' END,
              completed_at = CASE WHEN ? AND completed_at IS NULL THEN ? ELSE completed_at END,
              last_active = ?
        WHERE id = ? AND sections_completed IS ?
        RETURNING id, status, sections_completed, time_spent`,
      [
        parsed.currentSectionId ?? null,
        JSON.stringify(sectionIds),
        parsed.timeSpentSeconds,
        parsed.completed ? 1 : 0,
        parsed.completed ? 1 : 0,
        now.toISOString(),
        now.toISOString(),
        current.id,
        current.sections_completed,
      ],
    );
    if (updated) {
      saved = updated;
      break;
    }
  }
  if (!saved) throw new ConflictError("Progress changed. Try again.");
  const streakDays = await recordDailyStreak(input.studentId, now);
  const completed = saved.status === "completed";
  return {
    status: saved.status,
    sectionsCompleted: sectionIds,
    progress: completed ? 1 : sections.length ? sectionIds.length / sections.length : 0,
    completed,
    streakDays,
  };
}
