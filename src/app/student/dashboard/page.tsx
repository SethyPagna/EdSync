"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import {
  listPracticeReviews,
  type PracticeReviewCardRow,
} from "@/lib/practice/reviews";
import { summarizePracticeReviewCards } from "@/lib/practice/review-recommendations";
import {
  STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY,
  areStudentNotificationsPaused,
  defaultStudentDashboardVisibility,
  mergeStudentDashboardVisibility,
  studentNotificationToggleOptions,
  type StudentDashboardVisibility,
} from "@/lib/student/dashboard-preferences";
import { MetricTile } from "@/components/WorkspacePrimitives";
import type {
  LearningGoal,
  LearningReflection,
  Lesson,
  Announcement,
  Profile,
  ScheduleEvent,
  StudentProgress,
} from "@/types";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Compass,
  GraduationCap,
  Timer,
  Target,
} from "lucide-react";

type AssignedLesson = Lesson & {
  progress?: StudentProgress;
  sectionCount?: number;
};

type StudentPlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & {
    class_name?: string | null;
    lesson_title?: string | null;
  })[];
};

type EnrollmentRow = { class_id: string };
type AssignmentRow = { lesson_id: string };
type SectionLessonRow = { lesson_id: string };
type IndividualCourse = {
  id: string;
  title: string;
  description: string;
  courseId: string | null;
  sourceType: string;
};
type CatalogSuggestion = {
  id: string;
  title: string;
  description: string | null;
  price?: { label?: string; isFree?: boolean };
  metadata?: { category?: string | null; difficulty?: string | null };
};
function formatPlannerDate(value: string | null) {
  if (!value) return "No time set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${Math.max(0, Math.round(totalMinutes))}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function readDashboardVisibility() {
  if (typeof window === "undefined") return defaultStudentDashboardVisibility;
  try {
    return mergeStudentDashboardVisibility(
      JSON.parse(
        window.localStorage.getItem(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY) ||
          "null",
      ) as Partial<StudentDashboardVisibility> | null,
    );
  } catch {
    return defaultStudentDashboardVisibility;
  }
}

export default function StudentDashboard() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<AssignedLesson[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [reflections, setReflections] = useState<LearningReflection[]>([]);
  const [reviewCards, setReviewCards] = useState<PracticeReviewCardRow[]>([]);
  const [individualCourses, setIndividualCourses] = useState<
    IndividualCourse[]
  >([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<
    CatalogSuggestion[]
  >([]);
  const [planner, setPlanner] = useState<StudentPlannerData>({
    announcements: [],
    events: [],
  });
  const [studyTitle, setStudyTitle] = useState("Focused study block");
  const [studyAt, setStudyAt] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);
  const [savingStudy, setSavingStudy] = useState(false);
  const [tab, setTab] = useState<"today" | "courses" | "progress">("today");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<StudentDashboardVisibility>(
    readDashboardVisibility,
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) {
        setLessons([]);
        return;
      }

      const [
        profileRes,
        enrollmentsRes,
        goalsRes,
        reflectionsRes,
        plannerRes,
        reviewsRes,
        personalCoursesRes,
        catalogRes,
      ] = await Promise.all([
        edsync.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        edsync
          .from("class_enrollments")
          .select("class_id")
          .eq("student_id", user.id)
          .eq("is_active", true),
        edsync
          .from("learning_goals")
          .select("*")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
        edsync
          .from("learning_reflections")
          .select("*")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
        fetch("/api/planner", {
          credentials: "include",
          cache: "no-store",
        }).then((res) => res.json()),
        listPracticeReviews().catch(() => []),
        fetch("/api/me/courses", { cache: "no-store" }).then(
          async (response) => {
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "Could not load your courses.");
            return result;
          },
        ),
        fetch("/api/catalog", { cache: "no-store" })
          .then((res) => res.json())
          .catch(() => ({ data: { items: [] } })),
      ]);

      if (profileRes.error || enrollmentsRes.error)
        throw new Error("Dashboard unavailable");
      setProfile(profileRes.data);
      setGoals(goalsRes.data || []);
      setReflections(reflectionsRes.data || []);
      setPlanner(plannerRes.data || { announcements: [], events: [] });
      setReviewCards(reviewsRes ?? []);
      setCatalogSuggestions((catalogRes.data?.items ?? []).slice(0, 3));

      setIndividualCourses(personalCoursesRes.data?.courses ?? []);

      const classIds = ((enrollmentsRes.data || []) as EnrollmentRow[]).map(
        (row) => row.class_id,
      );
      if (classIds.length === 0) {
        setLessons([]);
        return;
      }

      const { data: assignments } = await edsync
        .from("lesson_assignments")
        .select("lesson_id")
        .in("class_id", classIds)
        .eq("is_active", true);

      const lessonIds = Array.from(
        new Set(
          ((assignments || []) as AssignmentRow[]).map(
            (assignment) => assignment.lesson_id,
          ),
        ),
      );

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
        edsync
          .from("lesson_sections")
          .select("lesson_id")
          .in("lesson_id", lessonIds),
        edsync
          .from("student_progress")
          .select("*")
          .eq("student_id", user.id)
          .in("lesson_id", lessonIds),
      ]);

      const sectionCounts = new Map<string, number>();
      ((sectionRes.data || []) as SectionLessonRow[]).forEach((section) => {
        sectionCounts.set(
          section.lesson_id,
          (sectionCounts.get(section.lesson_id) || 0) + 1,
        );
      });
      const progressByLesson = new Map(
        ((progressRes.data || []) as StudentProgress[]).map((progress) => [
          progress.lesson_id,
          progress,
        ]),
      );

      setLessons(
        ((lessonRes.data || []) as Lesson[]).map((lesson) => ({
          ...lesson,
          progress: progressByLesson.get(lesson.id),
          sectionCount: sectionCounts.get(lesson.id) || 0,
        })),
      );
    } catch (error) {
      console.error(error);
      setLoadError("We couldn’t load your learning space. Please try again.");
      toast.error("Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadDashboard]);

  const toggleVisibility = (key: keyof StudentDashboardVisibility) => {
    setVisibility((current) => {
      const nextValue = { ...current, [key]: !current[key] };
      window.localStorage.setItem(
        STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY,
        JSON.stringify(nextValue),
      );
      return nextValue;
    });
  };

  const joinClass = async () => {
    if (!joinCode.trim()) return;
    setJoiningClass(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setJoiningClass(false);
      return;
    }

    const { data: cls, error: clsError } = await edsync
      .from("classes")
      .select("id, name")
      .eq("join_code", joinCode.trim().toUpperCase())
      .maybeSingle();

    if (clsError) {
      toast.error(`Could not look up space: ${clsError.message}`);
      setJoiningClass(false);
      return;
    }

    if (!cls) {
      toast.error(
        "Invalid access code. Ask the creator or organization for the current code.",
      );
      setJoiningClass(false);
      return;
    }

    const { error } = await edsync
      .from("class_enrollments")
      .upsert(
        { class_id: cls.id, student_id: user.id, is_active: true },
        { onConflict: "class_id,student_id" },
      );

    if (error) {
      toast.error(`Could not join space: ${error.message}`);
    } else {
      toast.success(`Access added: ${cls.name}.`);
      setJoinCode("");
      await loadDashboard();
    }
    setJoiningClass(false);
  };

  const createGoal = async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;
    const { data, error } = await edsync
      .from("learning_goals")
      .insert({
        student_id: user.id,
        title: "Complete one focused lesson",
        target_type: "weekly_lessons",
        target_value: 1,
        current_value: lessons.filter(
          (lesson) => lesson.progress?.status === "completed",
        ).length,
        due_date: new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      toast.error(`Could not create goal: ${error.message}`);
      return;
    }
    setGoals((current) => [data, ...current]);
    toast.success("Learning goal created.");
  };

  const createStudyBlock = async () => {
    if (!studyTitle.trim()) {
      toast.error("Name the study block first.");
      return;
    }
    setSavingStudy(true);
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: studyTitle.trim(),
          description: "Personal study time",
          startsAt: studyAt ? new Date(studyAt).toISOString() : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || "Could not add study block.",
        );
      toast.success("Study block added.");
      setStudyTitle("Focused study block");
      setStudyAt("");
      await loadDashboard();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add study block.",
      );
    } finally {
      setSavingStudy(false);
    }
  };

  const { completed, active, next } = useMemo(() => {
    const completedLessons: AssignedLesson[] = [];
    const activeLessons: AssignedLesson[] = [];
    const nextLessons: AssignedLesson[] = [];

    for (const lesson of lessons) {
      const status = lesson.progress?.status;
      if (status === "completed") {
        completedLessons.push(lesson);
      } else if (status === "in_progress") {
        activeLessons.push(lesson);
      } else {
        nextLessons.push(lesson);
      }
    }

    return {
      completed: completedLessons,
      active: activeLessons,
      next: nextLessons,
    };
  }, [lessons]);

  const recommendation = active[0] || next[0];
  const totalTimeSpent = useMemo(
    () =>
      lessons.reduce(
        (sum, lesson) => sum + Number(lesson.progress?.time_spent ?? 0),
        0,
      ),
    [lessons],
  );
  const reviewRecommendation = useMemo(
    () => summarizePracticeReviewCards(reviewCards),
    [reviewCards],
  );
  const visibleReviewRecommendation = visibility.practice
    ? reviewRecommendation
    : null;
  const assignmentEvents = useMemo(
    () => planner.events.filter((event) => event.event_type === "deadline"),
    [planner.events],
  );
  const otherEvents = useMemo(
    () => planner.events.filter((event) => event.event_type !== "deadline"),
    [planner.events],
  );
  const visibleEvents = [
    ...(visibility.deadlines ? assignmentEvents : []),
    ...(visibility.assignments ? otherEvents : []),
  ];
  const notificationsPaused = areStudentNotificationsPaused(visibility);

  return (
    <div className="page-shell space-y-6">
      <header className="premium-panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-edsync-subtle">Your learning space</p>
          <h1 className="font-display font-bold">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Learner"}
            <span className="text-edsync-blue">.</span>
          </h1>
        </div>
        <Link href="/student/planner" className="btn-secondary">
          <CalendarClock size={16} />
          My planner
        </Link>
      </header>
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-edsync-red/30 p-4 text-sm text-edsync-red"
        >
          {loadError}
          <button
            className="ml-3 underline"
            onClick={() => void loadDashboard()}
          >
            Retry
          </button>
        </div>
      )}
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {(["today", "courses", "progress"] as const).map(
          (value, index, tabs) => (
            <button
              key={value}
              id={"tab-" + value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              aria-controls={"panel-" + value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const nextTab =
                    tabs[
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              tabs.length) %
                            tabs.length
                    ];
                  setTab(nextTab);
                  document.getElementById("tab-" + nextTab)?.focus();
                }
              }}
            >
              {value === "today"
                ? "Today"
                : value === "courses"
                  ? "My courses"
                  : "Progress"}
            </button>
          ),
        )}
      </div>
      <section
        id={"panel-" + tab}
        role="tabpanel"
        aria-labelledby={"tab-" + tab}
        className="space-y-5"
      >
        {tab === "today" && (
          <>
            {loading ? (
              <div
                className="h-40 animate-pulse rounded-2xl bg-edsync-muted"
                aria-label="Loading your next lesson"
              />
            ) : (
              <section className="focus-banner">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-200">
                    {recommendation ? "Your next step" : "A fresh start"}
                  </span>
                  <h2 className="font-display">
                    {recommendation?.title || "What will you learn today?"}
                  </h2>
                  <p>
                    {recommendation
                      ? (recommendation.subject || "Your course") +
                        " · " +
                        (recommendation.estimated_duration || "Self-paced") +
                        (recommendation.estimated_duration ? " min" : "")
                      : "Make a little space for something new."}
                  </p>
                </div>
                <Link
                  href={
                    recommendation
                      ? "/student/lessons/" + recommendation.id
                      : "/catalog"
                  }
                  className="btn-primary"
                >
                  {recommendation ? "Continue learning" : "Explore courses"}
                  <ArrowRight size={16} />
                </Link>
              </section>
            )}
            <div className="grid grid-cols-4 gap-3">
              {[
                {
                  label: "In progress",
                  value: active.length,
                  icon: BookOpenCheck,
                },
                {
                  label: "Completed",
                  value: completed.length,
                  icon: CheckCircle2,
                },
                {
                  label: "Learning time",
                  value: formatMinutes(totalTimeSpent),
                  icon: Timer,
                },
                {
                  label: "To review",
                  value: reviewRecommendation?.count ?? 0,
                  icon: GraduationCap,
                },
              ].map((item) => (
                <MetricTile
                  key={item.label}
                  {...item}
                  value={loading ? "…" : item.value}
                  compact
                />
              ))}
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
              <section className="premium-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display font-bold">Up next</h2>
                  <button
                    className="text-xs font-semibold text-edsync-blue"
                    onClick={() => setTab("courses")}
                  >
                    All courses <ArrowRight className="inline" size={13} />
                  </button>
                </div>
                {visibleReviewRecommendation && (
                  <Link
                    href={visibleReviewRecommendation.href}
                    className="mb-3 flex items-center gap-3 rounded-xl bg-edsync-amber/10 p-3 text-sm"
                  >
                    <GraduationCap size={20} className="text-edsync-amber" />
                    <span className="flex-1">
                      {visibleReviewRecommendation.title}
                    </span>
                    <ArrowRight size={16} />
                  </Link>
                )}
                {visibility.newContent &&
                  [...active, ...next].slice(0, 3).map((lesson) => (
                    <div className="mb-2" key={lesson.id}>
                      <LessonCard lesson={lesson} />
                    </div>
                  ))}
                {!loading &&
                  (!visibility.newContent ||
                    (!active.length && !next.length)) && (
                    <p className="py-5 text-sm text-edsync-subtle">
                      {!visibility.newContent
                        ? "Course updates are hidden in your preferences."
                        : "You’re all caught up. Explore a course when you’re ready."}
                    </p>
                  )}
              </section>
              <aside className="space-y-4">
                <section className="premium-surface p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display font-bold">On your schedule</h2>
                    <CalendarClock size={18} className="text-edsync-blue" />
                  </div>
                  {visibleEvents.slice(0, 3).map((event) => (
                    <Link
                      href="/student/planner"
                      key={event.id}
                      className="block border-b border-edsync-border py-3 last:border-0"
                    >
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="mt-1 text-xs text-edsync-subtle">
                        {formatPlannerDate(event.due_at || event.starts_at)}
                      </p>
                    </Link>
                  ))}
                  {!visibleEvents.length && (
                    <p className="text-sm text-edsync-subtle">
                      A little breathing room. Plan your next study session.
                    </p>
                  )}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-edsync-blue">
                      Schedule study time
                    </summary>
                    <form
                      className="mt-3 grid gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void createStudyBlock();
                      }}
                    >
                      <input
                        aria-label="Study block title"
                        required
                        className="edsync-input"
                        value={studyTitle}
                        onChange={(event) => setStudyTitle(event.target.value)}
                      />
                      <input
                        aria-label="Study time"
                        type="datetime-local"
                        required
                        className="edsync-input"
                        value={studyAt}
                        onChange={(event) => setStudyAt(event.target.value)}
                      />
                      <button className="btn-primary" disabled={savingStudy}>
                        {savingStudy ? "Saving…" : "Add to planner"}
                      </button>
                    </form>
                  </details>
                </section>
                <details className="compact-guide">
                  <summary>
                    <UsersIcon />
                    Have an access code?
                  </summary>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void joinClass();
                    }}
                  >
                    <input
                      aria-label="Class access code"
                      placeholder="Access code"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      className="edsync-input min-w-0 uppercase"
                      required
                    />
                    <button
                      className="btn-primary"
                      disabled={joiningClass || !joinCode.trim()}
                    >
                      {joiningClass ? "Joining…" : "Join"}
                    </button>
                  </form>
                </details>
              </aside>
            </div>
            <details className="compact-guide">
              <summary>Updates & preferences</summary>
              <div className="mt-4 flex flex-wrap gap-2">
                {studentNotificationToggleOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleVisibility(key)}
                    aria-pressed={visibility[key]}
                    className={
                      "rounded-lg border px-3 py-2 text-xs " +
                      (visibility[key]
                        ? "border-edsync-blue text-edsync-blue"
                        : "border-edsync-border text-edsync-subtle")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!notificationsPaused &&
                planner.announcements.slice(0, 3).map((item) => (
                  <div key={item.id} className="mt-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-edsync-subtle">
                      {item.body}
                    </p>
                  </div>
                ))}
            </details>
          </>
        )}
        {tab === "courses" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">Your library</h2>
              <Link href="/catalog" className="btn-secondary">
                <Compass size={16} />
                Explore
              </Link>
            </div>
            {individualCourses.map((course) => (
              <Link
                key={course.id}
                className="premium-card flex items-center gap-3 p-4"
                href={
                  course.courseId
                    ? "/student/lessons/" + course.courseId
                    : "/catalog"
                }
              >
                <BookOpenCheck size={22} />
                <span className="flex-1 text-sm font-semibold">
                  {course.title}
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {active.length > 0 && (
              <LessonGroup title="In progress" lessons={active} />
            )}
            {next.length > 0 && (
              <LessonGroup title="Ready to start" lessons={next} />
            )}
            {completed.length > 0 && (
              <details className="compact-guide">
                <summary>Completed · {completed.length}</summary>
                <div className="mt-4">
                  <LessonGroup title="Completed" lessons={completed} />
                </div>
              </details>
            )}
            {!loading && !lessons.length && !individualCourses.length && (
              <div className="premium-surface p-8 text-center">
                <BookOpenCheck
                  size={32}
                  className="mx-auto mb-3 text-edsync-blue"
                />
                <h2 className="font-display">Your next chapter starts here</h2>
                <Link className="btn-primary mt-4" href="/catalog">
                  Find a course
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
            {catalogSuggestions.length > 0 && (
              <details className="compact-guide">
                <summary>Something new to explore</summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {catalogSuggestions.map((item) => (
                    <Link
                      key={item.id}
                      href={"/catalog/" + item.id}
                      className="premium-card p-4"
                    >
                      <span className="text-xs text-edsync-blue">
                        {item.price?.label ?? "Course"}
                      </span>
                      <p className="mt-2 text-sm font-semibold">{item.title}</p>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        {tab === "progress" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Courses completed"
                value={completed.length}
                icon={CheckCircle2}
              />
              <MetricTile
                label="Total learning time"
                value={formatMinutes(totalTimeSpent)}
                icon={Timer}
              />
              <MetricTile
                label="Learning goals"
                value={goals.length}
                icon={Target}
              />
            </div>
            <section className="premium-surface p-5">
              <div className="mb-4 flex justify-between">
                <h2 className="font-display font-bold">Your goals</h2>
                <button
                  className="text-sm text-edsync-blue"
                  onClick={() => void createGoal()}
                >
                  + Add goal
                </button>
              </div>
              {!goals.length && (
                <p className="text-sm text-edsync-subtle">
                  Start small. Set a goal for your next lesson.
                </p>
              )}
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="border-t border-edsync-border py-4"
                >
                  <p className="text-sm font-semibold">{goal.title}</p>
                  <progress
                    className="mt-3 h-2 w-full accent-edsync-blue"
                    aria-label={goal.title}
                    max={Math.max(1, goal.target_value)}
                    value={goal.current_value}
                  />
                  <p className="mt-1 text-xs text-edsync-subtle">
                    {goal.current_value} of {goal.target_value}
                  </p>
                </div>
              ))}
            </section>
            <details className="compact-guide">
              <summary>Reflections · {reflections.length}</summary>
              {reflections.map((item) => (
                <div className="mt-4 text-sm" key={item.id}>
                  <p>{item.reflection}</p>
                  {item.next_step && (
                    <p className="mt-1 text-edsync-subtle">
                      Next: {item.next_step}
                    </p>
                  )}
                </div>
              ))}
            </details>
            <Link href="/student/grades" className="btn-secondary">
              View grades & feedback
              <ArrowRight size={16} />
            </Link>
          </>
        )}
      </section>
    </div>
  );
}

function UsersIcon() {
  return <GraduationCap size={18} className="text-edsync-blue" />;
}

function LessonGroup({
  title,
  lessons,
}: {
  title: string;
  lessons: AssignedLesson[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-edsync-subtle">
        {title}
      </h3>
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: AssignedLesson }) {
  const progress = lesson.progress;
  const totalSections = Math.max(1, lesson.sectionCount || 1);
  const pct =
    progress?.status === "completed"
      ? 100
      : progress?.status === "in_progress"
        ? Math.min(
            100,
            Math.round(
              ((progress.sections_completed?.length || 0) / totalSections) *
                100,
            ),
          )
        : 0;

  return (
    <Link
      href={`/student/lessons/${lesson.id}`}
      className="flex items-center gap-4 rounded-2xl border border-edsync-border bg-edsync-surface p-4 transition hover:border-edsync-blue/50 hover:bg-edsync-card"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
        <BookOpenCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-edsync-text">
          {lesson.title}
        </p>
        <p className="mt-1 text-xs text-edsync-subtle">
          {lesson.subject || "General"} - {lesson.estimated_duration} min -
          {lesson.difficulty}
        </p>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-edsync-subtle">
            <span>{progress?.status?.replace("_", " ") || "not started"}</span>
            <span className="font-semibold text-edsync-blue">{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-edsync-subtle" />
    </Link>
  );
}
