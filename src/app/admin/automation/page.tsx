"use client";

import { useEffect, useState } from "react";

export default function AdminAutomationPage() {
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState({ title: "", triggerKey: "learner.inactive", actionsText: '[{"type":"notify","channel":"in_app"}]' });
  const load = () => fetch("/api/automation-rules").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    let actions: Array<Record<string, unknown>> = [];
    try {
      actions = JSON.parse(form.actionsText);
    } catch {
      actions = [];
    }
    await fetch("/api/automation-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, triggerKey: form.triggerKey, actions }),
    });
    setForm({ title: "", triggerKey: "learner.inactive", actionsText: '[{"type":"notify","channel":"in_app"}]' });
    load();
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Intelligent agents</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Automation Rules</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Build if-this-then-that learning nudges, unlocks, awards, and reminders.</p>
      </div>
      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-3">
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Rule title" required />
        <input className="edsync-input" value={form.triggerKey} onChange={(event) => setForm({ ...form, triggerKey: event.target.value })} placeholder="trigger.key" required />
        <button className="btn-primary" type="submit">Create rule</button>
        <textarea className="edsync-input min-h-24 md:col-span-3" value={form.actionsText} onChange={(event) => setForm({ ...form, actionsText: event.target.value })} />
      </form>
      <div className="edsync-card overflow-hidden">
        {(payload?.rules ?? []).map((rule: any) => (
          <div key={rule.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_180px_100px]">
            <span className="font-semibold">{rule.title}</span>
            <span className="text-edsync-subtle">{rule.trigger_key}</span>
            <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{rule.enabled ? "Enabled" : "Paused"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
