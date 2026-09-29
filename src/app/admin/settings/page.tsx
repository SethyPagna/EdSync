"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Settings2, Trash2 } from "lucide-react";
import { Button, PageHeader, Sheet, useConfirm } from "@/components/ui";

type Flag = { id: string; flag_key: string; label: string; description: string | null; enabled: number | boolean; audience?: "all" | "admin" | "teacher" | "student" };
type FlagDraft = { flagKey: string; label: string; description: string; enabled: boolean; audience: "all" | "admin" | "teacher" | "student" };
const emptyFlag: FlagDraft = { flagKey: "", label: "", description: "", enabled: true, audience: "all" };
const links = [{ href: "/admin/ai", label: "AI providers" }, { href: "/admin/security", label: "Security" }, { href: "/admin/permissions", label: "Permissions" }, { href: "/admin/governance", label: "Governance" }, { href: "/admin/billing", label: "Catalog" }, { href: "/admin/portals", label: "Organizations" }];

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [emailMode, setEmailMode] = useState("outbox");
  const [draft, setDraft] = useState<FlagDraft>(emptyFlag);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async () => { try { const response = await fetch("/api/admin/settings", { cache: "no-store" }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Could not load settings."); setFlags(payload.data?.flags ?? []); setEmailMode(payload.data?.emailMode ?? "outbox"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load settings."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const run = async (method: "POST" | "PATCH", body: Record<string, unknown>, success: string) => {
    setBusy(true); setError("");
    try { const response = await fetch("/api/admin/settings", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Setting could not be saved."); setNotice(success); await load(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Setting could not be saved."); return false; }
    finally { setBusy(false); }
  };
  const edit = (flag: Flag) => { setDraft({ flagKey: flag.flag_key, label: flag.label, description: flag.description ?? "", enabled: Boolean(flag.enabled), audience: flag.audience ?? "all" }); setEditingId(flag.id); setOpen(true); };
  const create = () => { setDraft(emptyFlag); setEditingId(null); setOpen(true); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const ok = await run("POST", { action: editingId ? "update_flag" : "create_flag", ...(editingId ? { id: editingId } : {}), ...draft }, editingId ? "Flag saved." : "Flag created."); if (ok) setOpen(false); };
  const remove = async (flag: Flag) => { if (!await confirm({ title: `Delete ${flag.label}?`, body: "This flag will be removed from the platform.", confirmLabel: "Delete flag", danger: true })) return; await run("POST", { action: "delete_flag", id: flag.id }, "Flag deleted."); };

  return <div className="page-shell space-y-4"><PageHeader title="Settings" icon={Settings2} actions={<Button variant="primary" onClick={create}><Plus size={16} /> New flag</Button>} />
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-muted">Email mode: {emailMode}</span>{links.map((item) => <Link key={item.href} href={item.href} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg">{item.label}<ArrowRight size={12} /></Link>)}</div>
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <section className="card divide-y divide-line overflow-hidden"><div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-semibold text-fg">Feature flags</h2><span className="text-xs text-fg-faint">{flags.length} flags</span></div>{flags.map((flag) => <div key={flag.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{flag.label}</p><p className="truncate text-xs text-fg-muted">{flag.flag_key} · {flag.audience ?? "all"}{flag.description ? ` · ${flag.description}` : ""}</p></div><button type="button" role="switch" aria-checked={Boolean(flag.enabled)} aria-label={`${flag.label} enabled`} disabled={busy} className={`rounded-full px-3 py-1 text-xs font-semibold ${flag.enabled ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted"}`} onClick={() => void run("PATCH", { flagKey: flag.flag_key, enabled: !flag.enabled }, "Flag updated.")}>{flag.enabled ? "On" : "Off"}</button><button type="button" className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2" onClick={() => edit(flag)}>Edit</button><button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-soft hover:text-danger" onClick={() => void remove(flag)} aria-label={`Delete ${flag.label}`}><Trash2 size={16} /></button></div>)}{flags.length === 0 && <p className="px-4 py-8 text-center text-sm text-fg-muted">No feature flags yet.</p>}</section>
    <Sheet open={open} onClose={() => setOpen(false)} title={editingId ? "Edit feature flag" : "New feature flag"} onSubmit={save} footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save flag"}</Button></>}><div className="space-y-4">{error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}<label className="block space-y-1 text-sm font-medium text-fg">Key<input className="edsync-input w-full" value={draft.flagKey} onChange={(event) => setDraft({ ...draft, flagKey: event.target.value })} placeholder="feature_name" required /></label><label className="block space-y-1 text-sm font-medium text-fg">Label<input className="edsync-input w-full" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} required /></label><label className="block space-y-1 text-sm font-medium text-fg">Description<textarea className="edsync-input min-h-20 w-full" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className="block space-y-1 text-sm font-medium text-fg">Audience<select className="edsync-input w-full" value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as FlagDraft["audience"] })}><option value="all">Everyone</option><option value="admin">Admins</option><option value="teacher">Creators</option><option value="student">Learners</option></select></label><label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Enabled</label></div></Sheet>
  </div>;
}
