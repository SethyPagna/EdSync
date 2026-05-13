import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

const sections = [
  {
    title: "Standards",
    href: "/admin/standards",
    description: "Import and validate SCORM, xAPI, and cmi5-style learning packages.",
    icon: FileCheck2,
    tone: "text-edsync-blue",
    detail: "Use this when outside course content needs launch tracking or package metadata.",
  },
  {
    title: "Certifications",
    href: "/admin/certifications",
    description: "Create expiry, renewal, and notification rules for compliance learning.",
    icon: BadgeCheck,
    tone: "text-edsync-emerald",
    detail: "Use this for annual training, licenses, required refreshers, and audit trails.",
  },
  {
    title: "Automation",
    href: "/admin/automation",
    description: "Build if-this-then-that rules for nudges, unlocks, reminders, and badges.",
    icon: Sparkles,
    tone: "text-edsync-amber",
    detail: "Use this to reduce manual follow-up while keeping teachers in control.",
  },
  {
    title: "Security",
    href: "/admin/security",
    description: "Review security events, admin actions, and platform-level audit activity.",
    icon: ShieldCheck,
    tone: "text-edsync-red",
    detail: "Use this to investigate suspicious behavior and verify owner-level changes.",
  },
] as const;

export default function AdminGovernancePage() {
  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Governance</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-edsync-text sm:text-4xl">
            Standards, compliance, automation, and trust
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-edsync-subtle">
            This hub groups the operational controls that keep EdSync reliable across tenants. Use it as the starting point before drilling into a specific governance tool.
          </p>
        </div>
        <GuidePanel
          title="Platform-owner scope"
          description="These tools affect the platform or a selected tenant. Organization managers should receive scoped role profiles so their changes stay inside their own workspace."
          icon={ShieldCheck}
          items={[
            "Global admin: full application oversight.",
            "Org manager: tenant-only users, menus, feature visibility, and learning ops.",
            "Teacher: classroom-level learning work and feedback.",
          ]}
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-lg border border-edsync-border bg-edsync-card p-5 transition hover:border-edsync-blue/40 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-current/10 ${section.tone}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-edsync-subtle" />
              </div>
              <h2 className="mt-5 font-display text-xl font-bold text-edsync-text">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-edsync-subtle">{section.description}</p>
              <p className="mt-4 rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
                {section.detail}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

