"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, BookOpenCheck, Building2, Mail, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader, StatTile } from "@/components/ui";

type Summary = { cards: Record<string, number>; recentAudit: Array<{ id: string; action: string; entity_type: string; created_at: string }> };

const destinations = [
  { href: "/admin/users", label: "People", detail: "Accounts and access", icon: UsersRound },
  { href: "/admin/permissions", label: "Permissions", detail: "Tenant role profiles", icon: ShieldCheck },
  { href: "/admin/governance", label: "Governance", detail: "Rules and standards", icon: BookOpenCheck },
  { href: "/admin/view/organization", label: "Organizations", detail: "Portals and tenants", icon: Building2 },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/summary", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Could not load summary."); return payload.data as Summary; })
      .then(setSummary)
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Could not load summary."); });
    return () => controller.abort();
  }, []);

  return <div className="page-shell space-y-5">
    <PageHeader title="Platform overview" icon={Activity} />
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
    <section aria-label="Platform totals" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="People" value={summary?.cards.users ?? "—"} icon={UsersRound} href="/admin/users" />
      <StatTile label="Spaces" value={summary?.cards.classes ?? "—"} icon={BookOpenCheck} href="/admin/view/organization" />
      <StatTile label="Work items" value={summary?.cards.workItems ?? "—"} icon={Activity} />
      <StatTile label="Evidence" value={summary?.cards.submissions ?? "—"} icon={BookOpenCheck} />
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Recent admin activity</h2><span className="text-xs text-fg-faint">Latest actions</span></div>
        <div className="divide-y divide-line">
          {(summary?.recentAudit ?? []).slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm"><span className="min-w-0 flex-1 truncate font-medium text-fg">{item.action.replaceAll("_", " ")}</span><span className="hidden text-fg-muted sm:inline">{item.entity_type}</span><time className="shrink-0 text-xs text-fg-faint">{new Date(item.created_at).toLocaleDateString()}</time></div>)}
          {summary && summary.recentAudit.length === 0 && <p className="px-4 py-8 text-center text-sm text-fg-muted">No admin activity yet.</p>}
          {!summary && !error && <p className="px-4 py-8 text-center text-sm text-fg-muted">Loading activity…</p>}
        </div>
      </section>
      <div className="space-y-4">
        <section className="card p-4"><h2 className="text-sm font-semibold text-fg">System health</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center">{[["Providers", "providers", ShieldCheck], ["Email", "emails", Mail], ["Security", "securityEvents", ShieldCheck]].map(([label, key, Icon]) => { const Symbol = Icon as typeof ShieldCheck; return <div key={key as string} className="rounded-lg bg-surface-2 p-2"><Symbol size={16} className="mx-auto text-fg-muted" /><p className="mt-1 text-lg font-semibold tabular-nums text-fg">{summary?.cards[key as string] ?? "—"}</p><p className="text-[11px] text-fg-muted">{label as string}</p></div>; })}</div></section>
        <section className="card divide-y divide-line overflow-hidden"><h2 className="px-4 py-3 text-sm font-semibold text-fg">Manage</h2>{destinations.map(({ href, label, detail, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"><Icon size={17} className="shrink-0 text-fg-muted" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-fg">{label}</span><span className="block truncate text-xs text-fg-muted">{detail}</span></span><ArrowUpRight size={15} className="text-fg-faint" /></Link>)}</section>
      </div>
    </div>
  </div>;
}
