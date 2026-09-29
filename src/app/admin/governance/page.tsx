"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck, Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui";

const sections = [
  { href: "/admin/standards", title: "Standards packages", icon: FileCheck2, key: "standards", detail: "Manifests and launch paths" },
  { href: "/admin/certifications", title: "Certifications", icon: BadgeCheck, key: "certifications", detail: "Expiry and evidence rules" },
  { href: "/admin/automation", title: "Automation", icon: Workflow, key: "automation", detail: "Triggers and actions" },
  { href: "/admin/security", title: "Security", icon: ShieldCheck, key: "security", detail: "Events and audit trail" },
] as const;

export default function AdminGovernancePage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const requests = [
      ["standards", "/api/standards", "packages"],
      ["certifications", "/api/certifications", "rules"],
      ["automation", "/api/automation-rules", "rules"],
      ["security", "/api/admin/security", "securityEvents"],
    ] as const;
    Promise.allSettled(requests.map(async ([key, url, field]) => { const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error(key); const payload = await response.json(); return [key, (payload.data?.[field] ?? []).length] as const; }))
      .then((results) => setCounts(Object.fromEntries(results.filter((result) => result.status === "fulfilled").map((result) => result.value))));
  }, []);
  return <div className="page-shell space-y-4"><PageHeader title="Governance" icon={ShieldCheck} back="/admin/dashboard" />
    <div className="card divide-y divide-line overflow-hidden">{sections.map(({ href, title, detail, icon: Icon, key }) => <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{title}</span><span className="block text-xs text-fg-muted">{detail}</span></span><span className="text-sm font-semibold tabular-nums text-fg-muted">{counts[key] ?? "—"}</span><ArrowRight size={16} className="text-fg-faint" /></Link>)}</div>
  </div>;
}
