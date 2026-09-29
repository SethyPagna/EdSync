"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Sparkles, Trash2, Workflow } from "lucide-react";
import type { AutomationRule } from "@/types";
import { AUTOMATION_RECIPES, AUTOMATION_TRIGGER_LABELS } from "@/lib/automation/rules";
import { Button, EmptyState, PageHeader, Sheet } from "@/components/ui";

type RuleDraft = {
  title: string;
  triggerKey: string;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
};

const defaultRecipe = AUTOMATION_RECIPES[0];

function fromRecipe(recipe: (typeof AUTOMATION_RECIPES)[number]): RuleDraft {
  return { title: recipe.title, triggerKey: recipe.triggerKey, conditions: { ...recipe.conditions }, actions: simplifyActions(recipe.actions), enabled: false };
}

function fromRule(rule: AutomationRule): RuleDraft {
  return { title: rule.title, triggerKey: rule.trigger_key, conditions: { ...(rule.conditions ?? {}) }, actions: simplifyActions(rule.actions ?? []), enabled: Boolean(rule.enabled) };
}

function simplifyActions(actions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let notified = false;
  return actions.flatMap((action) => {
    if (action.type !== "notify") return [{ ...action }];
    if (notified) return [];
    notified = true;
    return [{ type: "notify", channel: "in_app" }];
  });
}

function conditionSummary(trigger: string, conditions: Record<string, unknown>) {
  if (trigger === "learner.inactive") return `${conditions.inactiveDays ?? 5} inactive days`;
  if (trigger === "score.mastery") return `Score ≥ ${conditions.scoreGte ?? 90}%`;
  if (trigger === "deadline.upcoming") return `${conditions.hoursBeforeDue ?? 24} hours before due`;
  if (trigger === "certification.expiring") return `${conditions.daysBeforeExpiry ?? 30} days before expiry`;
  if (trigger === "work.submitted") return conditions.needsReview ? "Needs review" : "Any submission";
  return "Configured";
}

function ConditionControls({ draft, onChange }: { draft: RuleDraft; onChange: (next: RuleDraft) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...draft, conditions: { ...draft.conditions, [key]: value } });
  const number = (key: string, label: string, suffix: string, fallback: number, max: number) => (
    <label className="block space-y-1 text-sm font-medium text-fg"><span>{label}</span><div className="flex items-center gap-2"><input className="edsync-input w-28" type="number" min="1" max={max} value={Number(draft.conditions[key] ?? fallback)} onChange={(event) => set(key, Number(event.target.value))} required /><span className="text-fg-muted">{suffix}</span></div></label>
  );
  if (draft.triggerKey === "learner.inactive") return number("inactiveDays", "No activity for", "days", 5, 365);
  if (draft.triggerKey === "score.mastery") return <label className="block space-y-1 text-sm font-medium text-fg"><span>Minimum score</span><div className="flex items-center gap-2"><input className="edsync-input w-28" type="number" min="0" max="100" value={Number(draft.conditions.scoreGte ?? 90)} onChange={(event) => set("scoreGte", Number(event.target.value))} required /><span className="text-fg-muted">%</span></div></label>;
  if (draft.triggerKey === "deadline.upcoming") return number("hoursBeforeDue", "Before deadline", "hours", 24, 168);
  if (draft.triggerKey === "certification.expiring") return number("daysBeforeExpiry", "Before expiry", "days", 30, 365);
  if (draft.triggerKey === "work.submitted") {
    const selected = Array.isArray(draft.conditions.workTypes) ? draft.conditions.workTypes as string[] : [];
    return <div className="space-y-3"><fieldset className="space-y-2"><legend className="text-sm font-medium text-fg">Work types</legend><div className="flex flex-wrap gap-3">{["task", "discussion", "activity", "quiz", "test"].map((type) => <label key={type} className="flex items-center gap-1.5 text-sm capitalize text-fg-muted"><input type="checkbox" checked={selected.includes(type)} onChange={(event) => set("workTypes", event.target.checked ? [...selected, type] : selected.filter((item) => item !== type))} />{type}</label>)}</div></fieldset><label className="flex items-center gap-2 text-sm text-fg-muted"><input type="checkbox" checked={Boolean(draft.conditions.needsReview)} onChange={(event) => set("needsReview", event.target.checked)} />Only submissions needing review</label></div>;
  }
  return null;
}

function ActionControls({ draft, onChange }: { draft: RuleDraft; onChange: (next: RuleDraft) => void }) {
  const notify = draft.actions.some((action) => action.type === "notify");
  const badge = draft.actions.find((action) => action.type === "award_badge");
  const legacy = draft.actions.filter((action) => action.type !== "notify" && action.type !== "award_badge");
  const setNotify = (enabled: boolean) => onChange({ ...draft, actions: enabled ? [...draft.actions, { type: "notify", channel: "in_app" }] : draft.actions.filter((action) => action.type !== "notify") });
  const setBadge = (enabled: boolean) => onChange({ ...draft, actions: enabled ? [...draft.actions, { type: "award_badge", badge: "mastery" }] : draft.actions.filter((action) => action.type !== "award_badge") });
  return <div className="space-y-3">
    <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg"><input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />Send one in-app notification</label>
    {draft.triggerKey === "score.mastery" && <div className="rounded-lg border border-line bg-surface-2 p-3"><label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={Boolean(badge)} onChange={(event) => setBadge(event.target.checked)} />Award a mastery badge</label>{badge && <label className="mt-2 block text-xs text-fg-muted">Badge key<input className="edsync-input mt-1 w-full" value={String(badge.badge ?? "")} onChange={(event) => onChange({ ...draft, actions: draft.actions.map((action) => action === badge ? { ...action, badge: event.target.value } : action) })} placeholder="mastery" /></label>}</div>}
    {legacy.map((action, index) => <div key={index} className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger"><span className="flex-1">Unsupported legacy action: {String(action.type)}</span><button type="button" onClick={() => onChange({ ...draft, actions: draft.actions.filter((item) => item !== action) })} aria-label={`Remove ${String(action.type)} action`}><Trash2 size={16} /></button></div>)}
  </div>;
}

export default function AdminAutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [draft, setDraft] = useState<RuleDraft>(() => fromRecipe(defaultRecipe));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { const response = await fetch("/api/automation-rules", { cache: "no-store" }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Could not load automation rules."); setRules(payload.data?.rules ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load automation rules."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true); setError("");
    try { const response = await fetch("/api/automation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Rule could not be saved."); setNotice(success); await load(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Rule could not be saved."); return false; }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.actions.length === 0) { setError("Add at least one action."); return; }
    if (draft.triggerKey === "work.submitted" && (!Array.isArray(draft.conditions.workTypes) || draft.conditions.workTypes.length === 0)) { setError("Choose at least one work type."); return; }
    if (draft.actions.some((action) => !["notify", "award_badge"].includes(String(action.type)))) { setError("Replace unsupported legacy actions before saving."); return; }
    const ok = await run({ action: editingId ? "update" : "create", ...(editingId ? { id: editingId } : {}), ...draft }, editingId ? "Rule saved." : "Rule created.");
    if (ok) setOpen(false);
  };
  const changeTrigger = (triggerKey: string) => {
    const recipe = AUTOMATION_RECIPES.find((item) => item.triggerKey === triggerKey);
    const actions = triggerKey === "score.mastery" ? draft.actions : draft.actions.filter((action) => action.type !== "award_badge");
    setDraft({ ...draft, triggerKey, conditions: recipe ? { ...recipe.conditions } : {}, actions: actions.length ? actions : [{ type: "notify", channel: "in_app" }] });
  };
  const create = (recipe = defaultRecipe) => { setEditingId(null); setDraft(fromRecipe(recipe)); setError(""); setOpen(true); };
  const edit = (rule: AutomationRule) => { setEditingId(rule.id); setDraft(fromRule(rule)); setError(""); setOpen(true); };
  const remove = async (rule: AutomationRule) => { if (!window.confirm(`Delete “${rule.title}”?`)) return; await run({ action: "delete", id: rule.id }, "Rule deleted."); };

  return <div className="page-shell space-y-4">
    <PageHeader title="Automation" icon={Workflow} count={rules.length} actions={<Button variant="primary" onClick={() => create()}><Plus size={16} /> New rule</Button>} />
    <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Enabled rules run hourly. They can send in-app notifications; mastery rules can also award badges.</div>
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Start from a recipe</span>{AUTOMATION_RECIPES.map((recipe) => <button key={recipe.id} type="button" onClick={() => create(recipe)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-accent hover:text-fg">{recipe.title}</button>)}</div>
    <div className="card divide-y divide-line overflow-hidden">
      {rules.map((rule) => (
        <div key={rule.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex sm:flex-nowrap sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Sparkles size={17} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{rule.title}</p>
            <p className="line-clamp-2 text-xs text-fg-muted sm:truncate">{AUTOMATION_TRIGGER_LABELS[rule.trigger_key] ?? rule.trigger_key} · {conditionSummary(rule.trigger_key, rule.conditions ?? {})} · {rule.actions.length} action{rule.actions.length === 1 ? "" : "s"}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${rule.enabled ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted"}`}>{rule.enabled ? "Enabled" : "Paused"}</span>
          <div className="col-span-2 col-start-2 flex items-center justify-end gap-1 sm:ml-auto">
            <button type="button" className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2" onClick={() => edit(rule)}>Edit</button>
            <button type="button" className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2" disabled={busy} onClick={() => void run({ action: "toggle", id: rule.id, enabled: !rule.enabled }, rule.enabled ? "Rule paused." : "Rule enabled.")}>{rule.enabled ? "Pause" : "Enable"}</button>
            <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-soft hover:text-danger" disabled={busy} onClick={() => void remove(rule)} aria-label={`Delete ${rule.title}`}><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
      {rules.length === 0 && <EmptyState icon={Workflow} title="No rules yet" hint="Use a recipe or create a rule to prepare automation." compact />}
    </div>
    <Sheet open={open} onClose={() => setOpen(false)} title={editingId ? "Edit automation rule" : "New automation rule"} description="Choose when it applies and what it should do." size="lg" onSubmit={save} footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save rule"}</Button></>}><div className="space-y-5">{error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}<label className="block space-y-1 text-sm font-medium text-fg">Rule name<input className="edsync-input w-full" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={140} required /></label><label className="block space-y-1 text-sm font-medium text-fg">When this happens<select className="edsync-input w-full" value={draft.triggerKey} onChange={(event) => changeTrigger(event.target.value)}>{Object.entries(AUTOMATION_TRIGGER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><section className="space-y-2 border-t border-line pt-4"><h3 className="text-sm font-semibold text-fg">Conditions</h3><ConditionControls draft={draft} onChange={setDraft} /></section><section className="space-y-2 border-t border-line pt-4"><h3 className="text-sm font-semibold text-fg">Actions</h3><ActionControls draft={draft} onChange={setDraft} /></section><label className="flex items-center gap-2 border-t border-line pt-4 text-sm text-fg"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Mark as enabled</label></div></Sheet>
  </div>;
}
