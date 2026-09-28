export type QuizAnswerValue = string | string[] | boolean;
export type QuizAnswers = ReadonlyMap<string, QuizAnswerValue>;

export type StoredQuizQuestion = {
  id: string;
  question_type: string | null;
  options: unknown;
  correct_answer: string | null;
  points: number | string | null;
};

export type QuizQuestionResult = {
  questionId: string;
  /** null while the answer waits for teacher review. */
  correct: boolean | null;
  pointsEarned: number;
  pointsPossible: number;
};

export type QuizGrade = {
  score: number;
  maxScore: number;
  percent: number | null;
  pendingReview: number;
  results: QuizQuestionResult[];
};

type QuizOption = { id: string; text: string; isCorrect: boolean };

export const QUIZ_ANSWERS_MAX = 200;
export const QUIZ_ANSWER_MAX_LENGTH = 4_000;
const QUIZ_CHOICES_MAX = 50;

const CHOICE_TYPES = new Set(["multiple_choice", "true_false"]);
const KEYED_TEXT_TYPES = new Set(["fill_blank", "short_answer"]);
const TRUE_WORDS = new Set(["true", "t", "yes"]);
const FALSE_WORDS = new Set(["false", "f", "no"]);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function assertAnswerLength(value: string) {
  if (value.length > QUIZ_ANSWER_MAX_LENGTH) {
    throw new Error(`Answers must be ${QUIZ_ANSWER_MAX_LENGTH} characters or fewer.`);
  }
}

export function parseQuizAnswers(value: unknown): QuizAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Answers must be an object keyed by question id.");
  }
  const entries = Object.entries(value);
  if (entries.length > QUIZ_ANSWERS_MAX) throw new Error("Too many answers.");

  const answers = new Map<string, QuizAnswerValue>();
  for (const [questionId, answer] of entries) {
    if (typeof answer === "boolean") {
      answers.set(questionId, answer);
    } else if (typeof answer === "string") {
      assertAnswerLength(answer);
      answers.set(questionId, answer);
    } else if (
      Array.isArray(answer) &&
      answer.length <= QUIZ_CHOICES_MAX &&
      answer.every((item): item is string => typeof item === "string")
    ) {
      answer.forEach(assertAnswerLength);
      answers.set(questionId, answer);
    } else {
      throw new Error("Each answer must be text, a list of option ids, or true/false.");
    }
  }
  return answers;
}

export function normalizeQuizText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseOptions(value: unknown): QuizOption[] {
  const raw = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index): QuizOption[] => {
    if (typeof item === "string") return [{ id: item, text: item, isCorrect: false }];
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    const text = typeof option.text === "string" ? option.text : "";
    const id =
      typeof option.id === "string" || typeof option.id === "number" ? String(option.id) : text || String(index);
    const flag = option.is_correct ?? option.isCorrect;
    return [{ id, text, isCorrect: flag === true || flag === 1 }];
  });
}

function parseBoolean(value: QuizAnswerValue | string | null | undefined) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const word = normalizeQuizText(value);
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return null;
}

function resolveOptionId(options: QuizOption[], token: string) {
  const exact = options.find((option) => option.id === token.trim());
  if (exact) return exact.id;
  const key = normalizeQuizText(token);
  return options.find((option) => normalizeQuizText(option.id) === key || normalizeQuizText(option.text) === key)?.id ?? null;
}

function correctOptionIds(options: QuizOption[], correctAnswer: string | null) {
  const flagged = options.filter((option) => option.isCorrect).map((option) => option.id);
  if (flagged.length > 0) return flagged;
  if (!correctAnswer?.trim()) return [];
  const match = resolveOptionId(options, correctAnswer);
  return match ? [match] : [];
}

function isBlank(answer: QuizAnswerValue | undefined) {
  if (answer === undefined) return true;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

function gradeChoice(question: StoredQuizQuestion, answer: QuizAnswerValue): boolean | null {
  const options = parseOptions(question.options);
  if (question.question_type === "true_false" && options.length === 0) {
    const key = parseBoolean(question.correct_answer);
    return key === null ? null : parseBoolean(answer) === key;
  }

  const expected = correctOptionIds(options, question.correct_answer);
  if (expected.length === 0) return null;

  const tokens = typeof answer === "boolean" ? [String(answer)] : typeof answer === "string" ? [answer] : answer;
  const selected = tokens.map((token) => resolveOptionId(options, token));
  if (selected.some((id) => id === null)) return false;
  const chosen = new Set(selected);
  return chosen.size === expected.length && expected.every((id) => chosen.has(id));
}

/**
 * fill_blank must match the key exactly (after normalizing case and spaces). A short_answer key holds the
 * expected answer or key points, so an exact match is correct and any other answer waits for teacher review.
 */
function gradeText(question: StoredQuizQuestion, answer: QuizAnswerValue): boolean | null {
  const key = question.correct_answer?.trim();
  if (!key) return null;
  if (Array.isArray(answer)) return false;
  if (normalizeQuizText(String(answer)) === normalizeQuizText(key)) return true;
  return question.question_type === "short_answer" ? null : false;
}

function gradeQuestion(question: StoredQuizQuestion, answer: QuizAnswerValue | undefined): boolean | null {
  if (answer === undefined || isBlank(answer)) return false;
  const type = question.question_type ?? "multiple_choice";
  if (CHOICE_TYPES.has(type)) return gradeChoice(question, answer);
  if (KEYED_TEXT_TYPES.has(type)) return gradeText(question, answer);
  return null;
}

export function questionPoints(question: Pick<StoredQuizQuestion, "points">) {
  const points = Number(question.points);
  return Number.isFinite(points) && points > 0 ? points : 1;
}

export function gradeQuiz(questions: StoredQuizQuestion[], answers: QuizAnswers): QuizGrade {
  const results = questions.map((question): QuizQuestionResult => {
    const pointsPossible = questionPoints(question);
    const correct = gradeQuestion(question, answers.get(question.id));
    return { questionId: question.id, correct, pointsEarned: correct ? pointsPossible : 0, pointsPossible };
  });
  const score = round2(results.reduce((sum, result) => sum + result.pointsEarned, 0));
  const maxScore = round2(results.reduce((sum, result) => sum + result.pointsPossible, 0));
  return {
    score,
    maxScore,
    percent: maxScore > 0 ? round2((score / maxScore) * 100) : null,
    pendingReview: results.filter((result) => result.correct === null).length,
    results,
  };
}

function canonicalAnswer(answer: QuizAnswerValue | undefined) {
  if (answer === undefined) return null;
  if (typeof answer === "boolean") return answer;
  if (typeof answer === "string") return answer.trim();
  return answer.map((item) => item.trim()).sort();
}

/** Stable hash of the answers to the graded questions, used to make repeated submissions idempotent. */
export async function quizAnswersFingerprint(questions: Array<{ id: string }>, answers: QuizAnswers) {
  const canonical = questions
    .map((question) => question.id)
    .sort()
    .map((id) => [id, canonicalAnswer(answers.get(id))]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function serializeQuizAnswer(answer: QuizAnswerValue | undefined) {
  if (answer === undefined) return null;
  if (typeof answer === "string") return answer;
  if (typeof answer === "boolean") return String(answer);
  return JSON.stringify(answer);
}
