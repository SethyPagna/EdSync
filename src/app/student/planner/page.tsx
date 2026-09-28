"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, Plus, Trash2 } from "lucide-react";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams, scopedClassHref } from "@/lib/classes/class-scope";
import type { Announcement, ScheduleEvent } from "@/types";
import { Button, EmptyState, PageHeader, Segmented, Sheet, Skeleton, useConfirm } from "@/components/ui";

type PlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};
type ApiResponse = { data?: PlannerData; error?: string | { message?: string } | null };
type StudyForm = { title: string; description: string; startsAt: string; endsAt: string; location: string };
const EMPTY_FORM: StudyForm = { title: "", description: "", startsAt: "", endsAt: "", location: "" };
type View = "week" | "agenda";

function apiError(error: ApiResponse["error"], fallback: string) {
  return typeof error === "string" ? error : error?.message || fallback;
}
function eventDate(event: ScheduleEvent) { return event.due_at || event.starts_at || event.created_at; }
function eventTime(event: ScheduleEvent) {
  const value = eventDate(event);
  if (!value) return "Unscheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unscheduled" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function dateKey(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }

export default function StudentPlannerPage() {
  const confirm = useConfirm();
  const [planner, setPlanner] = useState<PlannerData>({ announcements: [], events: [] });
  const [requestedClassId, setRequestedClassId] = useState(ALL_CLASSES_SCOPE);
  const [scopeReady, setScopeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [view, setView] = useState<View>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [today, setToday] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRequestedClassId(classScopeFromSearchParams(new URLSearchParams(window.location.search)));
      setToday(dateKey(new Date().toISOString()));
      setScopeReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const query = requestedClassId === ALL_CLASSES_SCOPE ? "" : `?classId=${encodeURIComponent(requestedClassId)}`;
      const response = await fetch(`/api/planner${query}`, { cache: "no-store", credentials: "include" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || payload.error) throw new Error(apiError(payload.error, "Planner could not load."));
      setPlanner(payload.data ?? { announcements: [], events: [] });
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Planner could not load."); }
    finally { setLoading(false); }
  }, [requestedClassId]);

  useEffect(() => {
    if (!scopeReady) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, scopeReady]);

  const save = async () => {
    if (!form.title.trim()) { setActionError("Add a study title."); return; }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) { setActionError("End time must follow start time."); return; }
    setSaving(true); setActionError("");
    try {
      const response = await fetch("/api/planner", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "event", title: form.title.trim(), description: form.description || null,
          startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), location: form.location || null }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || payload.error) { setActionError(apiError(payload.error, "Study time was not saved.")); return; }
      setComposerOpen(false); setForm(EMPTY_FORM); await load();
    } catch { setActionError("Study time was not saved. Try again."); }
    finally { setSaving(false); }
  };

  const remove = async (event: ScheduleEvent) => {
    if (event.event_type !== "study") return;
    if (!(await confirm({ title: `Delete ${event.title}?`, body: "This study block will be removed from your planner.", confirmLabel: "Delete", danger: true }))) return;
    setActionError("");
    try {
      const response = await fetch(`/api/planner?type=event&id=${encodeURIComponent(event.id)}`, { method: "DELETE", credentials: "include" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || payload.error) { setActionError(apiError(payload.error, "Study time was not deleted.")); return; }
      await load();
    } catch { setActionError("Study time was not deleted. Try again."); }
  };

  const sortedEvents = useMemo(() => [...planner.events].sort((left, right) => new Date(eventDate(left) || 0).getTime() - new Date(eventDate(right) || 0).getTime()), [planner.events]);
  const weekDates = useMemo(() => {
    if (!today) return [];
    const [year, month, day] = today.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  }, [today, weekOffset]);
  const weekLabel = weekDates.length ? `${weekDates[0].toLocaleDateString([], { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString([], { month: "short", day: "numeric" })}` : "This week";

  const eventCard = (event: PlannerData["events"][number]) => <article key={event.id} className="group rounded-lg border border-line bg-surface p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted"><span className="capitalize">{event.event_type.replaceAll("_", " ")}</span><span>·</span><span>{event.class_name || "Personal"}</span></div><h3 className="truncate text-sm font-semibold text-fg">{event.title}</h3><p className="mt-1 text-xs text-fg-muted">{eventTime(event)}</p></div>
      {event.event_type === "study" && <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${event.title}`} onClick={() => void remove(event)} />}
    </div>
    {event.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-fg-muted">{event.description}</p>}
    {event.location && <p className="mt-1 truncate text-xs text-accent">{event.location}</p>}
  </article>;

  return <div className="page-shell max-w-6xl">
    <PageHeader title="Planner" icon={CalendarDays} actions={<Button variant="primary" icon={Plus} onClick={() => { setActionError(""); setComposerOpen(true); }}>Study time</Button>}>
      <p className="text-sm text-fg-muted">Deadlines, classes, and your own study blocks.</p>
    </PageHeader>
    {actionError && !composerOpen && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Segmented<View> value={view} onChange={setView} ariaLabel="Planner view" size="sm" options={[{ value: "week", label: "Week" }, { value: "agenda", label: "Agenda" }]} />
      <div className="flex items-center gap-2 text-sm">
        {requestedClassId !== ALL_CLASSES_SCOPE && <Link href="/student/planner" className="text-accent hover:underline">All classes</Link>}
        <Link href={scopedClassHref("/student/work", requestedClassId)} className="text-accent hover:underline">Assessments</Link>
      </div>
    </div>
    {loading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24" />)}</div> :
      loadError ? <EmptyState icon={CircleAlert} title="Planner unavailable" hint={loadError} action={<Button onClick={() => void load()}>Try again</Button>} /> :
      <>
        {planner.announcements.length > 0 && <aside className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3"><Bell size={16} className="mt-0.5 shrink-0 text-accent" /><div className="min-w-0"><p className="text-xs font-semibold text-fg">Latest class update</p><p className="truncate text-sm text-fg-muted">{planner.announcements[0].title}</p></div><Link href="/student/notifications" className="ml-auto shrink-0 text-xs font-semibold text-accent">View all</Link></aside>}
        {view === "week" ? <>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-fg">{weekLabel}</h2><div className="flex items-center gap-1"><Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} /><Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button><Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)} /></div></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{weekDates.map((date) => {
            const key = dateKey(date.toString());
            const dayEvents = sortedEvents.filter((event) => dateKey(eventDate(event)) === key);
            return <section key={key} className={`min-h-32 rounded-xl border p-2.5 ${key === today ? "border-accent bg-accent-soft/30" : "border-line bg-surface-2"}`}><h2 className="mb-2 text-xs font-semibold text-fg">{date.toLocaleDateString([], { weekday: "short", day: "numeric" })}</h2><div className="space-y-1.5">{dayEvents.length ? dayEvents.map((event) => <div key={event.id} className="rounded-md bg-surface px-2 py-1.5"><p className="line-clamp-2 text-xs font-medium text-fg">{event.title}</p><p className="text-[11px] text-fg-muted">{event.event_type.replaceAll("_", " ")}</p></div>) : <p className="text-xs text-fg-faint">No events</p>}</div></section>;
          })}</div>
          {sortedEvents.some((event) => !dateKey(eventDate(event))) && <section className="mt-5"><h2 className="mb-2 text-sm font-semibold text-fg">Unscheduled</h2><div className="grid gap-2 sm:grid-cols-2">{sortedEvents.filter((event) => !dateKey(eventDate(event))).map(eventCard)}</div></section>}
        </> : sortedEvents.length ? <div className="grid gap-2 sm:grid-cols-2">{sortedEvents.map(eventCard)}</div> : <EmptyState icon={Clock3} title="No plans yet" hint="Add a study block to start planning your week." />}
      </>}
    <Sheet open={composerOpen} onClose={() => { if (!saving) setComposerOpen(false); }} title="Add study time" description="Private to your own planner" footer={<><Button onClick={() => setComposerOpen(false)} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={() => void save()}>Save study time</Button></>}>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-fg">Title<input autoFocus className="input mt-1 w-full" maxLength={160} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Review chapter 3" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-fg">Starts<input type="datetime-local" className="input mt-1 w-full" value={form.startsAt} onChange={(event) => setForm((value) => ({ ...value, startsAt: event.target.value }))} /></label><label className="block text-sm font-medium text-fg">Ends<input type="datetime-local" className="input mt-1 w-full" value={form.endsAt} onChange={(event) => setForm((value) => ({ ...value, endsAt: event.target.value }))} /></label></div>
        <label className="block text-sm font-medium text-fg">Focus<textarea className="input mt-1 min-h-24 w-full" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="What will you work on?" /></label>
        <label className="block text-sm font-medium text-fg">Location or link<input className="input mt-1 w-full" value={form.location} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} placeholder="Optional" /></label>
        {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
      </div>
    </Sheet>
  </div>;
}
