"use client";

import { useEffect, useState } from "react";

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
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Compliance</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Certifications</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Create renewal rules and audit-ready certification records.</p>
      </div>
      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-4">
        <input className="edsync-input md:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Certification title" required />
        <input className="edsync-input" type="number" value={form.expiresAfterDays} onChange={(event) => setForm({ ...form, expiresAfterDays: Number(event.target.value) })} />
        <button className="btn-primary" type="submit">Create rule</button>
      </form>
      <div className="edsync-card overflow-hidden">
        {(payload?.rules ?? []).map((rule: any) => (
          <div key={rule.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_140px_140px]">
            <span className="font-semibold">{rule.title}</span>
            <span>{rule.expires_after_days || "No expiry"} days</span>
            <span>Notify {rule.notify_before_days} days</span>
          </div>
        ))}
      </div>
    </div>
  );
}
