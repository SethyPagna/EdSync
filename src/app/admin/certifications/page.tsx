"use client";

import { useEffect, useState } from "react";
import { Edit3, Save, Trash2, X } from "lucide-react";
import type { CertificationRule } from "@/types";
import { InfoPopover } from "@/components/WorkspacePrimitives";

type CertificationsPayload = {
  rules: CertificationRule[];
};

type RuleDraft = {
  title: string;
  description: string;
  expiresAfterDays: number;
  notifyBeforeDays: number;
};

const emptyRule: RuleDraft = {
  title: "",
  description: "",
  expiresAfterDays: 365,
  notifyBeforeDays: 30,
};

function draftFrom(rule: CertificationRule): RuleDraft {
  return {
    title: rule.title,
    description: rule.description ?? "",
    expiresAfterDays: rule.expires_after_days ?? 365,
    notifyBeforeDays: rule.notify_before_days ?? 30,
  };
}

export default function AdminCertificationsPage() {
  const [payload, setPayload] = useState<CertificationsPayload>({ rules: [] });
  const [form, setForm] = useState<RuleDraft>(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(emptyRule);
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/certifications", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: CertificationsPayload }) => setPayload(json.data ?? { rules: [] }));

  useEffect(() => {
    load();
  }, []);

  const run = async (body: Record<string, unknown>, success: string) => {
    setMessage("");
    const response = await fetch("/api/certifications", {
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
    const ok = await run({ action: "create", ...form }, "Certification rule created.");
    if (ok) setForm(emptyRule);
  };

  const save = async (rule: CertificationRule) => {
    const ok = await run({ action: "update", id: rule.id, ...draft }, "Certification rule saved.");
    if (ok) setEditingId(null);
  };

  const remove = async (rule: CertificationRule) => {
    if (!window.confirm(`Delete "${rule.title}"?`)) return;
    await run({ action: "delete", id: rule.id }, "Certification rule deleted.");
  };

  return (
    <div className="page-shell space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Governance</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Certifications</h1>
        </div>
        <InfoPopover label="Certification help">
          Use expiry days for renewal cadence and notify days for reminder timing. Keep legal or safety programs longer.
        </InfoPopover>
      </header>

      {message && <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">{message}</div>}

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Certification title" required />
        <input className="edsync-input" type="number" min="0" value={form.expiresAfterDays} onChange={(event) => setForm({ ...form, expiresAfterDays: Number(event.target.value) })} aria-label="Expires after days" />
        <input className="edsync-input" type="number" min="0" value={form.notifyBeforeDays} onChange={(event) => setForm({ ...form, notifyBeforeDays: Number(event.target.value) })} aria-label="Notify before days" />
        <button className="btn-primary justify-center" type="submit">Create rule</button>
        <textarea className="edsync-input lg:col-span-4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Rule purpose and audit notes" />
      </form>

      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Certification rules</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.rules.map((rule) => {
            const editing = editingId === rule.id;
            return (
              <section key={rule.id} className="grid gap-3 px-4 py-4 text-sm">
                {editing ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
                    <input className="edsync-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                    <input className="edsync-input" type="number" min="0" value={draft.expiresAfterDays} onChange={(event) => setDraft({ ...draft, expiresAfterDays: Number(event.target.value) })} />
                    <input className="edsync-input" type="number" min="0" value={draft.notifyBeforeDays} onChange={(event) => setDraft({ ...draft, notifyBeforeDays: Number(event.target.value) })} />
                    <textarea className="edsync-input lg:col-span-3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                  </div>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_160px] lg:items-center">
                    <div>
                      <p className="font-semibold text-edsync-text">{rule.title}</p>
                      <p className="mt-1 text-edsync-subtle">{rule.description || "No description yet."}</p>
                    </div>
                    <span>{rule.expires_after_days || "No expiry"} days</span>
                    <span>Notify {rule.notify_before_days} days</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => save(rule)}><Save className="h-4 w-4" /> Save</button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => { setEditingId(rule.id); setDraft(draftFrom(rule)); }}><Edit3 className="h-4 w-4" /> Edit</button>
                      <button type="button" className="btn-ghost px-3 py-2 text-sm text-rose-600" onClick={() => remove(rule)}><Trash2 className="h-4 w-4" /> Delete</button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
          {payload.rules.length === 0 && <p className="px-4 py-5 text-sm text-edsync-subtle">No certification rules yet.</p>}
        </div>
      </div>
    </div>
  );
}
