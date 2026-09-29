"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, Search, UsersRound } from "lucide-react";
import { Button, PageHeader, useConfirm } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type AdminUser = { id: string; email: string; full_name: string | null; role: "teacher" | "student"; is_admin: number | boolean; last_active_at: string | null };
type Filter = "all" | "admins" | "teachers" | "students";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async (search: string) => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Could not load accounts."); setUsers(payload.data ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load accounts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(query), 300); return () => window.clearTimeout(timer); }, [load, query]);

  const visible = useMemo(() => users.filter((user) => filter === "all" || (filter === "admins" ? Boolean(user.is_admin) : !user.is_admin && user.role === (filter === "teachers" ? "teacher" : "student"))), [filter, users]);
  const selectedVisible = visible.filter((user) => selected.includes(user.id));
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const changeAdmin = async (targets: AdminUser[], admin: boolean) => {
    if (!targets.length) return;
    const agreed = await confirm({ title: admin ? `Grant admin access to ${targets.length} account${targets.length === 1 ? "" : "s"}?` : `Remove admin access from ${targets.length} account${targets.length === 1 ? "" : "s"}?`, body: "Platform admin can manage EdSync globally. This does not change tenant role profiles.", confirmLabel: admin ? "Grant access" : "Remove access", danger: !admin });
    if (!agreed) return;
    setBusy(true); setError(""); setNotice("");
    let updated = 0;
    try {
      for (const user of targets) {
        if (Boolean(user.is_admin) === admin) continue;
        const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, admin }) });
        const payload = await response.json();
        if (!response.ok || payload.error) throw new Error(payload.error || `Could not update ${user.email}.`);
        updated += 1;
      }
      setNotice(`${updated} account${updated === 1 ? "" : "s"} updated.`);
      setSelected([]);
    } catch (reason) { setError(`${updated} updated. ${reason instanceof Error ? reason.message : "Update failed."}`); }
    finally { await load(query); setBusy(false); }
  };

  return <div className="page-shell space-y-4">
    <PageHeader title="Accounts" icon={UsersRound} count={users.length} actions={<Button variant="secondary" onClick={() => void load(query)} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</Button>} />
    <div className="flex flex-wrap items-center gap-2"><label className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" /><span className="sr-only">Search accounts</span><input className="edsync-input w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label><select className="edsync-input w-auto" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="Filter accounts"><option value="all">All roles</option><option value="admins">Platform admins</option><option value="teachers">Creators</option><option value="students">Learners</option></select></div>
    {selectedVisible.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm"><span className="mr-auto font-medium text-fg">{selectedVisible.length} selected</span><Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeAdmin(selectedVisible, true)}>Grant admin</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeAdmin(selectedVisible, false)}>Remove admin</Button><button className="px-2 text-fg-muted" onClick={() => setSelected([])}>Clear</button></div>}
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <div className="card overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-line bg-surface-2 text-xs font-semibold text-fg-muted"><tr><th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select visible accounts" checked={visible.length > 0 && visible.every((user) => selected.includes(user.id))} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...visible.map((user) => user.id)])) : selected.filter((id) => !visible.some((user) => user.id === id)))} /></th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Access</th><th className="px-3 py-2">Last active</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-line">{visible.map((user) => <tr key={user.id} className="hover:bg-surface-2"><td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${user.email}`} checked={selected.includes(user.id)} onChange={() => toggleSelected(user.id)} /></td><td className="px-3 py-3"><p className="font-medium text-fg">{user.full_name || "Unnamed"}</p><p className="text-xs text-fg-muted">{user.email}</p></td><td className="px-3 py-3 text-fg-muted">{user.is_admin ? "Platform admin" : user.role === "teacher" ? "Creator" : "Learner"}</td><td className="px-3 py-3 text-fg-muted">{user.last_active_at ? formatDate(user.last_active_at) : "Never"}</td><td className="px-3 py-3"><div className="flex items-center justify-end gap-1"><a className="rounded-md p-2 text-fg-muted hover:bg-surface" href={`mailto:${user.email}`} aria-label={`Email ${user.email}`}><Mail size={16} /></a><button type="button" className="rounded-md px-2 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface" disabled={busy} onClick={() => void changeAdmin([user], !user.is_admin)}>{user.is_admin ? "Revoke admin" : "Make admin"}</button></div></td></tr>)}{visible.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-fg-muted">{loading ? "Loading accounts…" : "No accounts match this view."}</td></tr>}</tbody></table></div>
    <p className="text-xs text-fg-faint">Showing up to 100 most recent accounts returned by the server.</p>
  </div>;
}
