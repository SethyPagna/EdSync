import { createClient } from "@/lib/edsync/client";
import type { QDraft } from "./QuestionBuilder";

type EdSyncClient = ReturnType<typeof createClient>;

export function questionPayload(question: QDraft, orderIndex: number) {
  if (!question.question_text.trim()) throw new Error("Every question needs text.");
  if (!Number.isInteger(question.points) || question.points < 1 || question.points > 100) throw new Error("Points must be between 1 and 100.");
  const choice = question.question_type === "multiple_choice" || question.question_type === "true_false";
  const options = question.options.filter((option) => option.text.trim()).map((option) => ({ ...option, text: option.text.trim() }));
  if (choice && (options.length < 2 || options.filter((option) => option.is_correct).length !== 1)) {
    throw new Error("Choice questions need at least two options and one correct answer.");
  }
  if (!choice && !question.correct_answer.trim() && question.question_type !== "long_answer") throw new Error("Add the expected answer.");
  return {
    question_text: question.question_text.trim(),
    question_type: question.question_type,
    options: choice ? options : null,
    correct_answer: choice ? options.find((option) => option.is_correct)?.id || null : question.correct_answer.trim() || null,
    explanation: question.explanation.trim() || null,
    difficulty: question.difficulty,
    points: question.points,
    is_diagnostic: question.is_diagnostic,
    is_micro_check: question.is_micro_check,
    is_final_quiz: question.is_final_quiz,
    order_index: orderIndex,
  };
}

export async function persistQuestions(input: {
  edsync: EdSyncClient;
  lessonId: string;
  sectionId: string | null;
  drafts: QDraft[];
  savedIds: string[];
}) {
  const { edsync, lessonId, sectionId, drafts, savedIds } = input;
  const payloads = drafts.map(questionPayload);
  const kept = new Set(drafts.map((question) => question.id).filter((id): id is string => Boolean(id)));
  for (const id of savedIds) {
    if (kept.has(id)) continue;
    let query = edsync.from("quiz_questions").delete().eq("id", id).eq("lesson_id", lessonId);
    query = sectionId === null ? query.is("section_id", null) : query.eq("section_id", sectionId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
  for (let index = 0; index < drafts.length; index += 1) {
    const question = drafts[index];
    const payload = payloads[index];
    if (question.id) {
      let query = edsync.from("quiz_questions").update(payload).eq("id", question.id).eq("lesson_id", lessonId);
      query = sectionId === null ? query.is("section_id", null) : query.eq("section_id", sectionId);
      const { error } = await query;
      if (error) throw new Error(error.message);
    } else {
      const { error } = await edsync.from("quiz_questions").insert({ ...payload, lesson_id: lessonId, section_id: sectionId });
      if (error) throw new Error(error.message);
    }
  }
}
