import { createClient } from "@/lib/edsync/client";
import type { Class, Lesson, StudentProgress } from "@/types";

type Client = ReturnType<typeof createClient>;
type EntitledCourse = { id: string; title: string; description: string; courseId: string | null; sourceType: string };
type Assignment = { lesson_id: string; class_id: string };

export type StudentCourse = Lesson & {
  progress?: StudentProgress;
  sectionCount: number;
  className: string | null;
};

export function chunks<T>(items: T[], size = 50) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function required<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function errorText(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Courses could not be loaded.";
}

export function courseProgress(course: Pick<StudentCourse, "progress" | "sectionCount">) {
  if (course.progress?.status === "completed") return 100;
  if (course.progress?.status !== "in_progress" || course.sectionCount <= 0) return 0;
  const completed = new Set(course.progress.sections_completed ?? []).size;
  return Math.min(100, Math.round((completed / course.sectionCount) * 100));
}

export async function loadStudentCourses(client: Client, userId: string) {
  const [enrollments, entitlementResponse] = await Promise.all([
    client.from("class_enrollments").select("class_id").eq("student_id", userId).eq("is_active", true),
    fetch("/api/me/courses", { credentials: "include", cache: "no-store" }),
  ]);
  const classIds = ((required(enrollments) ?? []) as { class_id: string }[]).map((row) => row.class_id);
  const entitlementPayload = await entitlementResponse.json().catch(() => null) as { data?: { courses?: EntitledCourse[] }; error?: unknown } | null;
  if (!entitlementResponse.ok) throw new Error(errorText(entitlementPayload?.error));
  const personalCourses = entitlementPayload?.data?.courses ?? [];

  const classGroups = await Promise.all(chunks(classIds).map(async (ids) => {
    const [assignments, classLessons, classes] = await Promise.all([
      client.from("lesson_assignments").select("lesson_id, class_id").in("class_id", ids).eq("is_active", true),
      client.from("lessons").select("id").in("class_id", ids).eq("status", "published"),
      client.from("classes").select("id, name").in("id", ids),
    ]);
    return {
      assignments: (required(assignments) ?? []) as Assignment[],
      classLessons: (required(classLessons) ?? []) as { id: string }[],
      classes: (required(classes) ?? []) as Pick<Class, "id" | "name">[],
    };
  }));
  const assigned = classGroups.flatMap((group) => group.assignments);
  const classNames = new Map(classGroups.flatMap((group) => group.classes).map((item) => [item.id, item.name]));
  const classByLesson = new Map(assigned.map((item) => [item.lesson_id, item.class_id]));
  const lessonIds = Array.from(new Set([
    ...assigned.map((item) => item.lesson_id),
    ...classGroups.flatMap((group) => group.classLessons).map((item) => item.id),
    ...personalCourses.map((item) => item.courseId).filter((id): id is string => Boolean(id)),
  ]));
  if (!lessonIds.length) return { lessons: [] as StudentCourse[], personalCourses };

  const groups = await Promise.all(chunks(lessonIds).map(async (ids) => {
    const [lessonResult, sectionResult, progressResult] = await Promise.all([
      client.from("lessons").select("*").in("id", ids).eq("status", "published"),
      client.from("lesson_sections").select("lesson_id").in("lesson_id", ids),
      client.from("student_progress").select("*").eq("student_id", userId).in("lesson_id", ids),
    ]);
    return {
      lessons: (required(lessonResult) ?? []) as Lesson[],
      sections: (required(sectionResult) ?? []) as { lesson_id: string }[],
      progress: (required(progressResult) ?? []) as StudentProgress[],
    };
  }));
  const allLessons = groups.flatMap((group) => group.lessons);
  const sectionCounts = new Map<string, number>();
  groups.flatMap((group) => group.sections).forEach((section) => sectionCounts.set(section.lesson_id, (sectionCounts.get(section.lesson_id) ?? 0) + 1));
  const progressByLesson = new Map(groups.flatMap((group) => group.progress).map((item) => [item.lesson_id, item]));
  const lessons = allLessons.map((lesson): StudentCourse => ({
    ...lesson,
    progress: progressByLesson.get(lesson.id),
    sectionCount: sectionCounts.get(lesson.id) ?? 0,
    className: classNames.get(lesson.class_id ?? classByLesson.get(lesson.id) ?? "") ?? null,
  })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return { lessons, personalCourses };
}
