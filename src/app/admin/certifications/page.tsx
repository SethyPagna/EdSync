"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BellRing } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

export default function AdminCertificationsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState({ title: "", expiresAfterDays: 365, notifyBeforeDays: 30 });
  const load = () => fetch("/api/certifications").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ title: "", expiresAfterDays: 365, notifyBeforeDays: 30 });
    load();
  };

  return (
    <div className="page-shell space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Compliance</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Certifications</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Define renewal rules for required training so learners, teachers, and managers know what expires and when to act.
          </p>
        </div>
        <GuidePanel
          title="How certification rules work"
          description="A rule defines the validity window and reminder timing. Completion records can be audited later without changing the original learning evidence."
          icon={BadgeCheck}
          items={[
            "Use 365 days for annual compliance refreshers.",
            "Use 30-day reminders for manager-visible renewal queues.",
            "Keep final certification approval teacher or admin controlled.",
          ]}
          tone="text-edsync-emerald"
        />
      </div>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
        <input className="edsync-input md:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Certification title" required />
        <input className="edsync-input" type="number" value={form.expiresAfterDays} onChange={(event) => setForm({ ...form, expiresAfterDays: Number(event.target.value) })} aria-label="Expires after days" />
        <input className="edsync-input" type="number" value={form.notifyBeforeDays} onChange={(event) => setForm({ ...form, notifyBeforeDays: Number(event.target.value) })} aria-label="Notify before days" />
        <button className="btn-primary justify-center" type="submit">Create rule</button>
      </form>

      <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
        <div className="flex gap-3">
          <BellRing className="h-5 w-5 flex-shrink-0 text-edsync-amber" />
          <p className="text-sm leading-6 text-edsync-subtle">
            Reminder timing should match the consequence of expiry: short windows for low-risk skill refreshers, longer windows for legal, safety, or licensing requirements.
          </p>
        </div>
      </div>

      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Certification rules</h2>
          <p className="text-sm text-edsync-subtle">Rules are reusable across courses, portals, and tenant programs.</p>
        </div>
        {(payload?.rules ?? []).map((rule: any) => (
          <div key={rule.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_140px_140px]">
            <span className="font-semibold">{rule.title}</span>
            <span>{rule.expires_after_days || "No expiry"} days</span>
            <span>Notify {rule.notify_before_days} days</span>
          </div>
        ))}
        {(payload?.rules ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No certification rules yet.</p>
        )}
      </div>
    </div>
  );
}
