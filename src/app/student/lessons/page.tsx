"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Search, Target } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import type { Lesson, StudentProgress } from "@/types";

type AssignedLesson = Lesson & {
  progress?: StudentProgress;
  sectionCount?: number;
};

type EnrollmentRow = { class_id: string };
type AssignmentRow = { lesson_id: string };
type SectionLessonRow = { lesson_id: string };
type ProgressFilter = "all" | "not_started" | "in_progress" | "completed";
type DurationFilter = "all" | "short" | "medium" | "long";
type SemesterFilter = "all" | "spring" | "summer" | "fall";

const PROGRESS_FILTERS: Array<{ value: ProgressFilter; label: string }> = [
  { value: "all", label: "Any progress" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];
const SEMESTER_FILTERS: Array<{ value: SemesterFilter; label: string }> = [
  { value: "all", label: "Any term" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
];

function courseYear(value: string) {
  const year = new Date(value).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

function courseSemester(value: string): Exclude<SemesterFilter, "all"> | null {
  const month = new Date(value).getMonth();
  if (Number.isNaN(month)) return null;
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "fall";
}

function matchesDuration(lesson: AssignedLesson, durationFilter: DurationFilter) {
  if (durationFilter === "short") return lesson.estimated_duration <= 20;
  if (durationFilter === "medium") return lesson.estimated_duration >= 21 && lesson.estimated_duration <= 60;
  if (durationFilter === "long") return lesson.estimated_duration >= 61;
  return true;
}

export default function StudentLessonsPage() {
  const edsync = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<AssignedLesson[]>([]);
  const [search, setSearch] = useState("");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [semesterFilter, setSemesterFilter] = useState<SemesterFilter>("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) {
        setLessons([]);
        return;
      }

      const { data: enrollments } = await edsync
        .from("class_enrollments")
        .select("class_id")
        .eq("student_id", user.id)
        .eq("is_active", true);
      const classIds = ((enrollments || []) as EnrollmentRow[]).map((row) => row.class_id);
      if (classIds.length === 0) {
        setLessons([]);
        return;
      }

      const { data: assignments } = await edsync
        .from("lesson_assignments")
        .select("lesson_id")
        .in("class_id", classIds)
        .eq("is_active", true);
      const lessonIds = Array.from(new Set(((assignments || []) as AssignmentRow[]).map((assignment) => assignment.lesson_id)));
      if (lessonIds.length === 0) {
        setLessons([]);
        return;
      }

      const [lessonRes, sectionRes, progressRes] = await Promise.all([
        edsync
          .from("lessons")
          .select("*")
          .in("id", lessonIds)
          .eq("status", "published")
          .order("updated_at", { ascending: false }),
        edsync.from("lesson_sections").select("lesson_id").in("lesson_id", lessonIds),
        edsync
          .from("student_progress")
          .select("*")
          .eq("student_id", user.id)
          .in("lesson_id", lessonIds),
      ]);

      const sectionCounts = new Map<string, number>();
      ((sectionRes.data || []) as SectionLessonRow[]).forEach((section) => {
        sectionCounts.set(section.lesson_id, (sectionCounts.get(section.lesson_id) || 0) + 1);
      });
      const progressByLesson = new Map(
        ((progressRes.data || []) as StudentProgress[]).map((progress) => [progress.lesson_id, progress]),
      );

      setLessons(
        ((lessonRes.data || []) as Lesson[]).map((lesson) => ({
          ...lesson,
          progress: progressByLesson.get(lesson.id),
          sectionCount: sectionCounts.get(lesson.id) || 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLessons();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadLessons]);

  const completedCount = lessons.filter((lesson) => lesson.progress?.status === "completed").length;
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    lessons.forEach((lesson) => {
      const year = courseYear(lesson.created_at);
      if (year) years.add(year);
    });
    return ["all", ...Array.from(years).sort((left, right) => Number(right) - Number(left))];
  }, [lessons]);
  const filteredLessons = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const progress = lesson.progress?.status ?? "not_started";
      if (progressFilter !== "all" && progress !== progressFilter) return false;
      if (!matchesDuration(lesson, durationFilter)) return false;
      if (semesterFilter !== "all" && courseSemester(lesson.created_at) !== semesterFilter) return false;
      if (yearFilter !== "all" && courseYear(lesson.created_at) !== yearFilter) return false;
      if (normalizedSearch && !`${lesson.title} ${lesson.subject ?? ""}`.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [durationFilter, lessons, progressFilter, search, semesterFilter, yearFilter]);

  return (
    <div className="page-shell space-y-5">
      <header className="premium-panel rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">Learner courses</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Courses</h1>
            <p className="mt-1 text-sm text-edsync-subtle">Active courses, progress, and next steps in one place.</p>
          </div>
          <div className="rounded-xl border border-edsync-border bg-edsync-surface px-4 py-3 text-sm font-semibold text-edsync-subtle">
            {completedCount} of {lessons.length} complete
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-edsync-border bg-edsync-card p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,auto)]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-edsync-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses..."
              className="edsync-input py-2 pl-10"
            />
          </label>
          <select
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}
            className="edsync-input w-full py-2 text-sm sm:w-40"
            aria-label="Filter by progress"
          >
            {PROGRESS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            value={durationFilter}
            onChange={(event) => setDurationFilter(event.target.value as DurationFilter)}
            className="edsync-input w-full py-2 text-sm sm:w-44"
            aria-label="Filter by duration"
          >
            <option value="all">Any duration</option>
            <option value="short">Short, 1-20 min</option>
            <option value="medium">Medium, 21-60 min</option>
            <option value="long">Long, 61+ min</option>
          </select>
          <select
            value={semesterFilter}
            onChange={(event) => setSemesterFilter(event.target.value as SemesterFilter)}
            className="edsync-input w-full py-2 text-sm sm:w-36"
            aria-label="Filter by semester"
          >
            {SEMESTER_FILTERS.map((semester) => (
              <option key={semester.value} value={semester.value}>
                {semester.label}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="edsync-input w-full py-2 text-sm sm:w-32"
            aria-label="Filter by year"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year === "all" ? "Any year" : year}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-edsync-card" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
          <h2 className="font-display text-xl font-bold">No courses yet</h2>
          <p className="mt-1 text-sm text-edsync-subtle">Join an organization or open a course when it is available.</p>
          <Link href="/student/dashboard" className="btn-secondary mx-auto mt-4 w-fit px-4 py-2 text-sm">
            Back to dashboard
          </Link>
        </section>
      ) : filteredLessons.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
          <h2 className="font-display text-xl font-bold">No matching courses</h2>
          <p className="mt-1 text-sm text-edsync-subtle">Adjust the filters to see more courses.</p>
        </section>
      ) : (
        <section className="grid gap-3">
          {filteredLessons.map((lesson) => {
            const totalSections = Math.max(1, lesson.sectionCount || 1);
            const pct =
              lesson.progress?.status === "completed"
                ? 100
                : lesson.progress?.status === "in_progress"
                  ? Math.min(100, Math.round(((lesson.progress.sections_completed?.length || 0) / totalSections) * 100))
                  : 0;
            return (
              <Link
                key={lesson.id}
                href={`/student/lessons/${lesson.id}`}
                className="premium-card group grid gap-4 rounded-2xl p-4 transition hover:-translate-y-0.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display text-lg font-bold">{lesson.title}</h2>
                    {lesson.progress?.status === "completed" && <CheckCircle2 className="h-4 w-4 text-edsync-emerald" />}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-edsync-subtle">
                    <span>{lesson.subject || "General"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {lesson.estimated_duration} min
                    </span>
                    <span>{lesson.difficulty}</span>
                  </p>
                  <div className="mt-3 progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                  Open <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
