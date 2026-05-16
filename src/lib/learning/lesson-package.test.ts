import { describe, expect, it } from "vitest";

import { lessonRowsToLearningObject, summarizeLearningObject } from "./lesson-package";

describe("lesson package learning objects", () => {
  it("composes lesson rows, sections, and questions into one learning object", () => {
    const object = lessonRowsToLearningObject({
      lesson: {
        id: "lesson-1",
        tenant_id: "tenant-1",
        teacher_id: "teacher-1",
        class_id: "class-1",
        title: "Energy Transfer",
        description: "A short lesson about energy.",
        objectives: ["Explain transfer"],
        subject: "Science",
        grade_level: "Grade 7",
        status: "published",
        difficulty: "intermediate",
        estimated_duration: 30,
        tags: ["science", "energy"],
        ai_generated: 1,
      },
      sections: [
        {
          id: "section-2",
          lesson_id: "lesson-1",
          title: "Practice",
          content: "Solve the scenario.",
          content_type: "activity",
          order_index: 2,
          duration_minutes: 12,
          is_required: true,
        },
        {
          id: "section-1",
          lesson_id: "lesson-1",
          title: "Concept",
          content: "Energy moves between systems.",
          content_type: "text",
          order_index: 1,
          duration_minutes: 8,
          is_required: true,
        },
      ],
      questions: [
        {
          id: "question-1",
          lesson_id: "lesson-1",
          section_id: "section-2",
          question_text: "Where did the energy go?",
          question_type: "short_answer",
          points: 2,
          order_index: 1,
        },
      ],
    });

    expect(object.kind).toBe("lesson_package");
    expect(object.state).toBe("published");
    expect(object.ownerId).toBe("teacher-1");
    expect(object.metadata).toMatchObject({
      classId: "class-1",
      subject: "Science",
      aiGenerated: true,
    });
    expect(object.blocks.map((block) => block.id)).toEqual(["section-1", "section-2", "question-1"]);
  });

  it("summarizes learning object blocks for UI handoffs", () => {
    const object = lessonRowsToLearningObject({
      lesson: {
        id: "lesson-1",
        teacher_id: "teacher-1",
        title: "Draft Lesson",
        status: "draft",
        estimated_duration: 20,
      },
      sections: [
        {
          id: "section-1",
          lesson_id: "lesson-1",
          title: "Read",
          content: "Read the source.",
          content_type: "text",
          order_index: 0,
          duration_minutes: 5,
          is_required: true,
        },
      ],
    });

    expect(summarizeLearningObject(object)).toMatchObject({
      total: 1,
      required: 1,
      estimatedMinutes: 25,
      byType: { text: 1 },
    });
  });
});
