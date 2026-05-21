"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { listPracticeReviews, type PracticeReviewCardRow } from "@/lib/practice/reviews";
import { summarizePracticeReviewCards } from "@/lib/practice/review-recommendations";
import { MetricTile } from "@/components/WorkspacePrimitives";
import OrganizationContextBanner from "@/components/OrganizationContextBanner";
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
  Flame,
  GraduationCap,
  Megaphone,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";

type AssignedLesson = Lesson & {
  progress?: StudentProgress;
  sectionCount?: number;
};

type StudentPlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};

type EnrollmentRow = { class_id: string };
type AssignmentRow = { lesson_id: string };
type SectionLessonRow = { lesson_id: string };

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

export default function StudentDashboard() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<AssignedLesson[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [reflections, setReflections] = useState<LearningReflection[]>([]);
  const [reviewCards, setReviewCards] = useState<PracticeReviewCardRow[]>([]);
  const [planner, setPlanner] = useState<StudentPlannerData>({
    announcements: [],
    events: [],
  });
  const [studyTitle, setStudyTitle] = useState("Focused study block");
  const [studyAt, setStudyAt] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);
  const [savingStudy, setSavingStudy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) {
        setLessons([]);
        return;
      }

      const [profileRes, enrollmentsRes, goalsRes, reflectionsRes, plannerRes, reviewsRes] =
        await Promise.all([
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
          fetch("/api/planner", { credentials: "include", cache: "no-store" }).then((res) =>
            res.json(),
          ),
          listPracticeReviews().catch(() => []),
        ]);

      setProfile(profileRes.data);
      setGoals(goalsRes.data || []);
      setReflections(reflectionsRes.data || []);
      setPlanner(plannerRes.data || { announcements: [], events: [] });
      setReviewCards(reviewsRes ?? []);

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
        new Set(((assignments || []) as AssignmentRow[]).map((assignment) => assignment.lesson_id)),
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
      toast.error("Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
      toast.error(`Could not look up class: ${clsError.message}`);
      setJoiningClass(false);
      return;
    }

    if (!cls) {
      toast.error("Invalid join code. Ask your teacher for the current code.");
      setJoiningClass(false);
      return;
    }

    const { error } = await edsync.from("class_enrollments").upsert(
      { class_id: cls.id, student_id: user.id, is_active: true },
      { onConflict: "class_id,student_id" },
    );

    if (error) {
      toast.error(`Could not join class: ${error.message}`);
    } else {
      toast.success(`Joined ${cls.name}.`);
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
        current_value: lessons.filter((lesson) => lesson.progress?.status === "completed")
          .length,
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
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
    const response = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: studyTitle,
        description: "Personal study time",
        startsAt: studyAt || null,
      }),
    });
    const payload = await response.json();
    setSavingStudy(false);
    if (!response.ok) {
      toast.error(payload.error?.message || "Could not add study block.");
      return;
    }
    toast.success("Study block added.");
    setStudyTitle("Focused study block");
    setStudyAt("");
    await loadDashboard();
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

  const recommendation = active[0] || next[0] || completed[0];
  const reviewRecommendation = useMemo(
    () => summarizePracticeReviewCards(reviewCards),
    [reviewCards],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <OrganizationContextBanner />
      <header className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">
              Student home
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Learner"}
            </h1>
          </div>
          <div className="rounded-2xl border border-edsync-border bg-edsync-surface px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-edsync-amber" />
              <div>
                <p className="font-display text-2xl font-bold">
                  {profile?.streak_days ?? 0}
                </p>
                <p className="text-xs text-edsync-subtle">day streak</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "XP",
              value: profile?.total_xp ?? 0,
              icon: Sparkles,
              tone: "text-edsync-cyan",
            },
            {
              label: "Active",
              value: active.length,
              icon: BookOpenCheck,
              tone: "text-edsync-blue",
            },
            {
              label: "Done",
              value: completed.length,
              icon: CheckCircle2,
              tone: "text-edsync-emerald",
            },
            {
              label: "Reviews",
              value: reviewRecommendation?.count ?? 0,
              icon: GraduationCap,
              tone: "text-edsync-amber",
            },
          ].map((item) => (
            <MetricTile
              key={item.label}
              label={item.label}
              value={loading ? "..." : item.value}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Continue learning</h2>
              <p className="text-sm text-edsync-subtle">Your next recommended step.</p>
            </div>
            <Link href="/practice" className="btn-secondary justify-center text-sm">
              Practice
            </Link>
          </div>
          {recommendation ? (
            <div className="space-y-3">
              {reviewRecommendation && (
                <Link
                  href={reviewRecommendation.href}
                  className="group block rounded-2xl border border-edsync-amber/30 bg-edsync-amber/10 p-4 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-amber/15 text-edsync-amber">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge bg-edsync-amber/15 text-edsync-amber">
                          {reviewRecommendation.label}
                        </span>
                        <p className="font-semibold text-edsync-text">{reviewRecommendation.title}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-edsync-subtle">
                        {reviewRecommendation.subtitle}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-edsync-amber">
                        Review now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              )}
              <Link
                href={`/student/lessons/${recommendation.id}`}
                className="premium-card group block rounded-2xl p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
                    <BookOpenCheck className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl font-bold text-edsync-text">
                      {recommendation.title}
                    </p>
                    <p className="mt-1 text-sm text-edsync-subtle">
                      {recommendation.subject || "General"} - {recommendation.estimated_duration} min
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {recommendation.progress?.status?.replace("_", " ") || "not started"}
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                        Open lesson <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
              <Target className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No lesson assigned yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">Join a class to get started.</p>
            </div>
          )}
        </section>

        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Join a class</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-1">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && joinClass()}
              placeholder="EDSYNC8"
              className="edsync-input font-mono uppercase"
            />
            <button
              type="button"
              onClick={joinClass}
              disabled={joiningClass || !joinCode.trim()}
              className="btn-primary justify-center px-4"
            >
              Join
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Learning path</h2>
              <p className="text-sm text-edsync-subtle">
                Grouped by what needs attention.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-edsync-surface" />
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-10 text-center">
              <Target className="mx-auto mb-4 h-9 w-9 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No lessons yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">
                Join a class or ask your teacher to assign a lesson.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.length > 0 && (
                <LessonGroup title="Continue now" lessons={active} />
              )}
              {next.length > 0 && <LessonGroup title="Up next" lessons={next} />}
              {completed.length > 0 && (
                <LessonGroup title="Completed" lessons={completed} />
              )}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="premium-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Announcements</h2>
              </div>
              <Megaphone className="h-5 w-5 text-edsync-amber" />
            </div>
            <div className="space-y-3">
              {planner.announcements.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  New class announcements will appear here.
                </p>
              ) : (
                planner.announcements.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-edsync-text">{item.title}</p>
                      <span className="text-xs text-edsync-subtle">
                        {item.class_name || "Class"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-edsync-subtle">{item.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="premium-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Schedule</h2>
              </div>
              <CalendarClock className="h-5 w-5 text-edsync-blue" />
            </div>
            <div className="mb-4 grid gap-2">
              <input
                value={studyTitle}
                onChange={(event) => setStudyTitle(event.target.value)}
                className="edsync-input py-2"
                placeholder="Study block title"
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={studyAt}
                  onChange={(event) => setStudyAt(event.target.value)}
                  className="edsync-input py-2"
                />
                <button
                  type="button"
                  onClick={createStudyBlock}
                  disabled={savingStudy}
                  className="btn-secondary px-3"
                  aria-label="Add study block"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {planner.events.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Deadlines and personal study blocks will appear here.
                </p>
              ) : (
                planner.events.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-edsync-text">{event.title}</p>
                        <p className="mt-1 text-xs text-edsync-subtle">
                          {event.class_name || "Personal"} -{" "}
                          {formatPlannerDate(event.due_at || event.starts_at)}
                        </p>
                      </div>
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {event.event_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <details className="premium-surface rounded-2xl p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <div>
                <h2 className="font-display text-xl font-bold">Goals</h2>
                <p className="text-sm text-edsync-subtle">{goals.length} active</p>
              </div>
              <button
                type="button"
                onClick={createGoal}
                className="rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2 text-sm font-semibold text-edsync-text hover:border-edsync-blue/50"
              >
                New
              </button>
            </summary>
            <div className="mt-4 space-y-3">
              {goals.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Create a goal to make your next study session concrete.
                </p>
              ) : (
                goals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round((goal.current_value / Math.max(1, goal.target_value)) * 100),
                  );
                  return (
                    <div
                      key={goal.id}
                      className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-edsync-text">
                          {goal.title}
                        </p>
                        <span className="text-xs font-semibold text-edsync-emerald">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-3 progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      {goal.due_date && (
                        <p className="mt-2 text-xs text-edsync-subtle">
                          Due {new Date(goal.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </details>

          <details className="premium-surface rounded-2xl p-4 sm:p-5">
            <summary className="cursor-pointer list-none marker:hidden">
              <h2 className="font-display text-xl font-bold">Reflections</h2>
              <p className="mt-1 text-sm text-edsync-subtle">{reflections.length} recent notes</p>
            </summary>
            <div className="mt-4 space-y-3">
              {reflections.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Reflection notes will appear after lessons.
                </p>
              ) : (
                reflections.map((reflection) => (
                  <div
                    key={reflection.id}
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-edsync-blue">
                        Confidence {reflection.confidence ?? "N/A"}/5
                      </span>
                      <span className="text-xs text-edsync-subtle">
                        {new Date(reflection.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-edsync-text">
                      {reflection.reflection}
                    </p>
                    {reflection.next_step && (
                      <p className="mt-3 text-xs leading-5 text-edsync-subtle">
                        Next: {reflection.next_step}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
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
            Math.round(((progress.sections_completed?.length || 0) / totalSections) * 100),
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
        <p className="truncate font-semibold text-edsync-text">{lesson.title}</p>
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
