import { describe, expect, it } from "vitest";

import {
  contentBlockToLearningBlock,
  createLearningObjectFromLegacy,
  getLearningStateLabel,
  lessonSectionToLearningBlock,
  normalizeLearningTags,
  normalizeLearningWorkflowState,
  quizQuestionToLearningBlock,
  studioDocumentToLearningObject,
} from "./objects";

describe("learning object adapters", () => {
  it("normalizes workflow states and labels", () => {
    expect(normalizeLearningWorkflowState("draft")).toBe("server_draft");
    expect(normalizeLearningWorkflowState("needs-review")).toBe("needs_review");
    expect(normalizeLearningWorkflowState("published")).toBe("published");
    expect(normalizeLearningWorkflowState("unknown")).toBe("server_draft");
    expect(getLearningStateLabel("local_draft")).toBe("Local draft");
  });

  it("deduplicates and caps learning tags", () => {
    expect(normalizeLearningTags(["Math", "math", " Algebra ", "", "Science"])).toEqual([
      "math",
      "algebra",
      "science",
    ]);
    expect(normalizeLearningTags(Array.from({ length: 20 }, (_, index) => `tag-${index}`))).toHaveLength(12);
  });

  it("converts workspace documents into learning objects", () => {
    const object = studioDocumentToLearningObject({
      id: "studio-1",
      kind: "slide",
      title: "  Photosynthesis Deck ",
      plainText: "Plants convert light into energy.",
      status: "published",
      sourceType: "import",
      sourceId: "upload-1",
      content: { slides: [] },
      metadata: {
        tenantId: "tenant-1",
        ownerId: "teacher-1",
        audience: "Grade 7",
        tags: ["Science"],
        objectives: ["Explain photosynthesis"],
        estimatedMinutes: 20,
      },
      createdAt: "2026-05-16T00:00:00Z",
      updatedAt: "2026-05-16T00:10:00Z",
    });

    expect(object.kind).toBe("slide_deck");
    expect(object.title).toBe("Photosynthesis Deck");
    expect(object.state).toBe("published");
    expect(object.blocks).toHaveLength(1);
    expect(object.blocks[0]?.origin).toEqual({ sourceType: "studio_document", sourceId: "studio-1" });
  });

  it("converts lesson sections and quiz questions into learning blocks", () => {
    const section = lessonSectionToLearningBlock({
      id: "section-1",
      lesson_id: "lesson-1",
      title: "Warmup",
      content: "Think-pair-share",
      content_type: "discussion",
      order_index: 2,
      duration_minutes: 8,
      is_required: 1,
      metadata: { grouping: "pairs" },
      created_at: "2026-05-16T00:00:00Z",
    });

    const question = quizQuestionToLearningBlock({
      id: "question-1",
      lesson_id: "lesson-1",
      section_id: "section-1",
      question_text: "What do plants need for photosynthesis?",
      question_type: "multiple_choice",
      options: [{ id: "a", text: "Light", is_correct: true }],
      correct_answer: "a",
      explanation: "Light powers the reaction.",
      difficulty: "beginner",
      points: 3,
      is_micro_check: true,
      order_index: 1,
    });

    expect(section.type).toBe("discussion");
    expect(section.metadata.lessonId).toBe("lesson-1");
    expect(question.type).toBe("quiz");
    expect(question.content.points).toBe(3);
    expect(question.metadata.isMicroCheck).toBe(true);
  });

  it("converts content blocks and composes legacy learning objects", () => {
    const block = contentBlockToLearningBlock({
      id: "block-1",
      tenantId: "tenant-1",
      ownerId: "teacher-1",
      blockType: "rubric",
      title: "Exit Ticket Rubric",
      data: { criteria: ["accuracy"] },
      version: 4,
      status: "draft",
      tags: "rubric, exit ticket, rubric",
    });

    const object = createLearningObjectFromLegacy({
      id: "lesson-1",
      tenantId: "tenant-1",
      ownerId: "teacher-1",
      title: "Energy Transfer",
      sourceType: "lesson",
      state: "needs_review",
      objectives: ["trace energy"],
      tags: ["science"],
      estimatedMinutes: 35,
      difficulty: "intermediate",
      blocks: [block],
    });

    expect(block.type).toBe("rubric");
    expect(block.metadata.tags).toEqual(["rubric", "exit ticket"]);
    expect(object.blocks[0]?.origin.sourceType).toBe("content_block");
    expect(object.state).toBe("needs_review");
  });
});
