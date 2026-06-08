import type { DifficultyLevel, LessonStatus } from "@/types";

import {
  createLearningObjectFromLegacy,
  lessonSectionToLearningBlock,
  quizQuestionToLearningBlock,
  type LearningBlock,
  type LearningObject,
  type LearningWorkflowState,
  type LegacyLessonSection,
  type LegacyQuizQuestion,
} from "./objects";

export type LegacyLessonPackageRow = {
  id: string;
  tenant_id?: string | null;
  teacher_id: string;
  class_id?: string | null;
  title: string;
  description?: string | null;
  objectives?: unknown;
  subject?: string | null;
  grade_level?: string | null;
  status?: LessonStatus | string | null;
  difficulty?: DifficultyLevel | null;
  estimated_duration?: number | null;
  tags?: unknown;
  source_url?: string | null;
  ai_generated?: boolean | number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function stateFromLessonStatus(status: unknown): LearningWorkflowState {
  if (status === "published") return "published";
  if (status === "archived") return "archived";
  return "server_draft";
}

function orderBlocks(blocks: LearningBlock[]) {
  return [...blocks].sort((left, right) => {
    if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex;
    return left.title.localeCompare(right.title);
  });
}

export function lessonRowsToLearningObject(input: {
  lesson: LegacyLessonPackageRow;
  sections?: LegacyLessonSection[];
  questions?: LegacyQuizQuestion[];
}): LearningObject {
  const sectionBlocks = (input.sections ?? []).map(lessonSectionToLearningBlock);
  const quizBlocks = (input.questions ?? []).map((question) => {
    const block = quizQuestionToLearningBlock(question);
    block.orderIndex = 10_000 + (question.order_index ?? 0);
    return block;
  });

  return createLearningObjectFromLegacy({
    id: input.lesson.id,
    tenantId: input.lesson.tenant_id ?? null,
    ownerId: input.lesson.teacher_id,
    title: input.lesson.title,
    sourceType: "lesson",
    sourceId: input.lesson.id,
    state: stateFromLessonStatus(input.lesson.status),
    objectives: input.lesson.objectives,
    audience: input.lesson.grade_level ?? null,
    tags: input.lesson.tags,
    language: null,
    estimatedMinutes: input.lesson.estimated_duration ?? null,
    difficulty: input.lesson.difficulty ?? null,
    blocks: orderBlocks([...sectionBlocks, ...quizBlocks]),
    metadata: {
      classId: input.lesson.class_id ?? null,
      description: input.lesson.description ?? null,
      subject: input.lesson.subject ?? null,
      sourceUrl: input.lesson.source_url ?? null,
      aiGenerated: input.lesson.ai_generated === true || input.lesson.ai_generated === 1,
    },
    createdAt: input.lesson.created_at ?? null,
    updatedAt: input.lesson.updated_at ?? null,
  });
}

export function summarizeLearningObject(object: LearningObject) {
  const counts = object.blocks.reduce(
    (summary, block) => {
      summary.total += 1;
      summary.byType[block.type] = (summary.byType[block.type] ?? 0) + 1;
      if (block.required) summary.required += 1;
      if (typeof block.durationMinutes === "number") summary.estimatedMinutes += block.durationMinutes;
      return summary;
    },
    {
      total: 0,
      required: 0,
      estimatedMinutes: object.estimatedMinutes ?? 0,
      byType: {} as Record<LearningBlock["type"], number>,
    },
  );

  return counts;
}
