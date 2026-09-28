import { averageScore, numericScore, type ScoreValue } from "./metrics";

export type InsightCourse = { id: string; title: string; class_id: string | null };
export type InsightProgress = {
  id: string;
  student_id: string;
  lesson_id: string;
  status: string;
  score: ScoreValue;
  knowledge_gaps?: string[] | null;
  metadata?: Record<string, unknown> | null;
  last_active: string;
};
export type InsightInteraction = {
  id: string;
  student_id: string;
  lesson_id: string;
  student_question: string;
  created_at: string;
};
export type InsightProfile = { id: string; full_name: string | null; email: string };
export type LessonInsight = InsightCourse & {
  started: number;
  completed: number;
  average: number | null;
  gaps: string[];
};
export type StudentInsight = {
  id: string;
  name: string;
  email: string;
  scores: Record<string, number | null>;
  average: number | null;
  completed: number;
  aiInteractions: number;
  reflections: number;
  lowConfidence: number;
  status: "at_risk" | "on_track" | "advanced";
};
export type ReflectionInsight = {
  id: string;
  studentName: string;
  lessonTitle: string;
  notes: string;
  guidingQuestion: string;
  confidence: number;
  createdAt: string;
};
export type InteractionInsight = {
  id: string;
  studentName: string;
  lessonTitle: string;
  question: string;
  createdAt: string;
};

type ReflectionEntry = {
  id?: unknown;
  confidence?: unknown;
  notes?: unknown;
  advice?: { guidingQuestion?: unknown };
  created_at?: unknown;
};

export function buildInsights(
  courses: readonly InsightCourse[],
  progressRows: readonly InsightProgress[],
  interactionRows: readonly InsightInteraction[],
  profileRows: readonly InsightProfile[],
) {
  const courseIds = new Set(courses.map((course) => course.id));
  const progress = progressRows.filter((row) => courseIds.has(row.lesson_id));
  const interactions = interactionRows.filter((row) => courseIds.has(row.lesson_id));
  const profiles = new Map(profileRows.map((profile) => [profile.id, profile]));
  const courseNames = new Map(courses.map((course) => [course.id, course.title]));
  const gapCounts = new Map<string, number>();
  const lessons: LessonInsight[] = courses.map((course) => {
    const rows = progress.filter((row) => row.lesson_id === course.id);
    const localGaps = new Map<string, number>();
    for (const row of rows) {
      for (const gap of row.knowledge_gaps || []) {
        localGaps.set(gap, (localGaps.get(gap) || 0) + 1);
        gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
      }
    }
    return {
      ...course,
      started: rows.filter((row) => row.status !== "not_started").length,
      completed: rows.filter((row) => row.status === "completed").length,
      average: averageScore(rows.map((row) => row.score)),
      gaps: [...localGaps].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([gap]) => gap),
    };
  });

  const studentIds = new Set([...progress.map((row) => row.student_id), ...interactions.map((row) => row.student_id)]);
  const reflections: ReflectionInsight[] = [];
  const students: StudentInsight[] = [...studentIds].map((id): StudentInsight => {
    const rows = progress.filter((row) => row.student_id === id);
    const chats = interactions.filter((row) => row.student_id === id);
    const profile = profiles.get(id);
    const name = profile?.full_name || "Learner";
    let lowConfidence = 0;
    let reflectionCount = 0;
    const scores: Record<string, number | null> = {};
    for (const row of rows) {
      scores[row.lesson_id] = numericScore(row.score);
      const entries = Array.isArray(row.metadata?.reflections) ? row.metadata.reflections as ReflectionEntry[] : [];
      for (const [index, entry] of entries.entries()) {
        const confidenceRaw = Number(entry?.confidence);
        const confidence = Number.isFinite(confidenceRaw) ? Math.min(5, Math.max(1, Math.round(confidenceRaw))) : 3;
        if (confidence <= 2) lowConfidence += 1;
        reflectionCount += 1;
        reflections.push({
          id: typeof entry?.id === "string" ? entry.id : `${row.id}-${index}`,
          studentName: name,
          lessonTitle: courseNames.get(row.lesson_id) || "Course",
          notes: typeof entry?.notes === "string" && entry.notes.trim() ? entry.notes.trim() : "No notes",
          guidingQuestion: typeof entry?.advice?.guidingQuestion === "string" ? entry.advice.guidingQuestion : "",
          confidence,
          createdAt: typeof entry?.created_at === "string" ? entry.created_at : row.last_active,
        });
      }
    }
    const average = averageScore(rows.map((row) => row.score));
    return {
      id, name, email: profile?.email || "", scores, average,
      completed: rows.filter((row) => row.status === "completed").length,
      aiInteractions: chats.length, reflections: reflectionCount, lowConfidence,
      status: average === null ? "on_track" : average < 60 ? "at_risk" : average >= 80 ? "advanced" : "on_track",
    };
  });
  const names = new Map(students.map((student) => [student.id, student.name]));
  const socratic: InteractionInsight[] = interactions.map((row) => ({
    id: row.id,
    studentName: names.get(row.student_id) || "Learner",
    lessonTitle: courseNames.get(row.lesson_id) || "Course",
    question: row.student_question,
    createdAt: row.created_at,
  }));
  return {
    lessons,
    students,
    reflections: reflections.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 40),
    socratic: socratic.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30),
    gaps: [...gapCounts].sort((a, b) => b[1] - a[1]).slice(0, 8),
    average: averageScore(progress.map((row) => row.score)),
  };
}
