"use client";

import { useEffect, useState } from "react";
import { Edit3, MoreVertical, Save, Sparkles, Trash2, X } from "lucide-react";
import type { AutomationRule } from "@/types";
import { ActionMenu, InfoPopover } from "@/components/WorkspacePrimitives";
import { AUTOMATION_RECIPES, AUTOMATION_TRIGGER_LABELS } from "@/lib/automation/rules";

type AutomationPayload = {
  rules: AutomationRule[];
};

type RuleDraft = {
  title: string;
  triggerKey: string;
  conditionsText: string;
  actionsText: string;
  enabled: boolean;
};

const emptyRule: RuleDraft = {
  title: "",
  triggerKey: AUTOMATION_RECIPES[0].triggerKey,
  conditionsText: '{"inactiveDays":5}',
  actionsText: '[{"type":"notify","channel":"in_app"}]',
  enabled: true,
};

const triggerOptions = Object.entries(AUTOMATION_TRIGGER_LABELS);

function draftFrom(rule: AutomationRule): RuleDraft {
  return {
    title: rule.title,
    triggerKey: rule.trigger_key,
    conditionsText: JSON.stringify(rule.conditions ?? {}, null, 2),
    actionsText: JSON.stringify(rule.actions ?? [], null, 2),
    enabled: Boolean(rule.enabled),
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function compactJson(value: unknown) {
  return JSON.stringify(value);
}

export default function AdminAutomationPage() {
  const [payload, setPayload] = useState<AutomationPayload>({ rules: [] });
  const [form, setForm] = useState<RuleDraft>(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(emptyRule);
  const [message, setMessage] = useState("");
  const [showJson, setShowJson] = useState(false);

  const load = () =>
    fetch("/api/automation-rules", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: AutomationPayload }) => setPayload(json.data ?? { rules: [] }));

  useEffect(() => {
    load();
  }, []);

  const bodyFrom = (source: RuleDraft) => ({
    title: source.title,
    triggerKey: source.triggerKey,
    conditions: parseJson<Record<string, unknown>>(source.conditionsText, {}),
    actions: parseJson<Array<Record<string, unknown>>>(source.actionsText, []),
    enabled: source.enabled,
  });

  const applyRecipe = (recipe: (typeof AUTOMATION_RECIPES)[number]) => {
    setForm({
      title: recipe.title,
      triggerKey: recipe.triggerKey,
      conditionsText: prettyJson(recipe.conditions),
      actionsText: prettyJson(recipe.actions),
      enabled: false,
    });
    setMessage("Recipe loaded as a paused draft.");
  };

  const run = async (body: Record<string, unknown>, success: string) => {
    setMessage("");
    const response = await fetch("/api/automation-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || json.error) {
      setMessage(json.error || "Request failed.");
      return false;
    }
    setMessage(success);
    load();
    return true;
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run({ action: "create", ...bodyFrom(form) }, "Automation rule created.");
    if (ok) setForm(emptyRule);
  };

  const save = async (rule: AutomationRule) => {
    const ok = await run({ action: "update", id: rule.id, ...bodyFrom(draft) }, "Automation rule saved.");
    if (ok) setEditingId(null);
  };

  const toggle = async (rule: AutomationRule) => {
    await run({ action: "toggle", id: rule.id, enabled: !rule.enabled }, rule.enabled ? "Automation paused." : "Automation enabled.");
  };

  const remove = async (rule: AutomationRule) => {
    if (!window.confirm(`Delete "${rule.title}"?`)) return;
    await run({ action: "delete", id: rule.id }, "Automation rule deleted.");
  };

  return (
    <div className="page-shell space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Governance</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Automation Rules</h1>
        </div>
        <InfoPopover label="Automation help">
          Start paused. Test notifications first. Enable unlocks, badges, and reminders after the tenant flow is confirmed.
        </InfoPopover>
      </header>

      {message && <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">{message}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {AUTOMATION_RECIPES.map((recipe) => (
          <button
            key={recipe.id}
            type="button"
            onClick={() => applyRecipe(recipe)}
            className="rounded-lg border border-edsync-border bg-edsync-card p-4 text-left transition hover:border-edsync-blue/50 hover:bg-edsync-surface"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-edsync-blue">
              {AUTOMATION_TRIGGER_LABELS[recipe.triggerKey]}
            </span>
            <span className="mt-2 block font-semibold text-edsync-text">{recipe.title}</span>
          </button>
        ))}
      </section>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_220px_140px_auto]">
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Rule title" required />
        <select className="edsync-input" value={form.triggerKey} onChange={(event) => setForm({ ...form, triggerKey: event.target.value })}>
          {triggerOptions.map(([triggerKey, label]) => (
            <option key={triggerKey} value={triggerKey}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-edsync-subtle">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          Enabled
        </label>
        <button className="btn-primary justify-center" type="submit">Create rule</button>
        <div className="lg:col-span-4">
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm"
            onClick={() => setShowJson((value) => !value)}
          >
            {showJson ? "Hide JSON" : "Edit conditions"}
          </button>
        </div>
        {showJson && (
          <>
            <textarea className="edsync-input min-h-24 lg:col-span-2" value={form.conditionsText} onChange={(event) => setForm({ ...form, conditionsText: event.target.value })} aria-label="Conditions JSON" />
            <textarea className="edsync-input min-h-24 lg:col-span-2" value={form.actionsText} onChange={(event) => setForm({ ...form, actionsText: event.target.value })} aria-label="Actions JSON" />
          </>
        )}
      </form>

      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Rules</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.rules.map((rule) => {
            const editing = editingId === rule.id;
            return (
              <section key={rule.id} className="grid gap-3 px-4 py-4 text-sm">
                {editing ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input className="edsync-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                    <input className="edsync-input" value={draft.triggerKey} onChange={(event) => setDraft({ ...draft, triggerKey: event.target.value })} />
                    <textarea className="edsync-input min-h-24" value={draft.conditionsText} onChange={(event) => setDraft({ ...draft, conditionsText: event.target.value })} />
                    <textarea className="edsync-input min-h-24" value={draft.actionsText} onChange={(event) => setDraft({ ...draft, actionsText: event.target.value })} />
                    <label className="flex items-center gap-2 text-sm text-edsync-subtle">
                      <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                      Enabled
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_200px_120px] lg:items-center">
                    <div>
                      <p className="font-semibold text-edsync-text">{rule.title}</p>
                      <p className="mt-1 text-xs text-edsync-subtle">{JSON.stringify(rule.conditions)}</p>
                    </div>
                    <span className="font-semibold text-xs text-edsync-subtle">{AUTOMATION_TRIGGER_LABELS[rule.trigger_key] ?? rule.trigger_key}</span>
                    <span className={`badge ${rule.enabled ? "bg-edsync-emerald/10 text-edsync-emerald" : "bg-slate-100 text-slate-500"}`}>
                      {rule.enabled ? "Enabled" : "Paused"}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  {editing ? (
                    <>
                      <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => save(rule)}><Save className="h-4 w-4" /> Save</button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</button>
                    </>
                  ) : (
                    <ActionMenu label={`${rule.title} actions`}>
                      <button type="button" className="btn-secondary justify-start px-3 py-2 text-sm" onClick={() => { setEditingId(rule.id); setDraft(draftFrom(rule)); }}><Edit3 className="h-4 w-4" /> Edit</button>
                      <button type="button" className="btn-secondary justify-start px-3 py-2 text-sm" onClick={() => toggle(rule)}>{rule.enabled ? "Pause" : "Enable"}</button>
                      <button type="button" className="btn-ghost justify-start px-3 py-2 text-sm text-rose-600" onClick={() => remove(rule)}><Trash2 className="h-4 w-4" /> Delete</button>
                    </ActionMenu>
                  )}
                </div>
                {!editing && (
                  <details className="rounded-lg border border-edsync-border bg-edsync-surface">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-edsync-subtle">
                      <MoreVertical className="h-3.5 w-3.5" />
                      Rule payload
                    </summary>
                    <pre className="overflow-auto border-t border-edsync-border p-3 text-xs text-edsync-subtle">{compactJson({ conditions: rule.conditions, actions: rule.actions })}</pre>
                  </details>
                )}
              </section>
            );
          })}
          {payload.rules.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-edsync-subtle">
              <Sparkles className="mx-auto mb-3 h-8 w-8" />
              Loading starter automation recipes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
