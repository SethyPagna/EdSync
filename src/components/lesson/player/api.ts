import type { PlayerQuestion } from "@/lib/lessons/quiz";

export type Answer = string | string[] | boolean;
export type Answers = Record<string, Answer>;

export type QuestionFeedback = {
  correct: boolean | null;
  correctOptionIds: string[];
  answerText?: string;
  explanation?: string;
};

export type FinalResult = QuestionFeedback & {
  questionId: string;
  pointsEarned: number;
  pointsPossible: number;
};

export type FinalGrade = {
  score: number;
  maxScore: number;
  percent: number | null;
  status: "graded" | "submitted" | "ungraded";
  results: FinalResult[];
  recorded: boolean;
  locked?: boolean;
  attemptNumber?: number;
};

export type RecordedFinal = { grade: FinalGrade | null; answers: Answers };

export type ProgressSnapshot = {
  status: "not_started" | "in_progress" | "completed";
  sectionsCompleted: string[];
  progress: number;
  completed: boolean;
  streakDays: number;
};

type ApiEnvelope<T> = { data?: T; error?: string | { message?: string } | null };

function errorText(error: ApiEnvelope<unknown>["error"], fallback: string) {
  if (typeof error === "string") return error;
  if (error && typeof error.message === "string") return error.message;
  return fallback;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.data || payload.error) {
    throw new Error(errorText(payload?.error, `Request failed (${response.status}).`));
  }
  return payload.data;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function loadQuestions(lessonId: string): Promise<PlayerQuestion[]> {
  const data = await request<{ questions: PlayerQuestion[] }>(`/api/lessons/${encodeURIComponent(lessonId)}/quiz`);
  return data.questions;
}

export function checkAnswer(lessonId: string, questionId: string, answer: Answer) {
  return post<QuestionFeedback>(`/api/lessons/${encodeURIComponent(lessonId)}/check`, { questionId, answer });
}

export function submitFinal(lessonId: string, answers: Answers) {
  return post<FinalGrade>("/api/grades/lesson-quiz", { lessonId, answers });
}

export function loadRecordedFinal(lessonId: string) {
  return request<RecordedFinal>(`/api/grades/lesson-quiz?lessonId=${encodeURIComponent(lessonId)}`);
}

export function saveProgress(
  lessonId: string,
  update: { currentSectionId?: string; completedSectionIds?: string[]; timeSpentSeconds?: number; completed?: boolean },
) {
  return post<ProgressSnapshot>(`/api/lessons/${encodeURIComponent(lessonId)}/progress`, update);
}

export function answerIsBlank(answer: Answer | undefined) {
  return answer === undefined || (typeof answer === "string" && !answer.trim()) ||
    (Array.isArray(answer) && answer.length === 0);
}

export function allAnswered(questions: PlayerQuestion[], answers: Answers) {
  return questions.length > 0 && questions.every((question) => !answerIsBlank(answers[question.id]));
}

export function questionsForSection(questions: PlayerQuestion[], sectionId: string) {
  return questions.filter((question) => question.sectionId === sectionId && !question.isFinal && question.purpose !== "diagnostic");
}
