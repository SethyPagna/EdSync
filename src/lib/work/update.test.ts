import { describe, expect, it } from "vitest";
import { buildWorkSettings, mergeWorkItemPatch, newWorkItemRecord, type WorkItemRecord } from "@/lib/work/update";

const stored: WorkItemRecord = {
  title: "Lab report",
  description: "Write up the titration lab.",
  work_type: "task",
  instructions: "Use the template.",
  points_possible: 40,
  due_at: "2026-10-01T09:00",
  status: "published",
  allow_late: 0,
  lesson_id: "lesson-1",
  category_id: "category-1",
  rubric: JSON.stringify([{ criterion: "Accuracy", points: 20 }]),
  settings: JSON.stringify({
    mode: "weighted",
    gradeWeightPercent: 10,
    countsTowardGrade: true,
    participationCriteria: "",
    allowResubmission: true,
    maxAttempts: 3,
  }),
};

describe("work item PATCH merge", () => {
  it("changes only the fields that were sent", () => {
    const merged = mergeWorkItemPatch(stored, { id: "work-1", title: "  Lab report v2 " });
    expect(merged).toEqual({ ...stored, title: "Lab report v2", settings: merged.settings });
    expect(JSON.parse(merged.settings)).toEqual(JSON.parse(stored.settings));
  });

  it("keeps description, rubric and grading settings when the teacher page omits them", () => {
    const merged = mergeWorkItemPatch(stored, {
      id: "work-1",
      title: "Lab report",
      workType: "task",
      classId: "class-1",
      instructions: "Use the new template.",
      pointsPossible: 50,
      dueAt: "2026-10-02T09:00",
      status: "published",
    });
    expect(merged.description).toBe(stored.description);
    expect(merged.rubric).toBe(stored.rubric);
    expect(merged.allow_late).toBe(0);
    expect(merged.lesson_id).toBe("lesson-1");
    expect(merged.category_id).toBe("category-1");
    expect(merged).toMatchObject({ instructions: "Use the new template.", points_possible: 50, due_at: "2026-10-02T09:00" });
    expect(JSON.parse(merged.settings)).toMatchObject({ mode: "weighted", gradeWeightPercent: 10, allowResubmission: true, maxAttempts: 3 });
  });

  it("applies provided settings over the stored ones", () => {
    const merged = mergeWorkItemPatch(stored, { gradingMode: "points", maxAttempts: null, allowLate: true });
    expect(merged.allow_late).toBe(1);
    expect(JSON.parse(merged.settings)).toMatchObject({
      mode: "points",
      gradeWeightPercent: null,
      allowResubmission: true,
      maxAttempts: null,
    });
    expect(buildWorkSettings(stored.settings, { settings: { gradingMode: "completion" } })).toMatchObject({
      mode: "completion",
      countsTowardGrade: false,
      maxAttempts: 3,
    });
  });

  it("clears nullable fields only when explicitly sent", () => {
    const merged = mergeWorkItemPatch(stored, { description: null, dueAt: "", lessonId: null, categoryId: "" });
    expect(merged).toMatchObject({ description: null, due_at: null, lesson_id: null, category_id: null });
  });

  it("rejects invalid values", () => {
    expect(() => mergeWorkItemPatch(stored, { title: "   " })).toThrow("Title is required.");
    expect(() => mergeWorkItemPatch(stored, { rubric: "none" })).toThrow("Rubric must be a list.");
    expect(() => mergeWorkItemPatch(stored, { allowLate: "no" })).toThrow("Late work must be on or off.");
    expect(() => mergeWorkItemPatch(stored, { dueAt: "soon" })).toThrow("Choose a valid due date.");
    expect(() => mergeWorkItemPatch(stored, { workType: "essay" })).toThrow("supported work type");
    expect(() => mergeWorkItemPatch(stored, { lessonId: 7 })).toThrow("Choose a valid lesson.");
  });

  it("builds new work items with defaults", () => {
    expect(newWorkItemRecord({ title: "Exit ticket" })).toMatchObject({
      title: "Exit ticket",
      work_type: "task",
      status: "draft",
      points_possible: 100,
      allow_late: 1,
      rubric: "[]",
    });
    expect(() => newWorkItemRecord({})).toThrow("Title is required.");
    expect(() => newWorkItemRecord({ title: "Old", status: "archived" })).toThrow("supported work status");
  });
});
