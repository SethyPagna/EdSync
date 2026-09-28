import { describe, expect, it } from "vitest";
import {
  gradeQuiz,
  parseQuizAnswers,
  quizAnswersFingerprint,
  serializeQuizAnswer,
  type StoredQuizQuestion,
} from "@/lib/grades/quiz-grading";

const mcq: StoredQuizQuestion = {
  id: "q-mcq",
  question_type: "multiple_choice",
  options: JSON.stringify([
    { id: "a", text: "Mitochondria", is_correct: true },
    { id: "b", text: "Ribosome", is_correct: false },
    { id: "c", text: "Nucleus", is_correct: false },
  ]),
  correct_answer: "a",
  points: 2,
};

const trueFalse: StoredQuizQuestion = {
  id: "q-tf",
  question_type: "true_false",
  options: JSON.stringify([
    { id: "true", text: "True", is_correct: false },
    { id: "false", text: "False", is_correct: true },
  ]),
  correct_answer: "false",
  points: 1,
};

const shortAnswer: StoredQuizQuestion = {
  id: "q-short",
  question_type: "short_answer",
  options: "[]",
  correct_answer: "Photosynthesis",
  points: 1,
};

const questions = [mcq, trueFalse, shortAnswer];

function answers(value: Record<string, unknown>) {
  return parseQuizAnswers(value);
}

describe("lesson quiz grading", () => {
  it("scores fully correct answers", () => {
    const grade = gradeQuiz(questions, answers({ "q-mcq": "a", "q-tf": false, "q-short": "  photosynthesis " }));
    expect(grade).toMatchObject({ score: 4, maxScore: 4, percent: 100, pendingReview: 0 });
    expect(grade.results.map((result) => result.correct)).toEqual([true, true, true]);
  });

  it("scores fully incorrect answers", () => {
    const grade = gradeQuiz([mcq, trueFalse], answers({ "q-mcq": "b", "q-tf": "true" }));
    expect(grade).toMatchObject({ score: 0, maxScore: 3, percent: 0, pendingReview: 0 });
    expect(grade.results.map((result) => result.correct)).toEqual([false, false]);
  });

  it("sends short answers that differ from the key to teacher review", () => {
    const grade = gradeQuiz(questions, answers({ "q-mcq": "b", "q-tf": "true", "q-short": "Plants turn light into sugar" }));
    expect(grade).toMatchObject({ score: 0, maxScore: 4, percent: 0, pendingReview: 1 });
    expect(grade.results.map((result) => result.correct)).toEqual([false, false, null]);
    expect(gradeQuiz([shortAnswer], answers({ "q-short": "PHOTOSYNTHESIS" })).results[0].correct).toBe(true);
    expect(gradeQuiz([shortAnswer], answers({ "q-short": "   " })).results[0].correct).toBe(false);
  });

  it("keeps fill-in-the-blank answers strict", () => {
    const blank: StoredQuizQuestion = { ...shortAnswer, id: "q-blank", question_type: "fill_blank" };
    expect(gradeQuiz([blank], answers({ "q-blank": " photosynthesis" })).results[0].correct).toBe(true);
    expect(gradeQuiz([blank], answers({ "q-blank": "respiration" }))).toMatchObject({
      pendingReview: 0,
      results: [expect.objectContaining({ correct: false })],
    });
  });

  it("gives partial credit per question and counts unanswered questions as wrong", () => {
    const grade = gradeQuiz(questions, answers({ "q-mcq": "a", "q-short": "" }));
    expect(grade).toMatchObject({ score: 2, maxScore: 4, percent: 50 });
    expect(grade.results).toEqual([
      { questionId: "q-mcq", correct: true, pointsEarned: 2, pointsPossible: 2 },
      { questionId: "q-tf", correct: false, pointsEarned: 0, pointsPossible: 1 },
      { questionId: "q-short", correct: false, pointsEarned: 0, pointsPossible: 1 },
    ]);
  });

  it("accepts option text and ignores unknown answers for other questions", () => {
    const grade = gradeQuiz([mcq], answers({ "q-mcq": "mitochondria", "not-a-question": "a" }));
    expect(grade.score).toBe(2);
  });

  it("rejects answers that name options that do not exist", () => {
    expect(gradeQuiz([mcq], answers({ "q-mcq": ["a", "zzz"] })).results[0].correct).toBe(false);
  });

  it("requires every correct option on multi-answer questions", () => {
    const multi: StoredQuizQuestion = {
      ...mcq,
      id: "q-multi",
      options: [
        { id: "a", text: "2", is_correct: true },
        { id: "b", text: "3", is_correct: true },
        { id: "c", text: "4", is_correct: false },
      ],
      correct_answer: null,
    };
    expect(gradeQuiz([multi], answers({ "q-multi": ["b", "a"] })).results[0].correct).toBe(true);
    expect(gradeQuiz([multi], answers({ "q-multi": ["a"] })).results[0].correct).toBe(false);
    expect(gradeQuiz([multi], answers({ "q-multi": ["a", "b", "c"] })).results[0].correct).toBe(false);
  });

  it("falls back to correct_answer when no option is flagged", () => {
    const unflagged: StoredQuizQuestion = {
      ...mcq,
      options: [
        { id: "a", text: "Mitochondria" },
        { id: "b", text: "Ribosome" },
      ],
      correct_answer: "b",
    };
    expect(gradeQuiz([unflagged], answers({ "q-mcq": "b" })).results[0].correct).toBe(true);
    expect(gradeQuiz([unflagged], answers({ "q-mcq": "a" })).results[0].correct).toBe(false);
  });

  it("grades true/false questions stored without options", () => {
    const bare: StoredQuizQuestion = { ...trueFalse, options: null, correct_answer: "True" };
    expect(gradeQuiz([bare], answers({ "q-tf": true })).results[0].correct).toBe(true);
    expect(gradeQuiz([bare], answers({ "q-tf": "yes" })).results[0].correct).toBe(true);
    expect(gradeQuiz([bare], answers({ "q-tf": "false" })).results[0].correct).toBe(false);
  });

  it("leaves open-ended or unkeyed questions for teacher review", () => {
    const essay: StoredQuizQuestion = { id: "q-essay", question_type: "long_answer", options: null, correct_answer: null, points: 5 };
    const unkeyed: StoredQuizQuestion = { ...shortAnswer, id: "q-unkeyed", correct_answer: null };
    const grade = gradeQuiz([mcq, essay, unkeyed], answers({ "q-mcq": "a", "q-essay": "Because...", "q-unkeyed": "x" }));
    expect(grade.pendingReview).toBe(2);
    expect(grade.results.map((result) => result.correct)).toEqual([true, null, null]);
    expect(grade).toMatchObject({ score: 2, maxScore: 8 });
  });

  it("defaults missing or invalid points to one", () => {
    const grade = gradeQuiz([{ ...shortAnswer, points: null }, { ...mcq, points: -3 }], answers({}));
    expect(grade.maxScore).toBe(2);
    expect(grade.percent).toBe(0);
  });

  it("returns a null percent for an empty quiz", () => {
    expect(gradeQuiz([], answers({}))).toMatchObject({ score: 0, maxScore: 0, percent: null, results: [] });
  });

  it("validates the answers payload", () => {
    expect(() => parseQuizAnswers(null)).toThrow("object keyed by question id");
    expect(() => parseQuizAnswers(["a"])).toThrow("object keyed by question id");
    expect(() => parseQuizAnswers({ q: 3 })).toThrow("text, a list of option ids, or true/false");
    expect(() => parseQuizAnswers({ q: [1] })).toThrow("text, a list of option ids, or true/false");
    expect(() => parseQuizAnswers({ q: "x".repeat(4_001) })).toThrow("characters or fewer");
    const many = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`q${index}`, "a"]));
    expect(() => parseQuizAnswers(many)).toThrow("Too many answers");
  });

  it("treats __proto__ as an ordinary question id", () => {
    const parsed = parseQuizAnswers(JSON.parse('{"__proto__": "a"}'));
    expect(parsed.get("__proto__")).toBe("a");
  });

  it("fingerprints the graded answers independent of key and option order", async () => {
    const first = await quizAnswersFingerprint(questions, answers({ "q-mcq": ["b", "a"], "q-tf": false, extra: "x" }));
    const second = await quizAnswersFingerprint([...questions].reverse(), answers({ "q-tf": false, "q-mcq": [" a", "b"] }));
    const changed = await quizAnswersFingerprint(questions, answers({ "q-mcq": ["a"], "q-tf": false }));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("serializes answers for quiz_attempts", () => {
    expect(serializeQuizAnswer("a")).toBe("a");
    expect(serializeQuizAnswer(false)).toBe("false");
    expect(serializeQuizAnswer(["a", "b"])).toBe('["a","b"]');
    expect(serializeQuizAnswer(undefined)).toBeNull();
  });
});
