"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CalendarDays, ChevronLeft, ChevronRight, Megaphone, Plus, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, IconButton, Menu, PageHeader, Segmented, Sheet, Skeleton, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import type { Announcement, Class, ScheduleEvent } from "@/types";

type PlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};
type Mode = "event" | "deadline" | "announcement";
type View = "week" | "agenda";
type Draft = {
  mode: Mode;
  classId: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
  dueAt: string;
  location: string;
  priority: "low" | "normal" | "high";
};
const views: Array<{ value: View; label: string }> = [{ value: "week", label: "Week" }, { value: "agenda", label: "Agenda" }];
const modes: Array<{ value: Mode; label: string }> = [{ value: "event", label: "Event" }, { value: "deadline", label: "Deadline" }, { value: "announcement", label: "Update" }];

function blankDraft(classId = ""): Draft {
  return { mode: "event", classId, title: "", body: "", startsAt: "", endsAt: "", dueAt: "", location: "", priority: "normal" };
}

function errorText(value: unknown, fallback = "Planner request failed.") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

async function readData(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error || !payload) throw new Error(errorText(payload?.error));
  return payload.data;
}

function eventDate(event: ScheduleEvent) {
  const value = event.due_at || event.starts_at || event.created_at;
  return new Date(value);
}

function startOfWeek(date: Date, offset: number) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - (result.getDay() + 6) % 7 + offset * 7);
  return result;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export default function TeacherPlannerPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<Class[]>([]);
  const [planner, setPlanner] = useState<PlannerData>({ announcements: [], events: [] });
  const [classId, setClassId] = useState("all");
  const [view, setView] = useState<View>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Draft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to see your planner.");
      const [classResult, plan] = await Promise.all([
        edsync.from("classes").select("*").eq("teacher_id", user.id).eq("is_active", true).order("name"),
        fetch("/api/planner", { cache: "no-store" }).then(readData),
      ]);
      if (classResult.error) throw classResult.error;
      const ownClasses = (classResult.data || []) as Class[];
      setClasses(ownClasses);
      setPlanner((plan || { announcements: [], events: [] }) as PlannerData);
      setForm((current) => ({ ...current, classId: current.classId || ownClasses[0]?.id || "" }));
      const requested = new URLSearchParams(window.location.search).get("classId");
      if (requested && ownClasses.some((item) => item.id === requested)) setClassId(requested);
    } catch (cause) {
      setLoadError(errorText(cause, "Could not load planner."));
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToday(new Date());
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const chooseClass = (next: string) => {
    setClassId(next);
    if (next !== "all") setForm((current) => ({ ...current, classId: next }));
    router.replace(next === "all" ? "/teacher/planner" : "/teacher/planner?classId=" + encodeURIComponent(next), { scroll: false });
  };

  const scopedEvents = planner.events.filter((event) => classId === "all" || event.class_id === classId)
    .sort((left, right) => eventDate(left).getTime() - eventDate(right).getTime());
  const scopedAnnouncements = planner.announcements.filter((item) => classId === "all" || item.class_id === classId);
  const weekStart = today ? startOfWeek(today, weekOffset) : null;
  const weekDays = weekStart ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }) : [];
  const visibleEvents = view === "week" && weekStart
    ? scopedEvents.filter((event) => {
        const date = eventDate(event);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return date >= weekStart && date < weekEnd;
      })
    : scopedEvents;

  const openNew = (mode: Mode = "event") => {
    setForm(blankDraft(classId === "all" ? classes[0]?.id || "" : classId));
    setForm((current) => ({ ...current, mode }));
    setFormOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.classId) return toast.error("Choose a class.");
    if (!form.title.trim()) return toast.error("Add a title.");
    if (form.mode === "announcement" && !form.body.trim()) return toast.error("Add a message.");
    if (form.mode === "deadline" && !form.dueAt) return toast.error("Choose a due date.");
    if (form.mode === "event" && !form.startsAt) return toast.error("Choose a start time.");
    setSaving(true);
    try {
      const data = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.mode === "announcement" ? "announcement" : "event",
          classId: form.classId,
          title: form.title.trim(),
          body: form.body,
          description: form.body,
          priority: form.priority,
          eventType: form.mode === "deadline" ? "deadline" : form.mode === "event" ? "class" : "announcement",
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.mode === "event" && form.endsAt ? new Date(form.endsAt).toISOString() : null,
          dueAt: form.mode === "deadline" ? new Date(form.dueAt).toISOString() : null,
          location: form.location || null,
        }),
      }).then(readData);
      toast.success(form.mode === "announcement" ? "Sent to " + Number(data?.notified || 0) + " learners" : "Schedule updated");
      setFormOpen(false);
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: "event" | "announcement", id: string, title: string) => {
    if (!await confirm({ title: "Delete " + title + "?", body: "Learners will no longer see this item.", confirmLabel: "Delete", danger: true })) return;
    try {
      await fetch("/api/planner?type=" + kind + "&id=" + encodeURIComponent(id), { method: "DELETE" }).then(readData);
      toast.success("Planner item deleted");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    }
  };

  return (
    <main className="page">
      <PageHeader title="Planner" icon={CalendarDays} actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => openNew()}>Add item</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Planner view" value={view} onChange={setView} options={views} />
        <select className="input ml-auto min-w-36" aria-label="Filter by class" value={classId} onChange={(event) => chooseClass(event.target.value)}><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>
      {loadError ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{loadError} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      {view === "week" && weekStart ? <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-3 py-2"><IconButton icon={ChevronLeft} label="Previous week" onClick={() => setWeekOffset((value) => value - 1)} /><span className="text-sm font-semibold text-fg">{weekStart.toLocaleDateString([], { month: "long", day: "numeric" })} – {weekDays[6].toLocaleDateString([], { month: "short", day: "numeric" })}</span><IconButton icon={ChevronRight} label="Next week" onClick={() => setWeekOffset((value) => value + 1)} /></div>
        <div className="grid grid-cols-7 divide-x divide-line">{weekDays.map((day) => <div key={day.toISOString()} className={"min-w-0 px-1 py-2 text-center " + (today && sameDay(day, today) ? "bg-accent-soft" : "")}><p className="text-[10px] text-fg-muted">{day.toLocaleDateString([], { weekday: "short" })}</p><p className="text-sm font-semibold text-fg">{day.getDate()}</p><span className="mt-1 inline-block min-w-5 rounded-full bg-surface-2 px-1 text-[10px] text-fg-muted">{scopedEvents.filter((event) => sameDay(eventDate(event), day)).length}</span></div>)}</div>
      </div> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">{view === "week" ? "This week" : "Agenda"}</h2><Badge>{visibleEvents.length}</Badge></div>
          {loading ? <div className="space-y-2 p-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-14" />)}</div> :
            visibleEvents.length === 0 ? <EmptyState icon={CalendarDays} title="Nothing scheduled" hint="Add an event or deadline for your class." compact /> :
            visibleEvents.map((event) => <div key={event.id} className="border-b border-line last:border-b-0">
              <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                <span className="flex min-w-12 flex-col text-center text-xs text-fg-muted"><strong className="text-base text-fg">{eventDate(event).toLocaleDateString([], { day: "numeric" })}</strong>{eventDate(event).toLocaleDateString([], { month: "short" })}</span>
                <button type="button" aria-expanded={openEventId === event.id} onClick={() => setOpenEventId((current) => current === event.id ? null : event.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold text-fg">{event.title}</span><span className="block truncate text-xs text-fg-muted">{event.class_name || "Class"} · {eventDate(event).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{event.lesson_title ? " · " + event.lesson_title : ""}</span></button>
                <Badge className="hidden capitalize sm:inline-flex">{event.event_type.replaceAll("_", " ")}</Badge>
                <Menu label={"Actions for " + event.title} items={[{ label: "Delete", icon: Trash2, danger: true, onSelect: () => void remove("event", event.id, event.title) }]} />
              </div>
              {openEventId === event.id ? <div className="space-y-1 border-t border-line bg-surface-2 px-4 py-3 text-sm text-fg-muted">{event.description ? <p className="whitespace-pre-wrap">{event.description}</p> : null}{event.location ? <p>Location: {event.location}</p> : null}{event.ends_at ? <p>Ends {new Date(event.ends_at).toLocaleString()}</p> : null}{typeof event.metadata?.workType === "string" ? <Badge>{event.metadata.workType}</Badge> : null}</div> : null}
            </div>)}
        </section>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Class updates</h2><Button size="sm" icon={Plus} onClick={() => openNew("announcement")}>Send</Button></div>
          {scopedAnnouncements.length === 0 ? <EmptyState icon={Megaphone} title="No updates" hint="Send a short message to a class." compact /> :
            scopedAnnouncements.map((item) => <div key={item.id} className="border-b border-line px-4 py-3 last:border-b-0"><div className="flex items-start gap-2"><details className="min-w-0 flex-1"><summary className="cursor-pointer truncate text-sm font-semibold text-fg">{item.title}</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-fg-muted">{item.body}</p><p className="mt-1 text-[11px] text-fg-faint">{item.class_name || "Class"}</p></details><Menu label={"Actions for " + item.title} items={[{ label: "Delete", icon: Trash2, danger: true, onSelect: () => void remove("announcement", item.id, item.title) }]} /></div></div>)}
        </section>
      </div>
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title="Add to planner" footer={<Button variant="primary" type="submit" form="planner-form" loading={saving}>{form.mode === "announcement" ? "Send update" : "Save item"}</Button>}>
        <form id="planner-form" onSubmit={save} className="space-y-4">
          <Segmented ariaLabel="Planner item type" value={form.mode} onChange={(mode) => setForm((current) => ({ ...current, mode }))} options={modes} fullWidth />
          <label className="block text-sm font-medium text-fg">Class<select className="input mt-1 w-full" value={form.classId} required onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="block text-sm font-medium text-fg">Title<input className="input mt-1 w-full" required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label className="block text-sm font-medium text-fg">{form.mode === "announcement" ? "Message" : "Details"}<textarea className="input mt-1 min-h-24 w-full" required={form.mode === "announcement"} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
          {form.mode === "event" ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-fg">Starts<input className="input mt-1 w-full" type="datetime-local" required value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label><label className="block text-sm font-medium text-fg">Ends<input className="input mt-1 w-full" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label></div> : null}
          {form.mode === "deadline" ? <label className="block text-sm font-medium text-fg">Due<input className="input mt-1 w-full" type="datetime-local" required value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} /></label> : null}
          {form.mode === "announcement" ? <label className="block text-sm font-medium text-fg">Priority<select className="input mt-1 w-full" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Draft["priority"] }))}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label> : null}
          <label className="block text-sm font-medium text-fg">{form.mode === "announcement" ? "Attachment link" : "Location or link"}<input className="input mt-1 w-full" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Optional" /></label>
        </form>
      </Sheet>
    </main>
  );
}
