"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
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

      const [profileRes, enrollmentsRes, goalsRes, reflectionsRes, plannerRes] =
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
        ]);

      setProfile(profileRes.data);
      setGoals(goalsRes.data || []);
      setReflections(reflectionsRes.data || []);
      setPlanner(plannerRes.data || { announcements: [], events: [] });

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

  const completed = lessons.filter((lesson) => lesson.progress?.status === "completed");
  const active = lessons.filter((lesson) => lesson.progress?.status === "in_progress");
  const next = lessons.filter(
    (lesson) => !lesson.progress || lesson.progress.status === "not_started",
  );
  const avgScore =
    completed.filter((lesson) => lesson.progress?.score != null).length > 0
      ? Math.round(
          completed
            .filter((lesson) => lesson.progress?.score != null)
            .reduce((sum, lesson) => sum + Number(lesson.progress?.score || 0), 0) /
            completed.filter((lesson) => lesson.progress?.score != null).length,
        )
      : 0;

  const recommendation = active[0] || next[0] || completed[0];

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-6">
      <OrganizationContextBanner />
      <header className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-edsync-border bg-edsync-card p-5 sm:p-6">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-edsync-emerald">
                Student learning cockpit
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold">
                Welcome back, {profile?.full_name?.split(" ")[0] || "Learner"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-edsync-subtle">
                Continue assigned lessons, track mastery, and use AI guidance
                when a concept feels unclear.
              </p>
            </div>
            <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total XP",
                value: profile?.total_xp ?? 0,
                icon: Sparkles,
                tone: "text-edsync-cyan",
              },
              {
                label: "In progress",
                value: active.length,
                icon: BookOpenCheck,
                tone: "text-edsync-blue",
              },
              {
                label: "Completed",
                value: completed.length,
                icon: CheckCircle2,
                tone: "text-edsync-emerald",
              },
              {
                label: "Average score",
                value: avgScore ? `${avgScore}%` : "N/A",
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
        </section>

        <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
          <h2 className="font-display text-xl font-bold">Join a class</h2>
          <p className="mt-1 text-sm text-edsync-subtle">
            Enter the join code your teacher shared.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
          <div className="mt-5 rounded-lg border border-edsync-border bg-edsync-surface p-4">
            <p className="text-sm font-semibold text-edsync-text">
              Recommended next step
            </p>
            {recommendation ? (
              <>
                <p className="mt-1 text-sm text-edsync-subtle">
                  {recommendation.progress?.status === "completed"
                    ? "Review your strongest completed lesson."
                    : "Continue the lesson that best matches your current path."}
                </p>
                <Link
                  href={`/student/lessons/${recommendation.id}`}
                  className="btn-secondary mt-4 w-full justify-center text-sm"
                >
                  Open {recommendation.title.slice(0, 28)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-edsync-subtle">
                Join a class to receive your first lesson.
              </p>
            )}
          </div>
        </section>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Learning path</h2>
              <p className="text-sm text-edsync-subtle">
                Assigned lessons sorted by what needs attention.
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
            <div className="rounded-lg border border-dashed border-edsync-border bg-edsync-surface p-10 text-center">
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

        <aside className="space-y-6">
          <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Announcements</h2>
                <p className="text-sm text-edsync-subtle">Teacher updates.</p>
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
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
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

          <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Schedule</h2>
                <p className="text-sm text-edsync-subtle">Deadlines and study time.</p>
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
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
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

          <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Goals</h2>
                <p className="text-sm text-edsync-subtle">Small weekly targets.</p>
              </div>
              <button
                type="button"
                onClick={createGoal}
                className="rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2 text-sm font-semibold text-edsync-text hover:border-edsync-blue/50"
              >
                New
              </button>
            </div>
            <div className="space-y-3">
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
          </section>

          <section className="rounded-xl border border-edsync-border bg-edsync-card p-6">
            <h2 className="font-display text-xl font-bold">Recent reflections</h2>
            <p className="mt-1 text-sm text-edsync-subtle">
              Confidence notes and AI next steps.
            </p>
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
          </section>
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
      className="flex items-center gap-4 rounded-lg border border-edsync-border bg-edsync-surface p-4 transition hover:border-edsync-blue/50"
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
