"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, ShieldCheck } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

type SecurityPayload = {
  securityEvents: Array<{ id: string; event_type: string; severity: string; message: string; created_at: string }>;
  auditLogs: Array<{ id: string; action: string; entity_type: string; admin_email: string | null; created_at: string }>;
};

export default function AdminSecurityPage() {
  const [payload, setPayload] = useState<SecurityPayload>({ securityEvents: [], auditLogs: [] });

  useEffect(() => {
    fetch("/api/admin/security", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setPayload(data.data ?? { securityEvents: [], auditLogs: [] }));
  }, []);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Trust center</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Security</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Review security events and owner-level admin activity. Use this page to confirm who changed what, when, and why it matters.
          </p>
        </div>
        <GuidePanel
          title="How to read this page"
          description="Security events describe system or access risks. Admin audit logs describe intentional owner actions and configuration changes."
          icon={ShieldCheck}
          items={[
            "High severity: investigate immediately.",
            "Admin grants: verify the user really needs global access.",
            "Tenant changes: prefer scoped organization roles.",
          ]}
          tone="text-edsync-red"
        />
      </div>

      <section className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><AlertTriangle className="h-5 w-5 text-edsync-red" /> Security events</h2>
          <p className="mt-1 text-sm text-edsync-subtle">Risk signals, blocked activity, and account protection events.</p>
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.securityEvents.map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[160px_120px_1fr_180px]">
              <span className="font-semibold">{event.event_type}</span>
              <span className="capitalize text-edsync-subtle">{event.severity}</span>
              <span>{event.message}</span>
              <span className="text-edsync-subtle">{new Date(event.created_at).toLocaleString()}</span>
            </div>
          ))}
          {payload.securityEvents.length === 0 && <p className="p-4 text-sm text-edsync-subtle">No security events recorded.</p>}
        </div>
      </section>

      <section className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><ClipboardList className="h-5 w-5 text-edsync-blue" /> Admin audit</h2>
          <p className="mt-1 text-sm text-edsync-subtle">Platform owner changes and sensitive admin actions.</p>
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.auditLogs.map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[160px_160px_1fr_180px]">
              <span className="font-semibold">{event.action}</span>
              <span className="text-edsync-subtle">{event.entity_type}</span>
              <span>{event.admin_email || "System"}</span>
              <span className="text-edsync-subtle">{new Date(event.created_at).toLocaleString()}</span>
            </div>
          ))}
          {payload.auditLogs.length === 0 && <p className="p-4 text-sm text-edsync-subtle">No admin audit records yet.</p>}
        </div>
      </section>
    </div>
  );
}
