"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpenCheck,
  Mail,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { GuidePanel, MetricTile } from "@/components/WorkspacePrimitives";

type Summary = {
  cards: Record<string, number>;
  recentAudit: Array<{ id: string; action: string; entity_type: string; created_at: string }>;
};

const platformMetrics = [
  ["users", "Users", UsersRound, "text-edsync-blue", "All platform identities."],
  ["classes", "Classes", BookOpenCheck, "text-edsync-emerald", "Active learning spaces."],
  ["workItems", "Work items", Activity, "text-edsync-amber", "Tasks, tests, quizzes, and discussions."],
  ["submissions", "Submissions", Activity, "text-edsync-cyan", "Learner evidence captured."],
] as const;

const systemMetrics = [
  ["providers", "AI providers", Bot, "text-edsync-purple", "Smart fallback capacity."],
  ["emails", "Email events", Mail, "text-edsync-blue", "Outbox and compose records."],
  ["securityEvents", "Security events", ShieldCheck, "text-edsync-red", "Items needing review."],
] as const;

const priorityActions = [
  {
    title: "Review AI provider health",
    detail: "Test enabled providers, check cooldowns, and confirm encrypted keys are usable.",
    href: "/admin/ai",
  },
  {
    title: "Tune platform permissions",
    detail: "Keep global owner access separate from tenant-scoped organization roles.",
    href: "/admin/permissions",
  },
  {
    title: "Open governance hub",
    detail: "Manage standards, certifications, automation, and security from one place.",
    href: "/admin/governance",
  },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setSummary(payload.data));
  }, []);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <header className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-edsync-border bg-edsync-card p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Platform owner console</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-edsync-text sm:text-4xl">
                Admin command center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-edsync-subtle">
                Monitor the whole EdSync application, separate global owner tasks from tenant operations, and jump into the areas that need attention.
              </p>
            </div>
            <Link href="/admin/governance" className="btn-primary w-full justify-center sm:w-fit">
              Governance hub
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <GuidePanel
          title="What to check first"
          description="Start with system health, then review governance and access changes. Tenant managers should only receive scoped controls for their own organization."
          icon={ShieldCheck}
          items={[
            "AI provider tests should pass before teachers generate content.",
            "Security events and global admin grants should be reviewed regularly.",
            "Feature visibility belongs in tenant-scoped roles whenever possible.",
          ]}
        />
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {platformMetrics.map(([key, label, Icon, tone, detail]) => (
          <MetricTile
            key={key}
            label={label}
            value={summary?.cards?.[key] ?? 0}
            icon={Icon}
            tone={tone}
            detail={detail}
          />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {systemMetrics.map(([key, label, Icon, tone, detail]) => (
              <MetricTile
                key={key}
                label={label}
                value={summary?.cards?.[key] ?? 0}
                icon={Icon}
                tone={tone}
                detail={detail}
              />
            ))}
          </div>

          <section className="edsync-card overflow-hidden p-0">
            <div className="border-b border-edsync-border p-4">
              <h2 className="font-display text-xl font-bold">Recent admin audit</h2>
              <p className="mt-1 text-sm text-edsync-subtle">Owner-level actions and platform changes.</p>
            </div>
            <div className="divide-y divide-edsync-border">
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
              className="block rounded-lg border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40"
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
