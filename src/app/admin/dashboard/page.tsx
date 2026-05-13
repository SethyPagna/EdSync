"use client";

import { useEffect, useState } from "react";
import { Activity, Bot, BookOpenCheck, Mail, ShieldCheck, UsersRound } from "lucide-react";

type Summary = {
  cards: Record<string, number>;
  recentAudit: Array<{ id: string; action: string; entity_type: string; created_at: string }>;
};

const cardLabels = [
  ["users", "Users", UsersRound],
  ["classes", "Classes", BookOpenCheck],
  ["workItems", "Work items", Activity],
  ["submissions", "Submissions", Activity],
  ["providers", "AI providers", Bot],
  ["emails", "Email events", Mail],
  ["securityEvents", "Security events", ShieldCheck],
] as const;

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/summary", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setSummary(payload.data));
  }, []);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin overview</h1>
        <p className="mt-2 text-sm text-edsync-subtle">
          Monitor users, learning work, AI providers, email outbox, and security from one console.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cardLabels.map(([key, label, Icon]) => (
          <div key={key} className="edsync-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-edsync-subtle">{label}</p>
              <Icon className="h-5 w-5 text-edsync-blue" />
            </div>
            <p className="mt-3 text-3xl font-bold">{summary?.cards?.[key] ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="edsync-card overflow-hidden">
        <div className="border-b border-edsync-border p-4">
          <h2 className="font-display text-xl font-bold">Recent admin audit</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {(summary?.recentAudit ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold">{item.action}</span>
              <span className="text-edsync-subtle">{item.entity_type}</span>
              <span className="text-edsync-subtle">{new Date(item.created_at).toLocaleString()}</span>
            </div>
          ))}
          {summary && summary.recentAudit.length === 0 && (
            <p className="p-4 text-sm text-edsync-subtle">No admin actions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
