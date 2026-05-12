"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Class, Lesson, Profile, TeacherAlert } from "@/types";
import { formatRelativeTime, getAlertColor, getStatusBadge } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  Plus,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";

type DashboardStats = {
  totalStudents: number;
  activeLessons: number;
  avgScore: number;
  interactions: number;
  lowConfidence: number;
};

export default function TeacherDashboard() {
  const supabase = useMemo(() => createClient(), []);
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
  });

  useEffect(() => {
    loadDashboard();
  }, [supabase]);

  const loadDashboard = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, classesRes, lessonsRes, alertsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("lessons")
        .select("*")
        .eq("teacher_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("teacher_alerts")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const classRows = classesRes.data || [];
    const lessonRows = lessonsRes.data || [];
    const lessonIds = lessonRows.map((lesson) => lesson.id);
    const classIds = classRows.map((cls) => cls.id);

    const [enrollmentRes, progressRes, interactionRes, reflectionRes] =
      await Promise.all([
        classIds.length
          ? supabase
              .from("class_enrollments")
              .select("id", { count: "exact", head: true })
              .in("class_id", classIds)
              .eq("is_active", true)
          : Promise.resolve({ count: 0 }),
        lessonIds.length
          ? supabase
              .from("student_progress")
              .select("score")
              .in("lesson_id", lessonIds)
              .not("score", "is", null)
          : Promise.resolve({ data: [] }),
        lessonIds.length
          ? supabase
              .from("socratic_interactions")
              .select("id", { count: "exact", head: true })
              .in("lesson_id", lessonIds)
          : Promise.resolve({ count: 0 }),
        lessonIds.length
          ? supabase
              .from("learning_reflections")
              .select("confidence")
              .in("lesson_id", lessonIds)
              .lte("confidence", 2)
          : Promise.resolve({ data: [] }),
      ]);

    const scores = (progressRes.data || [])
      .map((row: any) => Number(row.score))
      .filter((score: number) => Number.isFinite(score));

    setProfile(profileRes.data);
    setClasses(classRows);
    setRecentLessons(lessonRows);
    setAlerts(alertsRes.data || []);
    setStats({
      totalStudents: enrollmentRes.count || 0,
      activeLessons: lessonRows.filter((lesson) => lesson.status === "published")
        .length,
      avgScore:
        scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0,
      interactions: interactionRes.count || 0,
      lowConfidence: reflectionRes.data?.length || 0,
    });
    setLoading(false);
  };

  const dismissAlert = async (alertId: string) => {
    await supabase
      .from("teacher_alerts")
      .update({ is_dismissed: true })
      .eq("id", alertId);
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Teacher";

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-6">
      <header className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-atlas-border bg-atlas-card p-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-atlas-amber">
                Teacher command center
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold">
                Good to see you, {firstName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-atlas-subtle">
                Review class health, act on learning evidence, and create the
                next lesson from one focused workspace.
              </p>
            </div>
            <Link href="/teacher/lessons/create" className="btn-primary hidden sm:flex">
              <Plus className="h-4 w-4" />
              New lesson
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Students",
                value: stats.totalStudents,
                icon: UsersRound,
                tone: "text-atlas-blue",
              },
              {
                label: "Published lessons",
                value: stats.activeLessons,
                icon: BookOpenCheck,
                tone: "text-atlas-emerald",
              },
              {
                label: "Average score",
                value: stats.avgScore ? `${stats.avgScore}%` : "N/A",
                icon: TrendingUp,
                tone: "text-atlas-amber",
              },
              {
                label: "AI tutor chats",
                value: stats.interactions,
                icon: Sparkles,
                tone: "text-atlas-cyan",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-atlas-border bg-atlas-surface p-4"
                >
                  <Icon className={`mb-4 h-5 w-5 ${item.tone}`} />
                  <p className="font-display text-3xl font-bold text-atlas-text">
                    {loading ? "..." : item.value}
                  </p>
                  <p className="text-xs text-atlas-subtle">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-atlas-border bg-atlas-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-display text-xl font-bold">Today&apos;s queue</p>
              <p className="text-sm text-atlas-subtle">Highest signal actions</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-atlas-amber" />
          </div>
          <div className="space-y-3">
            <Link
              href="/teacher/analytics"
              className="block rounded-lg border border-atlas-border bg-atlas-surface p-4 hover:border-atlas-blue/50"
            >
              <div className="flex justify-between gap-4">
                <p className="text-sm font-semibold text-atlas-text">
                  Review interventions
                </p>
                <span className="text-sm font-bold text-atlas-amber">
                  {stats.lowConfidence}
                </span>
              </div>
              <p className="mt-1 text-xs text-atlas-subtle">
                Low-confidence reflections need teacher attention.
              </p>
            </Link>
            <Link
              href="/teacher/students"
              className="block rounded-lg border border-atlas-border bg-atlas-surface p-4 hover:border-atlas-blue/50"
            >
              <p className="text-sm font-semibold text-atlas-text">
                Manage classes and assignments
              </p>
              <p className="mt-1 text-xs text-atlas-subtle">
                Share join codes, assign lessons, and check enrollment.
              </p>
            </Link>
            <Link
              href="/teacher/reports"
              className="block rounded-lg border border-atlas-border bg-atlas-surface p-4 hover:border-atlas-blue/50"
            >
              <p className="text-sm font-semibold text-atlas-text">
                Export learning evidence
              </p>
              <p className="mt-1 text-xs text-atlas-subtle">
                Prepare class reports for grading and parent updates.
              </p>
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-atlas-border bg-atlas-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Recent lessons</h2>
              <p className="text-sm text-atlas-subtle">
                Drafts, published lessons, and recent updates.
              </p>
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
                  className="h-20 animate-pulse rounded-lg bg-atlas-surface"
                />
              ))
            ) : recentLessons.length === 0 ? (
              <div className="rounded-lg border border-dashed border-atlas-border bg-atlas-surface p-8 text-center">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 text-atlas-subtle" />
                <p className="font-semibold text-atlas-text">No lessons yet</p>
                <p className="mt-1 text-sm text-atlas-subtle">
                  Start with AI-assisted lesson creation.
                </p>
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
                    className="flex items-center gap-4 rounded-lg border border-atlas-border bg-atlas-surface p-4 transition hover:border-atlas-blue/50"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-atlas-blue/10 text-atlas-blue">
                      <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-atlas-text">
                          {lesson.title}
                        </p>
                        {lesson.ai_generated && (
                          <span className="badge bg-atlas-purple/10 text-atlas-purple">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-atlas-subtle">
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

        <aside className="space-y-6">
          <section className="rounded-xl border border-atlas-border bg-atlas-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Alerts</h2>
              {alerts.length > 0 && (
                <span className="badge bg-atlas-red/10 text-atlas-red">
                  {alerts.length} active
                </span>
              )}
            </div>
            <div className="space-y-3">
              {loading ? (
                [...Array(3)].map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-lg bg-atlas-surface"
                  />
                ))
              ) : alerts.length === 0 ? (
                <p className="rounded-lg border border-atlas-border bg-atlas-surface p-4 text-sm text-atlas-subtle">
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
                        className="text-lg leading-none opacity-50 hover:opacity-100"
                        aria-label="Dismiss alert"
                      >
                        x
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-atlas-border bg-atlas-card p-6">
            <h2 className="font-display text-xl font-bold">Classes</h2>
            <p className="mt-1 text-sm text-atlas-subtle">
              Share join codes with students.
            </p>
            <div className="mt-4 space-y-3">
              {classes.length === 0 ? (
                <Link href="/teacher/students" className="btn-secondary w-full justify-center">
                  Create class
                </Link>
              ) : (
                classes.slice(0, 4).map((cls) => (
                  <div
                    key={cls.id}
                    className="rounded-lg border border-atlas-border bg-atlas-surface p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-atlas-text">
                          {cls.name}
                        </p>
                        <p className="text-xs text-atlas-subtle">
                          {cls.subject || "General"}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-atlas-amber">
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
