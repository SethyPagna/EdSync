import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/edsync/client";
import type { Lesson, StudentProgress } from "@/types";
import { courseProgress, loadStudentCourses, type StudentCourse } from "./data";

const lesson = { id: "lesson-1", title: "Biology", class_id: null, status: "published", updated_at: "2026-09-20T10:00:00Z" } as Lesson;

afterEach(() => vi.unstubAllGlobals());

function clientWith(rows: Record<string, unknown[]>, onIn?: (size: number) => void) {
  class FakeQuery {
    constructor(private data: unknown[]) {}
    select() { return this; }
    eq() { return this; }
    in(_column: string, values: unknown[]) { onIn?.(values.length); return this; }
    then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
      return Promise.resolve({ data: this.data, error: null }).then(resolve);
    }
  }
  return {
    from(table: string) {
      return new FakeQuery(rows[table] ?? []);
    },
  } as unknown as ReturnType<typeof createClient>;
}

describe("student course data", () => {
  it("includes an entitled course even when the student has no class", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { courses: [{ id: "product-1", title: "Biology", description: "", courseId: lesson.id, sourceType: "manual" }] } }), { status: 200 })));
    const client = clientWith({ lessons: [lesson], lesson_sections: [{ lesson_id: lesson.id }], student_progress: [] });
    const result = await loadStudentCourses(client, "student-1");
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0].id).toBe(lesson.id);
    expect(result.lessons[0].className).toBeNull();
    expect(result.lessons[0].sectionCount).toBe(1);
  });

  it("counts unique completed sections and keeps a real zero", () => {
    const course = { ...lesson, sectionCount: 4, progress: { status: "in_progress", sections_completed: ["s1", "s1"] } as StudentProgress } as StudentCourse;
    expect(courseProgress(course)).toBe(25);
    expect(courseProgress({ ...course, progress: undefined })).toBe(0);
    expect(courseProgress({ ...course, progress: { ...course.progress!, status: "completed" } })).toBe(100);
  });

  it("batches class lookups below D1's bound-parameter limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { courses: [] } }), { status: 200 })));
    const sizes: number[] = [];
    const client = clientWith({
      class_enrollments: Array.from({ length: 120 }, (_, index) => ({ class_id: `class-${index}` })),
    }, (size) => sizes.push(size));
    const result = await loadStudentCourses(client, "student-1");
    expect(result.lessons).toEqual([]);
    expect(sizes).toEqual([50, 50, 50, 50, 50, 50, 20, 20, 20]);
  });
});
