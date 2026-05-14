"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";

type GovernanceCounts = {
  standards: number;
  certifications: number;
  automations: number;
  securityEvents: number;
};

const cards = [
  {
    title: "Standards",
    href: "/admin/standards",
    description: "SCORM, xAPI, and cmi5 package parsing, launch paths, and archive state.",
    icon: FileCheck2,
    tone: "text-edsync-blue",
    key: "standards",
  },
  {
    title: "Certifications",
    href: "/admin/certifications",
    description: "Renewal windows, expiry rules, reminder timing, and compliance audit setup.",
    icon: BadgeCheck,
    tone: "text-edsync-emerald",
    key: "certifications",
  },
  {
    title: "Automation",
    href: "/admin/automation",
    description: "Nudges, mastery unlocks, deadline reminders, badge actions, and queued jobs.",
    icon: Sparkles,
    tone: "text-edsync-amber",
    key: "automations",
  },
  {
    title: "Security",
    href: "/admin/security",
    description: "Security events, admin audit logs, and owner-level investigation history.",
    icon: ShieldCheck,
    tone: "text-edsync-red",
    key: "securityEvents",
  },
] as const;

export default function AdminGovernancePage() {
  const [counts, setCounts] = useState<GovernanceCounts>({ standards: 0, certifications: 0, automations: 0, securityEvents: 0 });

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/standards", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/certifications", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/automation-rules", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/security", { cache: "no-store" }).then((res) => res.json()),
    ]).then(([standards, certifications, automations, security]) => {
      setCounts({
        standards: standards.status === "fulfilled" ? standards.value.data?.packages?.length ?? 0 : 0,
        certifications: certifications.status === "fulfilled" ? certifications.value.data?.rules?.length ?? 0 : 0,
        automations: automations.status === "fulfilled" ? automations.value.data?.rules?.length ?? 0 : 0,
        securityEvents: security.status === "fulfilled" ? security.value.data?.securityEvents?.length ?? 0 : 0,
      });
    });
  }, []);

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Governance</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Governance Workspace</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Standards, certifications, automations, and security are grouped here so they feel like one operating system instead of scattered pages.
          </p>
        </div>
        <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle lg:max-w-md">
          Use this hub to decide what needs action, then open the focused manager to add, edit, delete, or toggle records.
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const count = counts[card.key];
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-lg border border-edsync-border bg-edsync-card p-5 transition hover:border-edsync-blue/40 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-current/10 ${card.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-edsync-subtle" />
              </div>
              <h2 className="mt-5 font-display text-xl font-bold text-edsync-text">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-edsync-subtle">{card.description}</p>
              <p className="mt-4 text-3xl font-bold text-edsync-text">{count}</p>
              <p className="text-sm text-edsync-subtle">current records</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="edsync-card p-4">
          <p className="font-semibold text-edsync-text">Recommended setup</p>
          <p className="mt-2 text-sm leading-6 text-edsync-subtle">Keep standard package imports archived until launch paths are reviewed, then assign them through course content.</p>
        </div>
        <div className="edsync-card p-4">
          <p className="font-semibold text-edsync-text">Compliance baseline</p>
          <p className="mt-2 text-sm leading-6 text-edsync-subtle">Create certification rules before learner enrollment so renewal evidence and reminders stay consistent.</p>
        </div>
        <div className="edsync-card p-4">
          <p className="font-semibold text-edsync-text">Automation safety</p>
          <p className="mt-2 text-sm leading-6 text-edsync-subtle">Start automations paused, test them with low-risk notifications, then enable unlocks or badges after review.</p>
        </div>
      </section>
    </div>
  );
}
