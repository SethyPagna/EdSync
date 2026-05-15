"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Copy, Mail, MailCheck, MailWarning, Users } from "lucide-react";
import { ActionMenu, InfoPopover, MetricTile } from "@/components/WorkspacePrimitives";

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
  status: "queued" | "composed" | "sent" | "failed" | "skipped" | string;
  created_at: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  class_name?: string | null;
};

export default function AdminEmailPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/email", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setEvents(payload.data ?? []));
  }, []);

  const sent = events.filter((event) => event.status === "sent").length;
  const queued = events.filter((event) => event.status === "queued").length;
  const failed = events.filter((event) => event.status === "failed").length;
  const recipients = events.reduce((total, event) => total + event.recipient_count, 0);

  async function copyCompose(event: EmailEvent) {
    if (!event.compose_url) return;
    await navigator.clipboard.writeText(event.compose_url);
    setCopiedId(event.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Email outbox</h1>
          <p className="mt-2 text-sm text-edsync-subtle">Review teacher messages, compose links, provider status, and recipient reach.</p>
        </div>
        <InfoPopover label="How email works">
          <p>Free mode stores an audited outbox row and generates compose links. Provider mode can send through the configured provider, while keeping reply-to and recipients transparent.</p>
        </InfoPopover>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Outbox events" value={events.length} icon={Mail} detail={`${queued} queued`} />
        <MetricTile label="Recipients" value={recipients} icon={Users} tone="text-emerald-600" detail="Across the latest 100 events" />
        <MetricTile label="Sent" value={sent} icon={MailCheck} tone="text-sky-600" detail="Provider-confirmed deliveries" />
        <MetricTile label="Needs review" value={failed} icon={MailWarning} tone="text-rose-600" detail="Failed provider attempts" />
      </section>

      <section className="grid gap-3">
        {events.map((event) => (
          <article key={event.id} className="rounded-lg border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={event.status} />
                  <span className="rounded-full border border-edsync-border px-2 py-1 text-xs font-semibold text-edsync-subtle">{event.provider}</span>
                  {event.class_name && <span className="rounded-full border border-edsync-border px-2 py-1 text-xs font-semibold text-edsync-subtle">{event.class_name}</span>}
                </div>
                <h2 className="break-words font-display text-xl font-bold text-edsync-text">{event.subject}</h2>
                <p className="line-clamp-2 text-sm leading-6 text-edsync-subtle">{event.preview}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-edsync-subtle">
                  <span>{event.teacher_name || event.teacher_email || "Unknown teacher"}</span>
                  <span>{event.recipient_count} recipients</span>
                  <span>{new Date(event.created_at).toLocaleString()}</span>
                </div>
                {event.recipient_sample.length > 0 && (
                  <p className="break-words text-xs text-edsync-subtle">
                    {event.recipient_sample.join(", ")}
                    {event.recipient_count > event.recipient_sample.length ? " ..." : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {event.compose_url && (
                  <a className="btn-primary justify-center px-3 py-2 text-sm" href={event.compose_url}>
                    <Mail className="h-4 w-4" />
                    Compose
                  </a>
                )}
                <ActionMenu label={`${event.subject} actions`}>
                  <button type="button" className="btn-secondary justify-start px-3 py-2 text-sm" onClick={() => copyCompose(event)} disabled={!event.compose_url}>
                    <Copy className="h-4 w-4" />
                    {copiedId === event.id ? "Copied" : "Copy link"}
                  </button>
                  <a className="btn-secondary justify-start px-3 py-2 text-sm" href={`mailto:${event.reply_to ?? event.teacher_email ?? ""}`}>
                    <Mail className="h-4 w-4" />
                    Reply-to
                  </a>
                </ActionMenu>
              </div>
            </div>
          </article>
        ))}
        {events.length === 0 && (
          <div className="rounded-lg border border-dashed border-edsync-border bg-edsync-card p-8 text-center">
            <Mail className="mx-auto h-10 w-10 text-edsync-subtle" />
            <p className="mt-3 font-semibold text-edsync-text">No outbox events yet</p>
            <p className="mt-1 text-sm text-edsync-subtle">Class emails and compose drafts will appear here after teachers send them.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: EmailEvent["status"] }) {
  const icon = status === "sent" ? CheckCircle2 : status === "failed" ? MailWarning : Clock3;
  const Icon = icon;
  const tone =
    status === "sent"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold capitalize ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
