"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CalendarClock, Link2, Megaphone, Plus, Send, TimerReset, Trash2 } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams, hasClassScope, scopedClassHref } from "@/lib/classes/class-scope";
import type { Announcement, Class, ScheduleEvent } from "@/types";

type PlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};
type PlannerView = "day" | "week" | "month" | "all";

type PlannerForm = {
  mode: "announcement" | "deadline" | "event";
  classId: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
  dueAt: string;
  location: string;
  priority: "low" | "normal" | "high";
};

const emptyForm: PlannerForm = {
  mode: "announcement",
  classId: "",
  title: "",
  body: "",
  startsAt: "",
  endsAt: "",
  dueAt: "",
  location: "",
  priority: "normal",
};
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const plannerViews: Array<{ key: PlannerView; label: string }> = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

function formatWhen(event: ScheduleEvent) {
  const value = event.due_at || event.starts_at || event.created_at;
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

function eventTime(event: ScheduleEvent) {
  const value = event.due_at || event.starts_at || event.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isInPlannerView(event: ScheduleEvent, view: PlannerView, now = new Date()) {
  if (view === "all") return true;
  const timestamp = eventTime(event);
  if (timestamp === Number.MAX_SAFE_INTEGER) return false;
  const eventDate = new Date(timestamp);
  if (view === "day") return sameDay(eventDate, now);
  if (view === "week") return timestamp >= now.getTime() - MILLISECONDS_PER_DAY && timestamp <= now.getTime() + 7 * MILLISECONDS_PER_DAY;
  return eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth();
}

function eventWorkType(event: ScheduleEvent) {
  const workType = event.metadata?.workType;
  return typeof workType === "string" ? workType : null;
}

function classScopeFromLocation() {
  if (typeof window === "undefined") return ALL_CLASSES_SCOPE;
  return classScopeFromSearchParams(new URLSearchParams(window.location.search));
}

export default function TeacherPlannerPage() {
  const router = useRouter();
  const [requestedClassId, setRequestedClassId] = useState(classScopeFromLocation);
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<Class[]>([]);
  const [planner, setPlanner] = useState<PlannerData>({ announcements: [], events: [] });
  const [form, setForm] = useState<PlannerForm>(emptyForm);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [plannerView, setPlannerView] = useState<PlannerView>("week");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPlanner = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) return;

      const [classRes, plannerRes] = await Promise.all([
        edsync
          .from("classes")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        fetch("/api/planner", { credentials: "include", cache: "no-store" }).then((res) =>
          res.json(),
        ),
      ]);

      const classRows = classRes.data || [];
      setClasses(classRows);
      setForm((current) => ({
        ...current,
        classId: current.classId || classRows[0]?.id || "",
      }));
      setPlanner(plannerRes.data || { announcements: [], events: [] });
    } catch {
      toast.error("Could not load planner.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadPlanner();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadPlanner]);

  useEffect(() => {
    if (!hasClassScope(classes, requestedClassId)) return;
    const scopeTimer = window.setTimeout(() => {
      setSelectedClassId(requestedClassId);
      if (requestedClassId !== ALL_CLASSES_SCOPE) {
        setForm((current) => ({ ...current, classId: current.classId || requestedClassId }));
      }
    }, 0);
    return () => window.clearTimeout(scopeTimer);
  }, [classes, requestedClassId]);

  const chooseClassScope = (classId: string) => {
    setRequestedClassId(classId);
    setSelectedClassId(classId);
    if (classId !== ALL_CLASSES_SCOPE) {
      setForm((current) => ({ ...current, classId }));
    }
    router.replace(scopedClassHref("/teacher/planner", classId), { scroll: false });
  };

  const selectedClass = useMemo(
    () => classes.find((classRow) => classRow.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const classScopedEvents = useMemo(() => {
    if (!selectedClass) return planner.events;
    return planner.events.filter((event) => event.class_name === selectedClass.name);
  }, [planner.events, selectedClass]);
  const visibleEvents = useMemo(
    () =>
      classScopedEvents
        .filter((event) => isInPlannerView(event, plannerView))
        .sort((left, right) => eventTime(left) - eventTime(right)),
    [classScopedEvents, plannerView],
  );
  const visibleAnnouncements = useMemo(() => {
    if (!selectedClass) return planner.announcements;
    return planner.announcements.filter((announcement) => announcement.class_name === selectedClass.name);
  }, [planner.announcements, selectedClass]);
  const scheduleStats = useMemo(
    () => ({
      day: classScopedEvents.filter((event) => isInPlannerView(event, "day")).length,
      week: classScopedEvents.filter((event) => isInPlannerView(event, "week")).length,
      month: classScopedEvents.filter((event) => isInPlannerView(event, "month")).length,
    }),
    [classScopedEvents],
  );

  const submitPlannerItem = async () => {
    if (!form.classId) {
      toast.error("Choose a class or course first.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Add a clear title.");
      return;
    }
    if (form.mode === "announcement" && !form.body.trim()) {
      toast.error("Add a notification message.");
      return;
    }
    if (form.mode === "deadline" && !form.dueAt) {
      toast.error("Choose a due date and time.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: form.mode === "announcement" ? "announcement" : "event",
          classId: form.classId,
          title: form.title,
          body: form.body,
          description: form.body,
          priority: form.priority,
          eventType:
            form.mode === "deadline"
              ? "deadline"
              : form.mode === "event"
                ? "class"
                : "announcement",
          startsAt: form.startsAt || null,
          endsAt: form.mode === "announcement" ? null : form.endsAt || null,
          dueAt: form.mode === "deadline" ? form.dueAt : null,
          location: form.location || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message || "Could not save planner item.");
        return;
      }

      toast.success(
        form.mode === "announcement"
          ? `Notification sent to ${payload.data?.notified ?? 0} students.`
          : "Schedule updated.",
      );
      setForm((current) => ({ ...emptyForm, classId: current.classId }));
      await loadPlanner();
    } finally {
      setSaving(false);
    }
  };

  const deletePlannerItem = async (type: "announcement" | "event", id: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}"? Learners will no longer see this ${type}.`);
    if (!confirmed) return;
    const response = await fetch(`/api/planner?type=${type}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      toast.error(payload?.error?.message || payload?.error || "Planner item was not deleted.");
      return;
    }
    toast.success(type === "announcement" ? "Notification deleted." : "Schedule item deleted.");
    await loadPlanner();
  };

  return (
    <div className="page-shell space-y-6">
      <header className="group flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-edsync-blue">Course planner</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-edsync-text">
            Schedule, deadlines, and updates
          </h1>
          <p className="edsync-hover-detail max-w-2xl">
            Filter by class, view the day/week/month schedule, and keep assessment deadlines linked to real class work.
          </p>
        </div>
      </header>

      <section className="group rounded-xl border border-edsync-border bg-edsync-card p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => chooseClassScope(ALL_CLASSES_SCOPE)}
            className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              selectedClassId === "all"
                ? "border-edsync-blue bg-edsync-blue text-white"
                : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
            }`}
          >
            All classes
          </button>
          {classes.map((classRow) => (
            <button
              key={classRow.id}
              type="button"
              onClick={() => chooseClassScope(classRow.id)}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                selectedClassId === classRow.id
                  ? "border-edsync-blue bg-edsync-blue text-white"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
              }`}
            >
              {classRow.name}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Today", value: scheduleStats.day },
          { label: "This week", value: scheduleStats.week },
          { label: "This month", value: scheduleStats.month },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-edsync-border bg-edsync-card p-4">
            <p className="text-2xl font-bold text-edsync-text">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-edsync-subtle">{stat.label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { mode: "announcement" as const, label: "Notify", icon: Megaphone },
              { mode: "deadline" as const, label: "Due date", icon: TimerReset },
              { mode: "event" as const, label: "Event", icon: CalendarClock },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mode: item.mode }))}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    form.mode === item.mode
                      ? "border-edsync-blue bg-edsync-blue/10 text-edsync-blue"
                      : "border-edsync-border bg-edsync-surface text-edsync-text hover:border-edsync-blue/50"
                  }`}
                >
                  <Icon className="mx-auto mb-1 h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Class or course</span>
              <select
                value={form.classId}
                onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                className="edsync-input"
              >
                {classes.length === 0 ? (
                  <option value="">No active classes</option>
                ) : (
                  classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="edsync-input"
                placeholder={
                  form.mode === "deadline"
                    ? "Lab report due"
                    : form.mode === "event"
                      ? "Review session"
                      : "Tomorrow's reading"
                }
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-edsync-subtle">
                {form.mode === "announcement" ? "Message" : "Details"}
              </span>
              <textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                className="edsync-textarea min-h-28"
                placeholder="Write it in clear learner-friendly language."
              />
            </label>

            {form.mode === "announcement" ? (
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as PlannerForm["priority"],
                      }))
                    }
                    className="edsync-input"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-edsync-subtle">
                    <Link2 className="h-3.5 w-3.5" />
                    Attachment or link
                  </span>
                  <input
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    className="edsync-input"
                    placeholder="https://..., shared file, image, or resource link"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {form.mode === "deadline" ? (
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Due</span>
                    <input
                      type="datetime-local"
                      value={form.dueAt}
                      onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                      className="edsync-input"
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Starts</span>
                      <input
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                        className="edsync-input"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Ends</span>
                      <input
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                        className="edsync-input"
                      />
                    </label>
                  </>
                )}
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Location, meeting, or link</span>
                  <input
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    className="edsync-input"
                    placeholder="Room 204, Zoom, library, or blank"
                  />
                </label>
              </div>
            )}
            <button
              type="button"
              onClick={submitPlannerItem}
              disabled={saving}
              className="btn-primary w-full justify-center"
            >
              {form.mode === "announcement" ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : form.mode === "announcement" ? "Send announcement" : "Add to schedule"}
            </button>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-xl font-bold text-edsync-text">Upcoming schedule</h2>
              <div className="flex flex-wrap gap-2">
                {plannerViews.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => setPlannerView(view.key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      plannerView === view.key
                        ? "border-edsync-blue bg-edsync-blue text-white"
                        : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {loading ? (
                [...Array(4)].map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-lg bg-edsync-surface" />
                ))
              ) : visibleEvents.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  No schedule items yet.
                </p>
              ) : (
                visibleEvents.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-edsync-text">{event.title}</p>
                        <p className="mt-1 text-xs text-edsync-subtle">
                          {event.class_name || "Personal"} - {formatWhen(event)}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="badge bg-edsync-blue/10 text-edsync-blue">
                          {event.event_type.replace("_", " ")}
                        </span>
                        {eventWorkType(event) && (
                          <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                            {eventWorkType(event)}
                          </span>
                        )}
                      </div>
                    </div>
                    {event.description && (
                      <p className="mt-3 text-sm leading-6 text-edsync-subtle">{event.description}</p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-xs text-edsync-red"
                        onClick={() => deletePlannerItem("event", event.id, event.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-edsync-text">Recent notifications</h2>
              <Megaphone className="h-5 w-5 text-edsync-amber" />
            </div>
            <div className="space-y-3">
              {visibleAnnouncements.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  No notifications yet.
                </p>
              ) : (
                visibleAnnouncements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-edsync-text">{item.title}</p>
                      <span className="text-xs text-edsync-subtle">
                        {item.class_name || "Class"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-edsync-subtle">{item.body}</p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-xs text-edsync-red"
                        onClick={() => deletePlannerItem("announcement", item.id, item.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
