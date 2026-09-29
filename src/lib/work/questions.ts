export type WorkQuestionRow = {
  id: string;
  work_item_id: string;
  prompt: string;
  question_type: string;
  options: unknown;
  points: number;
  order_index: number;
};

export type StudentWorkQuestion = {
  id: string;
  prompt: string;
  kind: "choice" | "short" | "long";
  options: string[];
  points: number;
};

export type EditableWorkQuestion = {
  prompt: string;
  questionType: "multiple_choice" | "short_answer" | "long_answer" | "true_false";
  options: string[];
  correctAnswer: string | null;
  points: number;
};

function questionOptions(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((option): option is string => typeof option === "string" && option.trim().length > 0);
}

export function studentWorkQuestion(row: WorkQuestionRow): StudentWorkQuestion {
  const options = questionOptions(row.options);
  const kind = (row.question_type === "multiple_choice" || row.question_type === "true_false") && options.length >= 2
    ? "choice" : row.question_type === "long_answer" ? "long" : "short";
  return {
    id: row.id,
    prompt: row.prompt,
    kind,
    options: kind === "choice" ? options : [],
    points: Number.isFinite(Number(row.points)) ? Math.max(0, Number(row.points)) : 0,
  };
}

export function editableWorkQuestions(value: unknown): EditableWorkQuestion[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error("Send at most 50 questions.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Each question must be an object.");
    }
    const input = entry as Record<string, unknown>;
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt || prompt.length > 1000) throw new Error("Each question needs a prompt of at most 1000 characters.");
    const questionType = input.questionType ?? "short_answer";
    if (questionType !== "multiple_choice" && questionType !== "short_answer" && questionType !== "long_answer" && questionType !== "true_false") {
      throw new Error("Choose a supported question type.");
    }
    const points = Number(input.points ?? 1);
    if (!Number.isFinite(points) || points < 0 || points > 10000) throw new Error("Question points must be between 0 and 10000.");
    const correctAnswer = typeof input.correctAnswer === "string" ? input.correctAnswer.trim() : null;
    if (correctAnswer && correctAnswer.length > 4000) throw new Error("Answer keys must be at most 4000 characters.");
    let options: string[] = [];
    if (questionType === "multiple_choice" || questionType === "true_false") {
      if (!Array.isArray(input.options)) throw new Error("Choice questions need options.");
      options = input.options.map((option) => typeof option === "string" ? option.trim() : "");
      if (options.length < 2 || options.length > 8 || options.some((option) => !option || option.length > 200) || new Set(options).size !== options.length) {
        throw new Error("Choice questions need 2 to 8 distinct options of at most 200 characters.");
      }
      if (!correctAnswer || !options.includes(correctAnswer)) throw new Error("Choose an answer key from the options.");
    }
    return { prompt, questionType, options, correctAnswer, points };
  });
}

export function validatedQuestionResponse(response: Record<string, unknown>, questions: StudentWorkQuestion[]) {
  const supplied = response.answers;
  if (!Array.isArray(supplied) || supplied.length !== questions.length) {
    throw new Error("Answer every question before submitting.");
  }

  const answers = new Map<string, string>();
  const knownIds = new Set(questions.map((question) => question.id));
  for (const entry of supplied) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Send one answer for each question.");
    }
    const { questionId, answer } = entry as Record<string, unknown>;
    if (typeof questionId !== "string" || !knownIds.has(questionId) || answers.has(questionId)) {
      throw new Error("Send one answer for each question.");
    }
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) {
      throw new Error("Each answer must contain 1 to 4000 characters.");
    }
    answers.set(questionId, answer.trim());
  }

  for (const question of questions) {
    const answer = answers.get(question.id);
    if (!answer) throw new Error("Answer every question before submitting.");
    if (question.kind === "choice" && !question.options.includes(answer)) {
      throw new Error("Choose an available answer for each multiple-choice question.");
    }
  }

  return {
    answers: questions.map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      answer: answers.get(question.id) as string,
    })),
  };
}
