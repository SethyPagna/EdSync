"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/edsync/client";
import {
  fetchTeacherPracticeReviewSignal,
  summarizeTeacherPracticeReviews,
  type TeacherPracticeReviewSignal,
} from "@/lib/practice/teacher-review-signals";
import { MetricTile } from "@/components/WorkspacePrimitives";
import type { Class, Lesson, Profile, TeacherAlert } from "@/types";
import { formatRelativeTime, getAlertColor, getStatusBadge } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  Plus,
  Sparkles,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";

type DashboardStats = {
  totalStudents: number;
  activeLessons: number;
  avgScore: number;
  interactions: number;
  lowConfidence: number;
  pendingReviews: number;
};

type ScoreRow = { score: number | string | null };

export default function TeacherDashboard() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [alerts, setAlerts] = useState<TeacherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeLessons: 0,
    avgScore: 0,
    interactions: 0,
    lowConfidence: 0,
    pendingReviews: 0,
  });
  const [reviewSignal, setReviewSignal] = useState<TeacherPracticeReviewSignal>(
    summarizeTeacherPracticeReviews([]),
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) return;

      const [profileRes, classesRes, lessonsRes, alertsRes] = await Promise.all([
        edsync.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        edsync
          .from("classes")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        edsync
          .from("lessons")
          .select("*")
          .eq("teacher_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(6),
        edsync
          .from("teacher_alerts")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_dismissed", false)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const classRows: Class[] = classesRes.data || [];
      const lessonRows: Lesson[] = lessonsRes.data || [];
      const lessonIds = lessonRows.map((lesson) => lesson.id);
      const classIds = classRows.map((cls) => cls.id);

      const [enrollmentRes, progressRes, interactionRes, reflectionRes, nextReviewSignal] =
        await Promise.all([
          classIds.length
            ? edsync
                .from("class_enrollments")
                .select("student_id", { count: "exact" })
                .in("class_id", classIds)
                .eq("is_active", true)
            : Promise.resolve({ count: 0, data: [] }),
          lessonIds.length
            ? edsync
                .from("student_progress")
                .select("score")
                .in("lesson_id", lessonIds)
                .not("score", "is", null)
            : Promise.resolve({ data: [] }),
          lessonIds.length
            ? edsync
                .from("socratic_interactions")
                .select("id", { count: "exact", head: true })
                .in("lesson_id", lessonIds)
            : Promise.resolve({ count: 0 }),
          lessonIds.length
            ? edsync
                .from("learning_reflections")
                .select("confidence")
                .in("lesson_id", lessonIds)
                .lte("confidence", 2)
            : Promise.resolve({ data: [] }),
          fetchTeacherPracticeReviewSignal(),
        ]);

      const scores = ((progressRes.data || []) as ScoreRow[])
        .map((row) => Number(row.score))
        .filter(Number.isFinite);
      const scoreTotal = scores.reduce((sum, score) => sum + score, 0);

      setProfile(profileRes.data);
      setClasses(classRows);
      setRecentLessons(lessonRows);
      setAlerts(alertsRes.data || []);
      setReviewSignal(nextReviewSignal);
      setStats({
        totalStudents: enrollmentRes.count || 0,
        activeLessons: lessonRows.filter((lesson) => lesson.status === "published").length,
        avgScore: scores.length > 0 ? Math.round(scoreTotal / scores.length) : 0,
        interactions: interactionRes.count || 0,
        lowConfidence: reflectionRes.data?.length || 0,
        pendingReviews: nextReviewSignal.pendingCount,
      });
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

  const dismissAlert = async (alertId: string) => {
    await edsync
      .from("teacher_alerts")
      .update({ is_dismissed: true })
      .eq("id", alertId);
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Creator";

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
              Creator home
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
              Good to see you, {firstName}
            </h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <Link href="/teacher/lessons/create" className="btn-primary justify-center">
              <Plus className="h-4 w-4" />
              New course
            </Link>
            <Link href="/teacher/lessons/create" className="btn-secondary justify-center">
              <Sparkles className="h-4 w-4" />
              Open editor
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Learners",
              value: stats.totalStudents,
              icon: UsersRound,
              tone: "text-edsync-blue",
            },
            {
              label: "Courses",
              value: stats.activeLessons,
              icon: BookOpenCheck,
              tone: "text-edsync-emerald",
            },
            {
              label: "Score",
              value: stats.avgScore ? `${stats.avgScore}%` : "N/A",
              icon: TrendingUp,
              tone: "text-edsync-amber",
            },
            {
              label: "Reviews",
              value: stats.pendingReviews,
              icon: Sparkles,
              tone: "text-edsync-cyan",
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
        <section className="premium-surface group rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Today</h2>
              <p className="edsync-hover-detail">Start with the most useful next action.</p>
            </div>
            <Link href="/teacher/planner" className="btn-ghost text-sm">
              Planner <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                href: "/teacher/analytics",
                title: "Review queue",
                value: `${stats.pendingReviews}`,
                copy: reviewSignal.copy,
                icon: AlertTriangle,
                tone: "text-edsync-amber",
              },
              {
                href: "/teacher/students",
                title: "Classes",
                value: `${classes.length}`,
                copy: "active spaces",
                icon: UsersRound,
                tone: "text-edsync-blue",
              },
              {
                href: "/teacher/work",
                title: "Work queue",
                value: "Open",
                copy: "assignments and tasks",
                icon: ClipboardList,
                tone: "text-edsync-emerald",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="premium-card group rounded-2xl p-4 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-edsync-text">{item.title}</p>
                      <p className="mt-2 font-display text-2xl font-bold text-edsync-text">{item.value}</p>
                      <p className="mt-1 text-xs text-edsync-subtle">{item.copy}</p>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-current/10 ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="premium-surface group rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Quick actions</h2>
              <p className="edsync-hover-detail">Common tasks.</p>
            </div>
            <CalendarClock className="h-5 w-5 text-edsync-blue" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <Link href="/teacher/lessons/create" className="btn-secondary justify-center text-sm">
              <Plus className="h-4 w-4" /> Create course
            </Link>
            <Link href="/teacher/gradebook" className="btn-secondary justify-center text-sm">
              <ClipboardList className="h-4 w-4" /> Feedback
            </Link>
            <Link href="/teacher/analytics" className="btn-secondary justify-center text-sm">
              <TrendingUp className="h-4 w-4" /> Reports
            </Link>
          </div>
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="premium-surface group rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Recent lessons</h2>
              <p className="edsync-hover-detail">Drafts and recent updates.</p>
            </div>
            <Link href="/teacher/lessons" className="btn-ghost text-sm">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              [...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-lg bg-edsync-surface"
                />
              ))
            ) : recentLessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
                <p className="font-semibold text-edsync-text">No lessons yet</p>
                <Link
                  href="/teacher/lessons/create"
                  className="btn-primary mt-5 inline-flex"
                >
                  Create first lesson
                </Link>
              </div>
            ) : (
              recentLessons.map((lesson) => {
                const badge = getStatusBadge(lesson.status);
                return (
                  <Link
                    key={lesson.id}
                    href={`/teacher/lessons/${lesson.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-edsync-border bg-edsync-surface p-3 transition hover:border-edsync-blue/50 hover:bg-edsync-card sm:gap-4 sm:p-4"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
                      <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-edsync-text">
                          {lesson.title}
                        </p>
                        {lesson.ai_generated && (
                          <span className="badge bg-edsync-purple/10 text-edsync-purple">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-edsync-subtle">
                        {lesson.subject || "General"} - {lesson.estimated_duration} min -
                        Updated {formatRelativeTime(lesson.updated_at)}
                      </p>
                    </div>
                    <span className={`badge ${badge.className}`}>
                      {badge.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="premium-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Alerts</h2>
              {alerts.length > 0 && (
                <span className="badge bg-edsync-red/10 text-edsync-red">
                  {alerts.length} active
                </span>
              )}
            </div>
            <div className="space-y-3">
              {loading ? (
                [...Array(3)].map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-lg bg-edsync-surface"
                  />
                ))
              ) : alerts.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  No urgent alerts. Your class queue is clear.
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-4 ${getAlertColor(alert.alert_type)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-1 text-xs leading-5 opacity-80">
                          {alert.message}
                        </p>
                        {alert.action_suggestion && (
                          <p className="mt-2 text-xs font-medium opacity-90">
                            Action: {alert.action_suggestion}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissAlert(alert.id)}
                        className="rounded-lg p-1.5 opacity-60 transition hover:bg-edsync-card hover:opacity-100"
                        aria-label="Dismiss alert"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="premium-surface group rounded-2xl p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold">Course spaces</h2>
            <p className="edsync-hover-detail">
              Share access codes with learners.
            </p>
            <div className="mt-4 space-y-3">
              {classes.length === 0 ? (
                <Link href="/teacher/students" className="btn-secondary w-full justify-center">
                  Create space
                </Link>
              ) : (
                classes.slice(0, 4).map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-edsync-text">
                          {cls.name}
                        </p>
                        <p className="text-xs text-edsync-subtle">
                          {cls.subject || "General"}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-edsync-amber">
                        {cls.join_code}
                      </span>
                    </div>
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
