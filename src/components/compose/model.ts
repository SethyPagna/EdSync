import type { LessonOutline } from "@/lib/compose/types";

export function moveOutlineSection(outline: LessonOutline, from: number, to: number): LessonOutline {
  if (from < 0 || to < 0 || from >= outline.sections.length || to >= outline.sections.length || from === to) return outline;
  const order = outline.sections.map((_, index) => index);
  order.splice(to, 0, order.splice(from, 1)[0]);
  const nextIndex = new Map(order.map((original, index) => [original, index]));
  return {
    ...outline,
    sections: order.map((index) => outline.sections[index]),
    questions: outline.questions.map((question) => question.section === undefined ? question : { ...question, section: nextIndex.get(question.section) }),
  };
}

export function removeOutlineSection(outline: LessonOutline, index: number): LessonOutline {
  if (index < 0 || index >= outline.sections.length || outline.sections.length <= 1) return outline;
  return {
    ...outline,
    sections: outline.sections.filter((_, position) => position !== index),
    questions: outline.questions.map((question) => question.section === undefined ? question : {
      ...question,
      section: question.section === index ? undefined : question.section > index ? question.section - 1 : question.section,
    }),
  };
}
