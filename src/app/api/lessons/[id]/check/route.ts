import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { parseQuizAnswers } from "@/lib/grades/quiz-grading";
import { checkQuestion, type StoredPlayerQuestion } from "@/lib/lessons/quiz";
import { requireLesson } from "@/lib/lessons/request";
import { BadRequestError, ForbiddenError, NotFoundError, readJson, withRoute } from "@/lib/security/http-errors";

type Context = { params: Promise<{ id: string }> };

export const POST = withRoute<Context>(async (request, context) => {
  const { id } = await context.params;
  await requireLesson(id);
  const body = await readJson<{ questionId?: unknown; answer?: unknown }>(request);
  if (typeof body.questionId !== "string" || !body.questionId.trim() || body.questionId.length > 200) {
    throw new BadRequestError("Question is required.");
  }
  if (body.answer === undefined) throw new BadRequestError("Answer is required.");
  let answer;
  try {
    answer = parseQuizAnswers({ [body.questionId]: body.answer }).get(body.questionId);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid answer.");
  }
  if (answer === undefined) throw new BadRequestError("Answer is required.");

  const [question] = await d1Query<StoredPlayerQuestion>(
    `SELECT id, lesson_id, section_id, question_text, question_type, options, correct_answer,
            explanation, points, is_diagnostic, is_micro_check, is_final_quiz, order_index
       FROM quiz_questions WHERE id = ? AND lesson_id = ? LIMIT 1`,
    [body.questionId, id],
  );
  if (!question) throw new NotFoundError("Question not found.");
  if (question.is_final_quiz) throw new ForbiddenError("Final quiz answers are available after submission.");
  return NextResponse.json({ data: checkQuestion(question, answer) });
});
