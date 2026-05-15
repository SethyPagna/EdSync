"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";

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
    description: "Packages and launch paths.",
    icon: FileCheck2,
    tone: "text-edsync-blue",
    key: "standards",
  },
  {
    title: "Certifications",
    href: "/admin/certifications",
    description: "Renewal and evidence rules.",
    icon: BadgeCheck,
    tone: "text-edsync-emerald",
    key: "certifications",
  },
  {
    title: "Automation",
    href: "/admin/automation",
    description: "Nudges, unlocks, reminders.",
    icon: Sparkles,
    tone: "text-edsync-amber",
    key: "automations",
  },
  {
    title: "Security",
    href: "/admin/security",
    description: "Events and audit trail.",
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
        </div>
        <InfoPopover label="How governance works">
          One hub for standards, certifications, automation, and security. Open a card to add, edit, delete, or toggle records.
        </InfoPopover>
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

      <section className="grid gap-3 lg:grid-cols-3">
        {["Review launch paths", "Set renewal rules", "Enable automations last"].map((item) => (
          <div key={item} className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm font-semibold text-edsync-text transition hover:-translate-y-0.5 hover:border-edsync-blue/40 hover:shadow-card-hover">
            {item}
          </div>
        ))}
      </section>
    </div>
  );
}
