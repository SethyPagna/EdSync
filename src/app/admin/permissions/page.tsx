"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { Permission, RoleProfile } from "@/types";
import { Button, PageHeader, Sheet, useConfirm } from "@/components/ui";

type Payload = { catalog: Permission[]; roleProfiles: RoleProfile[]; granted: string[] };
type Draft = { label: string; description: string; permissions: string[] };
const emptyDraft: Draft = { label: "", description: "", permissions: [] };

export default function AdminPermissionsPage() {
  const [payload, setPayload] = useState<Payload>({ catalog: [], roleProfiles: [], granted: [] });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async () => { try { const response = await fetch("/api/permissions", { cache: "no-store" }); const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || "Could not load permissions."); setPayload(result.data ?? { catalog: [], roleProfiles: [], granted: [] }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load permissions."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const grouped = useMemo(() => Object.entries(payload.catalog.reduce<Record<string, Permission[]>>((groups, permission) => { const key = permission.category || "General"; (groups[key] ??= []).push(permission); return groups; }, {})), [payload.catalog]);
  const editable = payload.roleProfiles.filter((profile) => !profile.is_system);

  const run = async (body: Record<string, unknown>, success: string) => { setBusy(true); setError(""); try { const response = await fetch("/api/permissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error || "Could not save profile."); setNotice(success); await load(); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save profile."); return false; } finally { setBusy(false); } };
  const create = () => { setEditingId(null); setDraft(emptyDraft); setOpen(true); };
  const edit = (profile: RoleProfile) => { setEditingId(profile.id); setDraft({ label: profile.label, description: profile.description ?? "", permissions: [...(profile.permissions ?? [])] }); setOpen(true); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const ok = await run({ action: editingId ? "update_profile" : "create_profile", ...(editingId ? { id: editingId } : {}), ...draft }, editingId ? "Profile saved." : "Profile created."); if (ok) setOpen(false); };
  const remove = async (profile: RoleProfile) => { if (!await confirm({ title: `Delete ${profile.label}?`, body: "Members assigned to this profile will lose that assignment.", confirmLabel: "Delete profile", danger: true })) return; await run({ action: "delete_profile", id: profile.id }, "Profile deleted."); };
  const toggle = (key: string) => setDraft((current) => ({ ...current, permissions: current.permissions.includes(key) ? current.permissions.filter((item) => item !== key) : [...current.permissions, key] }));

  return <div className="page-shell space-y-4"><PageHeader title="Permissions" icon={ShieldCheck} actions={<Button variant="primary" onClick={create}><Plus size={16} /> New role</Button>} />
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Organization roles</h2><span className="text-xs text-fg-faint">System roles are read only</span></div><div className="divide-y divide-line">{editable.map((profile) => <div key={profile.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{profile.label}</p><p className="truncate text-xs text-fg-muted">{profile.description || "Organization role"}</p></div><span className="shrink-0 text-xs tabular-nums text-fg-muted">{profile.permissions?.length ?? 0} permissions</span><button type="button" className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2" onClick={() => edit(profile)}>Edit</button><button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-soft hover:text-danger" onClick={() => void remove(profile)} aria-label={`Delete ${profile.label}`}><Trash2 size={16} /></button></div>)}{editable.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-muted">No organization roles yet.</p>}</div></section>
    <section className="card overflow-hidden"><div className="border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Permission matrix</h2><p className="text-xs text-fg-muted">Compare permissions across system and organization roles.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="sticky top-0 bg-surface-2"><tr><th className="min-w-[210px] px-3 py-2 font-semibold text-fg-muted">Permission</th>{payload.roleProfiles.map((profile) => <th key={profile.id} className="min-w-[90px] px-2 py-2 text-center font-semibold text-fg-muted">{profile.label}</th>)}</tr></thead><tbody>{grouped.map(([category, permissions]) => <FragmentRows key={category} category={category} permissions={permissions} profiles={payload.roleProfiles} />)}</tbody></table>{payload.catalog.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-muted">No permission catalog loaded.</p>}</div></section>
    <Sheet open={open} onClose={() => setOpen(false)} title={editingId ? "Edit role profile" : "New role profile"} description="Permissions apply only within this organization." size="lg" onSubmit={save} footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save role"}</Button></>}><div className="space-y-4">{error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}<label className="block space-y-1 text-sm font-medium text-fg">Role name<input className="edsync-input w-full" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} maxLength={120} required /></label><label className="block space-y-1 text-sm font-medium text-fg">Description<textarea className="edsync-input min-h-20 w-full" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={600} /></label><div className="space-y-3">{grouped.map(([category, permissions]) => <fieldset key={category} className="rounded-lg border border-line p-3"><legend className="px-1 text-sm font-semibold text-fg">{category}</legend><div className="grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.id} className="flex items-start gap-2 text-sm text-fg-muted"><input type="checkbox" className="mt-1" checked={draft.permissions.includes(permission.permission_key)} onChange={() => toggle(permission.permission_key)} /><span><span className="block font-medium text-fg">{permission.label}</span><span className="block text-xs text-fg-faint">{permission.permission_key}</span></span></label>)}</div></fieldset>)}</div></div></Sheet>
  </div>;
}

function FragmentRows({ category, permissions, profiles }: { category: string; permissions: Permission[]; profiles: RoleProfile[] }) {
  return <><tr className="border-t border-line bg-surface-2"><th colSpan={profiles.length + 1} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">{category}</th></tr>{permissions.map((permission) => <tr key={permission.id} className="border-t border-line"><th className="px-3 py-2 font-medium text-fg">{permission.label}</th>{profiles.map((profile) => <td key={profile.id} className="px-2 py-2 text-center">{profile.permissions?.includes(permission.permission_key) && <Check aria-label="Granted" size={15} className="mx-auto text-success" />}</td>)}</tr>)}</>;
}
