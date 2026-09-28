import { describe, expect, it } from "vitest";
import { buildInsights } from "./insights";

describe("teacher insights", () => {
  it("uses each learner's course score in the map and averages every score equally", () => {
    const model = buildInsights(
      [{ id: "course", title: "Course", class_id: "class" }],
      [
        { id: "p1", student_id: "one", lesson_id: "course", status: "completed", score: 100, last_active: "2026-09-28" },
        { id: "p2", student_id: "two", lesson_id: "course", status: "completed", score: 0, last_active: "2026-09-28" },
      ],
      [],
      [],
    );
    expect(model.lessons[0].average).toBe(50);
    expect(model.students.find((student) => student.id === "one")?.scores.course).toBe(100);
    expect(model.students.find((student) => student.id === "two")?.scores.course).toBe(0);
  });

  it("filters class data by the supplied course set", () => {
    const model = buildInsights(
      [{ id: "a", title: "A", class_id: "class-a" }],
      [
        { id: "p1", student_id: "one", lesson_id: "a", status: "completed", score: 80, last_active: "2026-09-28" },
        { id: "p2", student_id: "two", lesson_id: "b", status: "completed", score: 20, last_active: "2026-09-28" },
      ],
      [],
      [],
    );
    expect(model.students.map((student) => student.id)).toEqual(["one"]);
    expect(model.average).toBe(80);
  });
});
