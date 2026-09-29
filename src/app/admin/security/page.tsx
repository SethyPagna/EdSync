"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";

type SecurityEvent = { id: string; event_type: string; severity: string; message: string; created_at: string };
type AuditEvent = { id: string; action: string; entity_type: string; entity_id: string | null; metadata?: Record<string, unknown> | string | null; admin_email: string | null; created_at: string };
type SecurityPayload = { securityEvents: SecurityEvent[]; auditLogs: AuditEvent[] };

function metadataOf(value: AuditEvent["metadata"]) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function auditTitle(event: AuditEvent) {
  if (event.action === "open_view_mode") return `Opened ${event.entity_id === "student" ? "org learner" : "org creator"} view`;
  return event.action.split("_").filter(Boolean).map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function auditDetail(event: AuditEvent) {
  const metadata = metadataOf(event.metadata);
  const path = typeof metadata.path === "string" ? metadata.path : null;
  if (event.action === "open_view_mode") return path ? `Read-only preview: ${path}` : "Read-only preview";
  return event.entity_id ? `${event.entity_type}: ${event.entity_id}` : event.entity_type;
}

export default function AdminSecurityPage() {
  const [payload, setPayload] = useState<SecurityPayload>({ securityEvents: [], auditLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"events" | "audit">("events");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/security", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.data) throw new Error(result.error || "Security activity unavailable.");
      setPayload(result.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Security activity unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const events = useMemo(() => payload.securityEvents.filter((event) => `${event.event_type} ${event.message} ${event.severity}`.toLowerCase().includes(query.toLowerCase())), [payload.securityEvents, query]);
  const audits = useMemo(() => payload.auditLogs.filter((event) => `${event.action} ${event.admin_email || ""} ${event.entity_type}`.toLowerCase().includes(query.toLowerCase())), [payload.auditLogs, query]);
  const highRisk = payload.securityEvents.filter((event) => ["high", "critical", "error"].includes(event.severity.toLowerCase())).length;

  return <div className="page-shell space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-edsync-blue">Trust center</p><h1 className="font-display text-2xl font-bold">Security</h1></div><div className="flex gap-2"><InfoPopover label="Security help">Review high severity signals and administrative changes first.</InfoPopover><button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</button></div></header>
    <div className="grid grid-cols-3 gap-2"><div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Signals</p><p className="text-xl font-bold">{payload.securityEvents.length}</p></div><div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">High risk</p><p className="text-xl font-bold text-edsync-red">{highRisk}</p></div><div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Admin actions</p><p className="text-xl font-bold">{payload.auditLogs.length}</p></div></div>
    <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-edsync-border p-1" role="tablist" aria-label="Security activity"><button type="button" role="tab" aria-selected={view === "events"} className={view === "events" ? "rounded-lg bg-edsync-muted px-3 py-1.5 text-sm font-semibold" : "px-3 py-1.5 text-sm text-edsync-subtle"} onClick={() => setView("events")}><AlertTriangle className="mr-1 inline h-4 w-4" />Events</button><button type="button" role="tab" aria-selected={view === "audit"} className={view === "audit" ? "rounded-lg bg-edsync-muted px-3 py-1.5 text-sm font-semibold" : "px-3 py-1.5 text-sm text-edsync-subtle"} onClick={() => setView("audit")}><ClipboardList className="mr-1 inline h-4 w-4" />Audit</button></div><label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-edsync-subtle" /><span className="sr-only">Search security activity</span><input className="edsync-input w-full pl-9" placeholder="Search activity" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {error && <p role="alert" className="rounded-xl border border-edsync-red/30 bg-edsync-red/10 p-3 text-sm text-edsync-red">{error} <button type="button" className="underline" onClick={() => void load()}>Retry</button></p>}
    {loading && <div className="h-32 animate-pulse rounded-xl bg-edsync-muted" aria-label="Loading security activity" />}
    {!loading && view === "events" && <section className="premium-surface divide-y divide-edsync-border rounded-xl">{events.map((event) => <article key={event.id} className="flex flex-wrap items-start gap-3 p-3 text-sm sm:p-4"><span className={highRisk && ["high", "critical", "error"].includes(event.severity.toLowerCase()) ? "rounded-lg bg-edsync-red/10 p-2 text-edsync-red" : "rounded-lg bg-edsync-blue/10 p-2 text-edsync-blue"}><ShieldCheck className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{event.event_type.replace(/_/g, " ")}</p><p className="mt-1 text-xs text-edsync-subtle">{event.message}</p></div><div className="text-right"><span className="badge bg-edsync-muted text-edsync-subtle">{event.severity}</span><p className="mt-1 text-xs text-edsync-subtle">{new Date(event.created_at).toLocaleString()}</p></div></article>)}{events.length === 0 && <p className="p-6 text-sm text-edsync-subtle">No security events match.</p>}</section>}
    {!loading && view === "audit" && <section className="premium-surface divide-y divide-edsync-border rounded-xl">{audits.map((event) => <article key={event.id} className="flex flex-wrap items-start gap-3 p-3 text-sm sm:p-4"><span className="rounded-lg bg-edsync-blue/10 p-2 text-edsync-blue"><ClipboardList className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{auditTitle(event)}</p><p className="mt-1 truncate text-xs text-edsync-subtle">{auditDetail(event)}</p></div><div className="text-right text-xs text-edsync-subtle"><p>{event.admin_email || "System"}</p><p>{new Date(event.created_at).toLocaleString()}</p></div></article>)}{audits.length === 0 && <p className="p-6 text-sm text-edsync-subtle">No admin actions match.</p>}</section>}
  </div>;
}
