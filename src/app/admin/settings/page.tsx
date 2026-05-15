"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Brain, CreditCard, Edit3, LockKeyhole, Save, ShieldCheck, SlidersHorizontal, Trash2, UsersRound, X } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";

type Flag = {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: number | boolean;
  audience?: "all" | "admin" | "teacher" | "student";
};

type FlagDraft = {
  flagKey: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: "all" | "admin" | "teacher" | "student";
};

const emptyFlag: FlagDraft = {
  flagKey: "",
  label: "",
  description: "",
  enabled: true,
  audience: "all",
};

const operationLinks = [
  { href: "/admin/ai", label: "AI providers", detail: "Keys, health, fallback.", icon: Brain },
  { href: "/admin/governance", label: "Governance", detail: "Rules and audits.", icon: ShieldCheck },
  { href: "/admin/permissions", label: "Permissions", detail: "Role profiles.", icon: UsersRound },
  { href: "/admin/security", label: "Security", detail: "Events and logs.", icon: LockKeyhole },
  { href: "/admin/billing", label: "Catalog", detail: "Products and prices.", icon: CreditCard },
  { href: "/admin/portals", label: "Organizations", detail: "Portals and domains.", icon: SlidersHorizontal },
];

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [emailMode, setEmailMode] = useState("outbox");
  const [flagDraft, setFlagDraft] = useState<FlagDraft>(emptyFlag);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FlagDraft>(emptyFlag);

  const load = () => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setFlags(payload.data?.flags ?? []);
        setEmailMode(payload.data?.emailMode ?? "outbox");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (flagKey: string, enabled: boolean) => {
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagKey, enabled }),
    });
    toast.success("Setting updated.");
    load();
  };

  const saveFlag = async (body: Record<string, unknown>, success: string) => {
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      toast.error(payload.error || "Setting could not be saved.");
      return false;
    }
    toast.success(success);
    load();
    return true;
  };

  const createFlag = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await saveFlag({ action: "create_flag", ...flagDraft }, "Feature flag created.");
    if (ok) setFlagDraft(emptyFlag);
  };

  const startEdit = (flag: Flag) => {
    setEditingId(flag.id);
    setEditDraft({
      flagKey: flag.flag_key,
      label: flag.label,
      description: flag.description ?? "",
      enabled: Boolean(flag.enabled),
      audience: flag.audience ?? "all",
    });
  };

  const updateFlag = async (flag: Flag) => {
    const ok = await saveFlag({ action: "update_flag", id: flag.id, ...editDraft }, "Feature flag saved.");
    if (ok) setEditingId(null);
  };

  const deleteFlag = async (flag: Flag) => {
    if (!window.confirm(`Delete "${flag.label}"?`)) return;
    await saveFlag({ action: "delete_flag", id: flag.id }, "Feature flag deleted.");
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">System</p>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2 text-sm font-semibold capitalize text-edsync-text">
            Email: {emailMode}
          </span>
          <InfoPopover label="Settings help">
            Feature flags, AI providers, security, governance, catalog, and organization controls live here.
          </InfoPopover>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operationLinks.map(({ href, label, detail, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-lg border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40 hover:shadow-card-hover">
            <Icon className="mb-3 h-6 w-6 text-edsync-blue" />
            <p className="font-semibold text-edsync-text">{label}</p>
            <p className="mt-1 text-sm leading-5 text-edsync-subtle">{detail}</p>
          </Link>
        ))}
      </section>

      <section className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Feature flags</h2>
        </div>
        <form onSubmit={createFlag} className="grid gap-3 border-b border-edsync-border p-4 lg:grid-cols-[180px_220px_minmax(0,1fr)_140px_120px]">
          <input className="edsync-input" value={flagDraft.flagKey} onChange={(event) => setFlagDraft({ ...flagDraft, flagKey: event.target.value })} placeholder="flag_key" required />
          <input className="edsync-input" value={flagDraft.label} onChange={(event) => setFlagDraft({ ...flagDraft, label: event.target.value })} placeholder="Label" required />
          <input className="edsync-input" value={flagDraft.description} onChange={(event) => setFlagDraft({ ...flagDraft, description: event.target.value })} placeholder="Description" />
          <select className="edsync-input" value={flagDraft.audience} onChange={(event) => setFlagDraft({ ...flagDraft, audience: event.target.value as FlagDraft["audience"] })}>
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
          <button className="btn-primary justify-center" type="submit">Add flag</button>
        </form>
        <div className="divide-y divide-edsync-border">
          {flags.map((flag) => (
            <div key={flag.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
              {editingId === flag.id ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="edsync-input" value={editDraft.flagKey} onChange={(event) => setEditDraft({ ...editDraft, flagKey: event.target.value })} />
                  <input className="edsync-input" value={editDraft.label} onChange={(event) => setEditDraft({ ...editDraft, label: event.target.value })} />
                  <input className="edsync-input" value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} />
                  <select className="edsync-input" value={editDraft.audience} onChange={(event) => setEditDraft({ ...editDraft, audience: event.target.value as FlagDraft["audience"] })}>
                    <option value="all">All</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>
              ) : (
                <div>
                  <p className="font-semibold">{flag.label}</p>
                  <p className="text-sm text-edsync-subtle">{flag.description}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-edsync-subtle">{flag.flag_key} / {flag.audience ?? "all"}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 md:justify-end">
                {editingId === flag.id ? (
                  <>
                    <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => updateFlag(flag)}><Save className="h-4 w-4" /> Save</button>
                    <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => toggle(flag.flag_key, !flag.enabled)} className={flag.enabled ? "btn-primary px-3 py-2 text-sm" : "btn-secondary px-3 py-2 text-sm"}>
                      {flag.enabled ? "On" : "Off"}
                    </button>
                    <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startEdit(flag)}><Edit3 className="h-4 w-4" /> Edit</button>
                    <button type="button" className="btn-ghost px-3 py-2 text-sm text-rose-600" onClick={() => deleteFlag(flag)}><Trash2 className="h-4 w-4" /> Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {flags.length === 0 && <p className="px-4 py-5 text-sm text-edsync-subtle">No feature flags loaded yet.</p>}
        </div>
      </section>
    </div>
  );
}
