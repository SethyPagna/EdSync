"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Settings2 } from "lucide-react";
import { Button, EmptyState, PageHeader, Segmented, Skeleton, Switch, usePersistentState } from "@/components/ui";
import {
  STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY,
  areStudentNotificationsPaused,
  defaultStudentDashboardVisibility,
  mergeStudentDashboardVisibility,
  studentNotificationToggleOptions,
  type StudentDashboardVisibility,
} from "@/lib/student/dashboard-preferences";
import type { Notification } from "@/types";

type Filter = "all" | "unread";

function message(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Notifications are unavailable.";
}

async function notificationRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/notifications", { credentials: "include", cache: "no-store", ...init });
  const payload = await response.json().catch(() => null) as { data?: T; error?: unknown } | null;
  if (!response.ok || payload?.data === undefined) throw new Error(message(payload?.error));
  return payload.data;
}

export default function StudentNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storedVisibility, setVisibility] = usePersistentState<StudentDashboardVisibility>(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY, defaultStudentDashboardVisibility);
  const visibility = mergeStudentDashboardVisibility(storedVisibility);
  const paused = areStudentNotificationsPaused(visibility);
  const unread = items.filter((item) => !item.read_at).length;
  const shown = filter === "unread" ? items.filter((item) => !item.read_at) : items;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setItems(await notificationRequest<Notification[]>()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Notifications are unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const markRead = async (id?: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await notificationRequest<{ updated: true }>({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read_at: item.read_at ?? now } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not mark as read."); }
    finally { setBusy(false); }
  };
  const toggle = (key: keyof StudentDashboardVisibility) => setVisibility((current) => { const resolved = mergeStudentDashboardVisibility(current); return { ...resolved, [key]: !resolved[key] }; });
  const setAll = (enabled: boolean) => setVisibility(Object.fromEntries(Object.keys(defaultStudentDashboardVisibility).map((key) => [key, enabled])) as StudentDashboardVisibility);

  return (
    <div className="page page-narrow">
      <PageHeader title="Notifications" count={unread} actions={unread > 0 ? <Button icon={CheckCheck} size="sm" onClick={() => void markRead()} loading={busy}>Mark all read</Button> : undefined} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><Segmented value={filter} onChange={setFilter} ariaLabel="Notification filter" options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: unread }]} /><details className="relative"><summary className="btn btn-secondary btn-sm cursor-pointer list-none"><Settings2 className="size-4" />Preferences</summary><div className="absolute right-0 z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-elevated p-4 shadow-soft"><div className="mb-3 flex gap-2"><Button size="sm" icon={BellOff} onClick={() => setAll(false)} disabled={paused}>Pause</Button><Button size="sm" icon={Bell} onClick={() => setAll(true)} disabled={!paused}>Enable all</Button></div><div className="space-y-3 border-t border-line pt-3">{studentNotificationToggleOptions.map((option) => <Switch key={option.key} checked={visibility[option.key]} onChange={() => toggle(option.key)} label={option.label} />)}</div></div></details></div>
      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"><span>{error}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>}
      {loading ? <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 rounded-lg" />)}</div> : shown.length ? <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{shown.map((item) => {
        const href = item.action_url?.startsWith("/") && !item.action_url.startsWith("//") ? item.action_url : null;
        return <article key={item.id} className={`flex items-start gap-3 p-4 ${item.read_at ? "" : "bg-accent-soft/40"}`}><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? "bg-line-strong" : "bg-accent"}`} aria-label={item.read_at ? "Read" : "Unread"} /><div className="min-w-0 flex-1">{href ? <Link href={href} onClick={() => { if (!item.read_at) void markRead(item.id); }} className="text-sm font-medium text-fg hover:text-accent">{item.title}</Link> : <h2 className="text-sm font-medium text-fg">{item.title}</h2>}<p className="mt-1 text-sm text-fg-muted">{item.message}</p><p className="mt-1.5 text-xs text-fg-faint">{new Date(item.created_at).toLocaleString()}</p></div>{!item.read_at && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void markRead(item.id)}>Read</Button>}</article>;
      })}</div> : !error ? <EmptyState icon={Bell} title={filter === "unread" ? "All caught up" : "No notifications yet"} compact /> : null}
    </div>
  );
}
