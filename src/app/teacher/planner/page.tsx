"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, Megaphone, Plus, Send, TimerReset } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import type { Announcement, Class, ScheduleEvent } from "@/types";

type PlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};

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

export default function TeacherPlannerPage() {
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<Class[]>([]);
  const [planner, setPlanner] = useState<PlannerData>({ announcements: [], events: [] });
  const [form, setForm] = useState<PlannerForm>(emptyForm);
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
    loadPlanner();
  }, [loadPlanner]);

  const submitPlannerItem = async () => {
    if (!form.classId) {
      toast.error("Create or select a class first.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Add a clear title.");
      return;
    }
    if (form.mode === "announcement" && !form.body.trim()) {
      toast.error("Add an announcement message.");
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
          endsAt: form.endsAt || null,
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
          ? `Announcement sent to ${payload.data?.notified ?? 0} students.`
          : "Schedule updated.",
      );
      setForm((current) => ({ ...emptyForm, classId: current.classId }));
      await loadPlanner();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-edsync-blue">Class planner</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-edsync-text">
            Announcements, deadlines, and schedule
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-edsync-subtle">
            Keep students aligned with short updates, visible deadlines, and class events.
          </p>
        </div>
        <button
          type="button"
          onClick={submitPlannerItem}
          disabled={saving}
          className="btn-primary justify-center"
        >
          {form.mode === "announcement" ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? "Saving..." : form.mode === "announcement" ? "Send" : "Add"}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              { mode: "announcement" as const, label: "Announce", icon: Megaphone },
              { mode: "deadline" as const, label: "Deadline", icon: TimerReset },
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
              <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Class</span>
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
                placeholder="Write it in student-friendly language."
              />
            </label>

            {form.mode === "announcement" ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Expires</span>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                    className="edsync-input"
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
                  <span className="mb-1 block text-xs font-semibold text-edsync-subtle">Location or link</span>
                  <input
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    className="edsync-input"
                    placeholder="Room 204, Zoom, library, or blank"
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-edsync-text">Upcoming schedule</h2>
              <CalendarClock className="h-5 w-5 text-edsync-blue" />
            </div>
            <div className="space-y-3">
              {loading ? (
                [...Array(4)].map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-lg bg-edsync-surface" />
                ))
              ) : planner.events.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  No schedule items yet.
                </p>
              ) : (
                planner.events.slice(0, 8).map((event) => (
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
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {event.event_type.replace("_", " ")}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-3 text-sm leading-6 text-edsync-subtle">{event.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-edsync-text">Recent announcements</h2>
              <Megaphone className="h-5 w-5 text-edsync-amber" />
            </div>
            <div className="space-y-3">
              {planner.announcements.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Announcements you send will appear here.
                </p>
              ) : (
                planner.announcements.slice(0, 6).map((item) => (
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
