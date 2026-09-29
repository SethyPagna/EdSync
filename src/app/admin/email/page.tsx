"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Mail, RefreshCw, Search } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";

type EmailEvent = {
  id: string;
  subject: string;
  preview: string;
  recipient_count: number;
  recipient_sample: string[];
  sender_display: string | null;
  reply_to: string | null;
  compose_url: string | null;
  provider: string;
  status: string;
  created_at: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  class_name?: string | null;
};

export default function AdminEmailPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/email", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data)) throw new Error(payload.error || "Outbox unavailable.");
      setEvents(payload.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Outbox unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => events.filter((event) => {
    if (status !== "all" && event.status !== status) return false;
    const text = `${event.subject} ${event.teacher_name || ""} ${event.teacher_email || ""} ${event.class_name || ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [events, query, status]);
  const sent = events.filter((event) => event.status === "sent").length;
  const failed = events.filter((event) => event.status === "failed").length;

  const copyCompose = async (event: EmailEvent) => {
    if (!event.compose_url) return;
    try {
      await navigator.clipboard.writeText(event.compose_url);
      setCopiedId(event.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Could not copy the compose link.");
    }
  };

  return <div className="page-shell space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-edsync-blue">Communications</p><h1 className="font-display text-2xl font-bold">Email outbox</h1></div>
      <div className="flex items-center gap-2"><InfoPopover label="How email works">Free mode keeps an audited draft with a compose link. Provider mode can send directly.</InfoPopover><button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</button></div>
    </header>
    <div className="grid grid-cols-3 gap-2">
      <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Events</p><p className="text-xl font-bold">{events.length}</p></div>
      <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Sent</p><p className="text-xl font-bold text-edsync-emerald">{sent}</p></div>
      <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Failed</p><p className="text-xl font-bold text-edsync-red">{failed}</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-edsync-subtle" /><span className="sr-only">Search outbox</span><input className="edsync-input w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" /></label>
      <select className="edsync-input w-auto" aria-label="Filter email status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="queued">Queued</option><option value="composed">Composed</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
    </div>
    {error && <p role="alert" className="rounded-xl border border-edsync-red/30 bg-edsync-red/10 p-3 text-sm text-edsync-red">{error} <button type="button" className="underline" onClick={() => void load()}>Retry</button></p>}
    {loading && <div className="h-32 animate-pulse rounded-xl bg-edsync-muted" aria-label="Loading email outbox" />}
    {!loading && <section className="premium-surface divide-y divide-edsync-border rounded-xl">
      {visible.map((event) => <article key={event.id} className="flex flex-wrap items-start gap-3 p-3 sm:p-4">
        <span className="rounded-lg bg-edsync-blue/10 p-2 text-edsync-blue"><Mail className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{event.subject}</h2><p className="mt-1 truncate text-xs text-edsync-subtle">{event.teacher_name || event.teacher_email || "Creator"} · {event.recipient_count} recipients · {new Date(event.created_at).toLocaleString()}</p><details className="mt-2 text-xs text-edsync-subtle"><summary className="cursor-pointer font-semibold text-edsync-blue">Details</summary><p className="mt-2">{event.preview}</p>{event.recipient_sample.length > 0 && <p className="mt-1 break-words">To: {event.recipient_sample.join(", ")}</p>}{event.reply_to && <p className="mt-1">Reply to: {event.reply_to}</p>}</details></div>
        <span className={event.status === "sent" ? "badge bg-edsync-emerald/10 text-edsync-emerald" : event.status === "failed" ? "badge bg-edsync-red/10 text-edsync-red" : "badge bg-edsync-amber/10 text-edsync-amber"}>{event.status}</span>
        <div className="flex gap-1">{event.compose_url && <><a className="btn-secondary px-3 py-2 text-xs" href={event.compose_url}>Compose</a><button type="button" className="btn-ghost px-2 py-2" aria-label="Copy compose link" onClick={() => void copyCompose(event)}><Copy className="h-4 w-4" />{copiedId === event.id && <span className="sr-only">Copied</span>}</button></>}{(event.reply_to || event.teacher_email) && <a className="btn-ghost px-2 py-2 text-xs" href={"mailto:" + (event.reply_to || event.teacher_email)}>Reply</a>}</div>
      </article>)}
      {visible.length === 0 && <p className="p-6 text-sm text-edsync-subtle">{events.length === 0 ? "No outbox messages yet." : "No messages match this filter."}</p>}
    </section>}
  </div>;
}
