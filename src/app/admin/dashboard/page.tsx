"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpenCheck,
  Building2,
  Mail,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { InfoPopover, MetricTile } from "@/components/WorkspacePrimitives";

type Summary = {
  cards: Record<string, number>;
  recentAudit: Array<{ id: string; action: string; entity_type: string; created_at: string }>;
};

const platformMetrics = [
  ["users", "Users", UsersRound, "text-edsync-blue", ""],
  ["classes", "Spaces", BookOpenCheck, "text-edsync-emerald", ""],
  ["workItems", "Tasks", Activity, "text-edsync-amber", ""],
  ["submissions", "Evidence", Activity, "text-edsync-cyan", ""],
] as const;

const systemMetrics = [
  ["providers", "AI providers", Bot, "text-edsync-purple", ""],
  ["emails", "Email events", Mail, "text-edsync-blue", ""],
  ["securityEvents", "Security events", ShieldCheck, "text-edsync-red", ""],
] as const;

const priorityActions = [
  {
    title: "Review AI provider health",
    detail: "Test providers.",
    href: "/admin/ai",
  },
  {
    title: "Tune platform permissions",
    detail: "Review roles.",
    href: "/admin/permissions",
  },
  {
    title: "Open governance hub",
    detail: "Open hub.",
    href: "/admin/governance",
  },
];

const ownerViewActions = [
  {
    title: "Individual account",
    detail: "Solo creator and learner path.",
    href: "/admin/view/individual",
    icon: UserRound,
  },
  {
    title: "Organizations",
    detail: "Portals and tenant setup.",
    href: "/admin/view/organization",
    icon: Building2,
  },
  {
    title: "Organization teacher",
    detail: "Creator workspace inside an organization.",
    href: "/admin/view/teacher",
    icon: UsersRound,
  },
  {
    title: "Organization student",
    detail: "Learner workspace inside an organization.",
    href: "/admin/view/student",
    icon: BookOpenCheck,
  },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/summary", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setSummary(payload.data);
        setError(null);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Could not load platform summary.");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <header className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <section className="premium-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Platform owner console</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-edsync-text sm:text-4xl">
                Admin command center
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <InfoPopover label="Owner console help">
                Global owner controls stay separate from tenant-scoped organization manager controls.
              </InfoPopover>
              <Link href="/admin/governance" className="btn-primary w-fit justify-center px-4 py-2">
                Governance
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-2xl border border-edsync-red/25 bg-edsync-red/10 px-4 py-3 text-sm font-semibold text-edsync-red">
              {error}
            </div>
          )}
        </section>
      </header>

      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {platformMetrics.map(([key, label, Icon, tone, detail]) => (
          <MetricTile
            key={key}
            label={label}
            value={summary?.cards?.[key] ?? 0}
            icon={Icon}
            tone={tone}
            detail={detail}
            compact
          />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <section className="edsync-scrollbar-none grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-4 sm:overflow-visible sm:pb-0">
            {ownerViewActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="premium-card group flex min-w-0 items-center gap-3 rounded-xl p-3 transition hover:-translate-y-0.5"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-edsync-text">{action.title}</span>
                    <span className="edsync-hover-detail">{action.detail}</span>
                  </span>
                </Link>
              );
            })}
          </section>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {systemMetrics.map(([key, label, Icon, tone, detail]) => (
              <MetricTile
                key={key}
                label={label}
                value={summary?.cards?.[key] ?? 0}
                icon={Icon}
                tone={tone}
                detail={detail}
                compact
              />
            ))}
          </div>

          <section className="premium-surface overflow-hidden rounded-2xl p-0">
            <div className="border-b border-edsync-border p-4">
              <h2 className="font-display text-xl font-bold">Recent admin audit</h2>
            </div>
            <div className="divide-y divide-edsync-border">
              {!summary &&
                [...Array(4)].map((_, index) => (
                  <div key={index} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_160px_190px]">
                    <span className="h-4 animate-pulse rounded bg-edsync-muted" />
                    <span className="h-4 animate-pulse rounded bg-edsync-muted" />
                    <span className="h-4 animate-pulse rounded bg-edsync-muted" />
                  </div>
                ))}
              {(summary?.recentAudit ?? []).map((item) => (
                <div key={item.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_160px_190px] md:items-center">
                  <span className="font-semibold text-edsync-text">{item.action}</span>
                  <span className="text-edsync-subtle">{item.entity_type}</span>
                  <span className="text-edsync-subtle">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              ))}
              {summary && summary.recentAudit.length === 0 && (
                <p className="p-4 text-sm text-edsync-subtle">No admin actions yet.</p>
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-3">
          <h2 className="font-display text-xl font-bold">Priority actions</h2>
          {priorityActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="premium-card group block rounded-2xl p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-edsync-text">{action.title}</p>
                  <p className="mt-1 text-sm leading-5 text-edsync-subtle">{action.detail}</p>
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-edsync-subtle" />
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
