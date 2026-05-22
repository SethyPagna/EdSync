"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, BellOff, CalendarClock, CheckCircle2, ClipboardList, GraduationCap, MessageSquareText, Sparkles } from "lucide-react";
import {
  STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY,
  areStudentNotificationsPaused,
  defaultStudentDashboardVisibility,
  mergeStudentDashboardVisibility,
  studentNotificationToggleOptions,
  type StudentDashboardVisibility,
} from "@/lib/student/dashboard-preferences";

const previewItems = [
  { key: "newContent", title: "New lesson content", detail: "A teacher publishes a lesson or a new course module.", icon: Sparkles },
  { key: "assignments", title: "Assignments and work", detail: "Projects, quizzes, and class work assigned to you.", icon: ClipboardList },
  { key: "deadlines", title: "Deadlines", detail: "Due dates, study blocks, and planner events.", icon: CalendarClock },
  { key: "grades", title: "Grades posted", detail: "Visible gradebook updates and score releases.", icon: GraduationCap },
  { key: "feedback", title: "Feedback notes", detail: "Teacher comments and improvement notes.", icon: MessageSquareText },
] as const;

function readVisibility() {
  if (typeof window === "undefined") return defaultStudentDashboardVisibility;
  try {
    return mergeStudentDashboardVisibility(
      JSON.parse(window.localStorage.getItem(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY) || "null") as Partial<StudentDashboardVisibility> | null,
    );
  } catch {
    return defaultStudentDashboardVisibility;
  }
}

export default function StudentNotificationsPage() {
  const [visibility, setVisibility] = useState<StudentDashboardVisibility>(defaultStudentDashboardVisibility);

  useEffect(() => {
    setVisibility(readVisibility());
  }, []);

  const paused = useMemo(() => areStudentNotificationsPaused(visibility), [visibility]);

  const updateVisibility = (key: keyof StudentDashboardVisibility) => {
    setVisibility((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setAll = (enabled: boolean) => {
    const next = Object.fromEntries(
      Object.keys(defaultStudentDashboardVisibility).map((key) => [key, enabled]),
    ) as StudentDashboardVisibility;
    window.localStorage.setItem(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY, JSON.stringify(next));
    setVisibility(next);
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">Student preferences</p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-edsync-subtle">
              Choose which updates appear on your dashboard. These settings stay personal to your browser and keep the student portal quieter.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAll(false)} className="btn-secondary justify-center px-4 py-2 text-sm">
              <BellOff className="h-4 w-4" />
              Pause all
            </button>
            <button type="button" onClick={() => setAll(true)} className="btn-primary justify-center px-4 py-2 text-sm">
              <Bell className="h-4 w-4" />
              Turn on all
            </button>
          </div>
        </div>
      </section>

      {paused && (
        <section className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-4">
          <div className="flex items-start gap-3">
            <BellOff className="mt-0.5 h-5 w-5 text-edsync-subtle" />
            <div>
              <p className="font-semibold text-edsync-text">Notifications are paused</p>
              <p className="mt-1 text-sm text-edsync-subtle">Your dashboard will show a slim paused message until you enable one or more notification types.</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Dashboard toggles</h2>
              <p className="text-sm text-edsync-subtle">Tap a tile to show or hide that update type.</p>
            </div>
            <span className={`badge ${paused ? "bg-edsync-red/10 text-edsync-red" : "bg-edsync-emerald/10 text-edsync-emerald"}`}>
              {paused ? "paused" : "active"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {studentNotificationToggleOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => updateVisibility(option.key)}
                aria-pressed={visibility[option.key]}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  visibility[option.key]
                    ? "border-edsync-blue/35 bg-edsync-blue/10 shadow-sm"
                    : "border-edsync-border bg-edsync-surface text-edsync-subtle"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-edsync-text">{option.label}</p>
                    <p className="mt-1 text-sm leading-5 text-edsync-subtle">{option.description}</p>
                  </div>
                  <span className={`mt-1 h-3 w-3 rounded-full ${visibility[option.key] ? "bg-edsync-blue" : "bg-edsync-muted"}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="premium-surface rounded-2xl p-4">
            <h2 className="font-display text-xl font-bold">Preview</h2>
            <p className="mt-1 text-sm text-edsync-subtle">Dashboard updates will stay compact and respect these choices.</p>
            <Link href="/student/dashboard" className="btn-secondary mt-4 w-full justify-between px-3 py-2 text-sm">
              Back to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {previewItems.map((item) => {
              const Icon = item.icon;
              const enabled = visibility[item.key];
              return (
                <div key={item.key} className={`rounded-2xl border p-3 ${enabled ? "border-edsync-border bg-edsync-card" : "border-dashed border-edsync-border bg-edsync-surface opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 ${enabled ? "text-edsync-blue" : "text-edsync-subtle"}`} />
                    <div>
                      <p className="text-sm font-semibold text-edsync-text">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-edsync-subtle">{item.detail}</p>
                    </div>
                    {enabled && <CheckCircle2 className="ml-auto h-4 w-4 flex-shrink-0 text-edsync-emerald" />}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </div>
  );
}
