"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, SlidersHorizontal } from "lucide-react";
import { Button, EmptyState, LinkButton, PageHeader, SearchInput, Segmented, Skeleton, Toolbar } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import CourseCard from "@/components/student-home/CourseCard";
import { loadStudentCourses, type StudentCourse } from "@/components/student-home/data";

type ProgressFilter = "all" | "in_progress" | "completed";
type DurationFilter = "all" | "short" | "medium" | "long";
type SemesterFilter = "all" | "spring" | "summer" | "fall";

function courseYear(value: string) { const year = new Date(value).getFullYear(); return Number.isNaN(year) ? null : String(year); }
function courseSemester(value: string): Exclude<SemesterFilter, "all"> | null {
  const month = new Date(value).getMonth();
  if (Number.isNaN(month)) return null;
  return month <= 4 ? "spring" : month <= 7 ? "summer" : "fall";
}
function matchesDuration(course: StudentCourse, duration: DurationFilter) {
  if (duration === "short") return course.estimated_duration <= 20;
  if (duration === "medium") return course.estimated_duration > 20 && course.estimated_duration <= 60;
  if (duration === "long") return course.estimated_duration > 60;
  return true;
}

export default function StudentLessonsPage() {
  const client = useMemo(() => createClient(), []);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [personal, setPersonal] = useState<{ id: string; title: string; courseId: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProgressFilter>("all");
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [semester, setSemester] = useState<SemesterFilter>("all");
  const [year, setYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in to view your courses.");
      const result = await loadStudentCourses(client, user.id);
      setCourses(result.lessons);
      setPersonal(result.personalCourses);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Courses could not load."); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const years = useMemo(() => Array.from(new Set(courses.map((course) => courseYear(course.created_at)).filter((value): value is string => Boolean(value)))).sort((a, b) => Number(b) - Number(a)), [courses]);
  const visible = useMemo(() => courses.filter((course) => {
    const status = course.progress?.status ?? "not_started";
    if (filter === "completed" && status !== "completed") return false;
    if (filter === "in_progress" && status !== "in_progress") return false;
    if (!matchesDuration(course, duration)) return false;
    if (semester !== "all" && courseSemester(course.created_at) !== semester) return false;
    if (year !== "all" && courseYear(course.created_at) !== year) return false;
    return `${course.title} ${course.subject ?? ""} ${course.className ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [courses, duration, filter, search, semester, year]);
  const unlinked = personal.filter((item) => !item.courseId);
  const hasFilters = Boolean(search || filter !== "all" || duration !== "all" || semester !== "all" || year !== "all");

  return (
    <div className="page">
      <PageHeader title="Courses" count={courses.length} actions={<LinkButton href="/catalog" variant="secondary" size="sm">Explore</LinkButton>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search courses" />
        <Segmented value={filter} onChange={setFilter} ariaLabel="Course progress" options={[{ value: "all", label: "All" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Done" }]} />
      </Toolbar>
      <details className="mb-5 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 text-fg-muted"><SlidersHorizontal className="size-4" />More filters{duration !== "all" || semester !== "all" || year !== "all" ? " · Active" : ""}</summary>
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-3">
          <select aria-label="Duration" className="select" value={duration} onChange={(event) => setDuration(event.target.value as DurationFilter)}><option value="all">Any duration</option><option value="short">Under 20 min</option><option value="medium">21–60 min</option><option value="long">Over 60 min</option></select>
          <select aria-label="Creation season" className="select" value={semester} onChange={(event) => setSemester(event.target.value as SemesterFilter)}><option value="all">Any season</option><option value="spring">Spring</option><option value="summer">Summer</option><option value="fall">Fall</option></select>
          <select aria-label="Creation year" className="select" value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Any year</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </details>
      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"><span>{error}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>}
      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-44 rounded-xl" />)}</div> : visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((course) => <CourseCard key={course.id} course={course} />)}</div>
      ) : !error ? <EmptyState icon={BookOpen} title={hasFilters ? "No matching courses" : "No courses yet"} action={hasFilters ? <Button onClick={() => { setSearch(""); setFilter("all"); setDuration("all"); setSemester("all"); setYear("all"); }}>Clear filters</Button> : <LinkButton href="/student/classes" variant="primary">Get access</LinkButton>} /> : null}
      {!loading && unlinked.length > 0 && <section className="mt-7"><h2 className="mb-3 text-sm font-medium text-fg">Other access</h2><div className="grid gap-2 sm:grid-cols-2">{unlinked.map((item) => <LinkButton key={item.id} href="/catalog" variant="secondary" className="justify-start">{item.title}</LinkButton>)}</div></section>}
    </div>
  );
}
