"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Plus,
  TimerReset,
  Trash2,
} from "lucide-react";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams, scopedClassHref } from "@/lib/classes/class-scope";
import type { Announcement, ScheduleEvent } from "@/types";

type StudentPlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};

type PlannerResponse = {
  data?: StudentPlannerData;
  error?: { message?: string } | null;
};

type StudyForm = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  dueAt: string;
  location: string;
};

type PlannerView = "upcoming" | "deadlines" | "notifications" | "study";

const emptyStudyForm: StudyForm = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  dueAt: "",
  location: "",
};

const VIEW_OPTIONS: Array<{ key: PlannerView; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "deadlines", label: "Deadlines" },
  { key: "notifications", label: "Notifications" },
  { key: "study", label: "My study" },
];

function classScopeFromLocation() {
  if (typeof window === "undefined") return ALL_CLASSES_SCOPE;
  return classScopeFromSearchParams(new URLSearchParams(window.location.search));
}

function dateTimeLabel(value: string | null) {
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

function primaryEventTime(event: ScheduleEvent) {
  return event.due_at || event.starts_at || event.created_at;
}

function sortByTime<T extends ScheduleEvent>(events: T[]) {
  return [...events].sort((left, right) => {
    const leftTime = new Date(primaryEventTime(left) || 0).getTime();
    const rightTime = new Date(primaryEventTime(right) || 0).getTime();
    return leftTime - rightTime;
  });
}

function eventTone(event: ScheduleEvent) {
  if (event.event_type === "deadline") return "bg-edsync-red/10 text-edsync-red";
  if (event.event_type === "study") return "bg-edsync-blue/10 text-edsync-blue";
  if (event.event_type === "office_hours") return "bg-edsync-emerald/10 text-edsync-emerald";
  return "bg-edsync-amber/10 text-edsync-amber";
}

function eventIcon(event: ScheduleEvent) {
  if (event.event_type === "deadline") return TimerReset;
  if (event.event_type === "study") return Clock3;
  return CalendarClock;
}

export default function StudentPlannerPage() {
  const [planner, setPlanner] = useState<StudentPlannerData>({ announcements: [], events: [] });
  const [form, setForm] = useState<StudyForm>(emptyStudyForm);
  const [view, setView] = useState<PlannerView>("upcoming");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestedClassId] = useState(classScopeFromLocation);

  const loadPlanner = useCallback(async () => {
    setLoading(true);
    try {
      const query = requestedClassId === ALL_CLASSES_SCOPE ? "" : `?classId=${encodeURIComponent(requestedClassId)}`;
      const response = await fetch(`/api/planner${query}`, { cache: "no-store", credentials: "include" });
      const payload = (await response.json()) as PlannerResponse;
      if (!response.ok || payload.error) {
        toast.error(payload.error?.message || "Could not load planner.");
        return;
      }
      setPlanner(payload.data || { announcements: [], events: [] });
    } finally {
      setLoading(false);
    }
  }, [requestedClassId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadPlanner();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadPlanner]);

  const filteredEvents = useMemo(() => {
    if (view === "deadlines") {
      return sortByTime(planner.events.filter((event) => event.event_type === "deadline"));
    }
    if (view === "study") {
      return sortByTime(planner.events.filter((event) => event.event_type === "study"));
    }
    return sortByTime(planner.events);
  }, [planner.events, view]);

  const visibleAnnouncements = view === "notifications" || view === "upcoming" ? planner.announcements : [];
  const deadlineCount = planner.events.filter((event) => event.event_type === "deadline").length;
  const studyCount = planner.events.filter((event) => event.event_type === "study").length;

  const saveStudyEvent = async () => {
    if (!form.title.trim()) {
      toast.error("Add a study title.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "event",
          title: form.title,
          description: form.description || null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          dueAt: form.dueAt || null,
          location: form.location || null,
        }),
      });
      const payload = (await response.json()) as PlannerResponse;
      if (!response.ok || payload.error) {
        toast.error(payload.error?.message || "Study time was not saved.");
        return;
      }
      toast.success("Study time added.");
      setForm(emptyStudyForm);
      await loadPlanner();
    } finally {
      setSaving(false);
    }
  };

  const deleteStudyEvent = async (event: ScheduleEvent) => {
    if (event.event_type !== "study") return;
    const confirmed = window.confirm(`Delete "${event.title}" from your planner?`);
    if (!confirmed) return;
    const response = await fetch(`/api/planner?type=event&id=${encodeURIComponent(event.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = (await response.json().catch(() => null)) as PlannerResponse | null;
    if (!response.ok || payload?.error) {
      toast.error(payload?.error?.message || "Study time was not deleted.");
      return;
    }
    toast.success("Study time deleted.");
    await loadPlanner();
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <header className="premium-panel group rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Planner</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-edsync-text">Deadlines and study time</h1>
            <p className="edsync-hover-detail max-w-2xl">
              See space updates, due dates, live sessions, and your own study plan in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {requestedClassId !== ALL_CLASSES_SCOPE && (
            <Link href="/student/planner" className="btn-secondary w-fit px-3 py-2 text-sm">
              All planner
            </Link>
          )}
          <Link href={scopedClassHref("/student/work", requestedClassId)} className="btn-secondary w-fit px-3 py-2 text-sm">
            My work <ArrowRight className="h-4 w-4" />
          </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="metric-card">
          <TimerReset className="h-5 w-5 text-edsync-red" />
          <span>{deadlineCount}</span>
          <p>Deadlines</p>
        </div>
        <div className="metric-card">
          <Bell className="h-5 w-5 text-edsync-amber" />
          <span>{planner.announcements.length}</span>
          <p>Notifications</p>
        </div>
        <div className="metric-card">
          <Clock3 className="h-5 w-5 text-edsync-blue" />
          <span>{studyCount}</span>
          <p>Study blocks</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="premium-surface group h-fit rounded-2xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-edsync-text">Add study time</h2>
              <p className="edsync-hover-detail">Personal blocks stay private to you.</p>
            </div>
            <Plus className="h-5 w-5 text-edsync-blue" />
          </div>
          <div className="space-y-3">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="edsync-input"
              placeholder="Study title"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="edsync-input min-h-20"
              placeholder="Focus, goal, or notes"
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-xs font-semibold text-edsync-subtle">
                Starts
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  className="edsync-input mt-1"
                />
              </label>
              <label className="text-xs font-semibold text-edsync-subtle">
                Ends
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                  className="edsync-input mt-1"
                />
              </label>
            </div>
            <input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="edsync-input"
              placeholder="Location or link"
            />
            <button type="button" onClick={saveStudyEvent} disabled={saving} className="btn-primary w-full justify-center">
              <Plus className="h-4 w-4" />
              {saving ? "Saving..." : "Add"}
            </button>
          </div>
        </aside>

        <section className="premium-surface group rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-edsync-text">Schedule</h2>
              <p className="edsync-hover-detail">Space items and personal study blocks.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setView(option.key)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    view === option.key
                      ? "bg-edsync-blue text-white"
                      : "border border-edsync-border bg-edsync-surface text-edsync-subtle hover:text-edsync-text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-24 rounded-2xl bg-edsync-surface shimmer" />
              ))}
            </div>
          ) : visibleAnnouncements.length === 0 && filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-edsync-emerald" />
              <p className="font-semibold text-edsync-text">Nothing in this view</p>
              <p className="mt-1 text-sm text-edsync-subtle">No events yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAnnouncements.map((announcement) => (
                <article key={announcement.id} className="rounded-2xl border border-edsync-border bg-edsync-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-edsync-amber/10 text-edsync-amber">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge bg-edsync-amber/10 text-edsync-amber">Notification</span>
                        <span className="badge bg-edsync-surface text-edsync-subtle">
                          {announcement.class_name || "Space"}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-bold text-edsync-text">{announcement.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-edsync-subtle">{announcement.body}</p>
                    </div>
                  </div>
                </article>
              ))}

              {filteredEvents.map((event) => {
                const Icon = eventIcon(event);
                return (
                  <article key={event.id} className="rounded-2xl border border-edsync-border bg-edsync-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${eventTone(event)}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`badge ${eventTone(event)}`}>{event.event_type.replace("_", " ")}</span>
                            <span className="badge bg-edsync-surface text-edsync-subtle">
                              {event.class_name || "Personal"}
                            </span>
                          </div>
                          <h3 className="mt-2 font-display text-lg font-bold text-edsync-text">{event.title}</h3>
                          <p className="mt-1 text-sm text-edsync-subtle">{dateTimeLabel(primaryEventTime(event))}</p>
                          {event.description && (
                            <p className="mt-2 text-sm leading-6 text-edsync-text">{event.description}</p>
                          )}
                          {event.location && <p className="mt-2 text-sm text-edsync-subtle">{event.location}</p>}
                        </div>
                      </div>
                      {event.event_type === "study" && (
                        <button
                          type="button"
                          onClick={() => deleteStudyEvent(event)}
                          className="btn-secondary w-fit px-3 py-2 text-sm text-edsync-red"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
