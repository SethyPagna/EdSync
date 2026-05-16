"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";

type SecurityPayload = {
  securityEvents: Array<{ id: string; event_type: string; severity: string; message: string; created_at: string }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata?: Record<string, unknown> | string | null;
    admin_email: string | null;
    created_at: string;
  }>;
};

function metadataOf(value: SecurityPayload["auditLogs"][number]["metadata"]) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function auditTitle(event: SecurityPayload["auditLogs"][number]) {
  if (event.action === "open_view_mode") {
    return `Opened ${event.entity_id === "student" ? "Student" : "Teacher"} view`;
  }
  return event.action
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function auditDetail(event: SecurityPayload["auditLogs"][number]) {
  const metadata = metadataOf(event.metadata);
  const path = typeof metadata.path === "string" ? metadata.path : null;
  if (event.action === "open_view_mode") return path ? `Read-only preview: ${path}` : "Read-only preview";
  return event.entity_id ? `${event.entity_type}: ${event.entity_id}` : event.entity_type;
}

export default function AdminSecurityPage() {
  const [payload, setPayload] = useState<SecurityPayload>({ securityEvents: [], auditLogs: [] });

  useEffect(() => {
    fetch("/api/admin/security", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setPayload(data.data ?? { securityEvents: [], auditLogs: [] }));
  }, []);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Trust center</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Security</h1>
        </div>
        <InfoPopover label="Security help">
          Events are risk signals. Audit logs are owner actions. Review high severity and global admin grants first.
        </InfoPopover>
      </div>

      <section className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><AlertTriangle className="h-5 w-5 text-edsync-red" /> Security events</h2>
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
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.auditLogs.map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[220px_minmax(0,1fr)_180px_180px]">
              <span className="font-semibold">{auditTitle(event)}</span>
              <span className="min-w-0 truncate text-edsync-subtle">{auditDetail(event)}</span>
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
