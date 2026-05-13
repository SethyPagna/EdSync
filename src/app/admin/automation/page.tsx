"use client";

import { useEffect, useState } from "react";
import { BellRing, LockKeyhole, Sparkles, Trophy } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

const automationRecipes = [
  {
    title: "Nudge",
    trigger: "learner.inactive",
    icon: BellRing,
    detail: "Send a reminder after a period of inactivity.",
  },
  {
    title: "Unlock",
    trigger: "score.mastery",
    icon: LockKeyhole,
    detail: "Reveal optional work after high performance.",
  },
  {
    title: "Award",
    trigger: "badge.earned",
    icon: Trophy,
    detail: "Recognize progress without changing grades.",
  },
];

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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Intelligent agents</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Automation Rules</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Use rules to handle predictable follow-up while keeping grading, publishing, and sensitive decisions human-controlled.
          </p>
        </div>
        <GuidePanel
          title="Rule recipe"
          description="Each automation has a trigger, optional conditions, and one or more actions. Start with notifications before unlocking content or awarding badges."
          icon={Sparkles}
          items={[
            "If learner inactive, send a gentle in-app nudge.",
            "If score is above 90%, award mastery and unlock optional work.",
            "If certification expires soon, notify learner and manager.",
          ]}
          tone="text-edsync-amber"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {automationRecipes.map(({ title, trigger, icon: Icon, detail }) => (
          <div key={title} className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
            <Icon className="mb-3 h-6 w-6 text-edsync-blue" />
            <p className="font-semibold text-edsync-text">{title}</p>
            <p className="mt-1 font-mono text-xs text-edsync-subtle">{trigger}</p>
            <p className="mt-2 text-sm leading-5 text-edsync-subtle">{detail}</p>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-3">
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Rule title" required />
        <input className="edsync-input" value={form.triggerKey} onChange={(event) => setForm({ ...form, triggerKey: event.target.value })} placeholder="trigger.key" required />
        <button className="btn-primary" type="submit">Create rule</button>
        <textarea className="edsync-input min-h-24 md:col-span-3" value={form.actionsText} onChange={(event) => setForm({ ...form, actionsText: event.target.value })} />
      </form>
      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Active automations</h2>
          <p className="text-sm text-edsync-subtle">Rules run asynchronously so dashboards and grading stay fast.</p>
        </div>
        {(payload?.rules ?? []).map((rule: any) => (
          <div key={rule.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_180px_100px]">
            <span className="font-semibold">{rule.title}</span>
            <span className="text-edsync-subtle">{rule.trigger_key}</span>
            <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{rule.enabled ? "Enabled" : "Paused"}</span>
          </div>
        ))}
        {(payload?.rules ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No automation rules yet.</p>
        )}
      </div>
    </div>
  );
}
