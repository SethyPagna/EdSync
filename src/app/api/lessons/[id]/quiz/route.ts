import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { toPlayerQuestion, type StoredPlayerQuestion } from "@/lib/lessons/quiz";
import { requireLesson } from "@/lib/lessons/request";
import { withRoute } from "@/lib/security/http-errors";

type Context = { params: Promise<{ id: string }> };

export const GET = withRoute<Context>(async (_request, context) => {
  const { id } = await context.params;
  await requireLesson(id);
  const questions = await d1Query<StoredPlayerQuestion>(
    `SELECT id, lesson_id, section_id, question_text, question_type, options, points,
            is_diagnostic, is_micro_check, is_final_quiz, order_index
       FROM quiz_questions
      WHERE lesson_id = ?
      ORDER BY order_index, created_at, id`,
    [id],
  );
  return NextResponse.json({ data: { questions: questions.map(toPlayerQuestion) } });
});
