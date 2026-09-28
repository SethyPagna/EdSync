import { gradeQuiz, normalizeQuizText, type QuizAnswerValue, type StoredQuizQuestion } from "@/lib/grades/quiz-grading";

type StoredPlayerQuestion = StoredQuizQuestion & {
  lesson_id: string;
  section_id: string | null;
  question_text: string;
  explanation: string | null;
  is_diagnostic: number | boolean;
  is_micro_check: number | boolean;
  is_final_quiz: number | boolean;
  order_index: number;
};

export type PlayerQuestion = {
  id: string;
  sectionId: string | null;
  type: "mcq" | "multi" | "true_false" | "short_answer" | "fill_blank" | "long_answer" | "matching";
  prompt: string;
  options: { id: string; text: string }[];
  points: number;
  isFinal: boolean;
  order: number;
  purpose?: string;
};

type Option = { id: string; text: string; correct: boolean };

function optionsOf(raw: unknown): Option[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index): Option[] => {
    if (typeof entry === "string") return [{ id: entry, text: entry, correct: false }];
    if (!entry || typeof entry !== "object") return [];
    const option = entry as Record<string, unknown>;
    const text = typeof option.text === "string" ? option.text : "";
    const id = typeof option.id === "string" || typeof option.id === "number" ? String(option.id) : text || String(index);
    return [{ id, text, correct: option.is_correct === true || option.is_correct === 1 || option.isCorrect === true }];
  });
}

function choiceOptions(question: Pick<StoredPlayerQuestion, "question_type" | "options">) {
  const options = optionsOf(question.options);
  return question.question_type === "true_false" && options.length === 0
    ? [{ id: "true", text: "True", correct: false }, { id: "false", text: "False", correct: false }]
    : options;
}

export function toPlayerQuestion(question: StoredPlayerQuestion): PlayerQuestion {
  const options = choiceOptions(question);
  const type = question.question_type === "multiple_choice"
    ? options.filter((option) => option.correct).length > 1 ? "multi" : "mcq"
    : question.question_type;
  const safeType = type === "true_false" || type === "short_answer" || type === "fill_blank" ||
    type === "long_answer" || type === "matching" || type === "multi" ? type : "mcq";
  const purpose = question.is_final_quiz ? "final" : question.is_diagnostic ? "diagnostic" :
    question.is_micro_check ? "check" : undefined;
  return {
    id: question.id,
    sectionId: question.section_id,
    type: safeType,
    prompt: question.question_text,
    options: options.map(({ id, text }) => ({ id, text })),
    points: Number.isFinite(Number(question.points)) && Number(question.points) > 0 ? Number(question.points) : 1,
    isFinal: Boolean(question.is_final_quiz),
    order: Number(question.order_index) || 0,
    ...(purpose ? { purpose } : {}),
  };
}

export function questionFeedback(question: Pick<StoredPlayerQuestion, "question_type" | "options" | "correct_answer" | "explanation">) {
  const options = choiceOptions(question);
  const flagged = options.filter((option) => option.correct).map((option) => option.id);
  const rawKey = normalizeQuizText(question.correct_answer ?? "");
  const syntheticBoolean = question.question_type === "true_false" && optionsOf(question.options).length === 0;
  const key = syntheticBoolean && ["t", "yes"].includes(rawKey) ? "true"
    : syntheticBoolean && ["f", "no"].includes(rawKey) ? "false" : rawKey;
  const correctOptionIds = flagged.length ? flagged : options.filter((option) =>
    normalizeQuizText(option.id) === key || normalizeQuizText(option.text) === key).map((option) => option.id);
  return {
    correctOptionIds,
    ...(question.correct_answer && options.length === 0 ? { answerText: question.correct_answer } : {}),
    ...(question.explanation ? { explanation: question.explanation } : {}),
  };
}

export function checkQuestion(question: StoredPlayerQuestion, answer: QuizAnswerValue) {
  const result = gradeQuiz([question], new Map([[question.id, answer]])).results[0];
  return { correct: result.correct, ...questionFeedback(question) };
}

export type { StoredPlayerQuestion };
