"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Settings2, Trash2 } from "lucide-react";
import { PageHeader, useConfirm } from "@/components/ui";

type Flag = {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: number | boolean;
  connected: boolean;
};

const links = [
  { href: "/admin/ai", label: "AI providers" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/permissions", label: "Permissions" },
  { href: "/admin/governance", label: "Governance" },
  { href: "/admin/billing", label: "Catalog" },
  { href: "/admin/portals", label: "Organizations" },
];

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [emailMode, setEmailMode] = useState("outbox");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || "Could not load settings.");
      setFlags(payload.data?.flags ?? []);
      setEmailMode(payload.data?.emailMode ?? "outbox");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (method: "POST" | "PATCH", body: Record<string, unknown>, key: string, success: string) => {
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || "Setting could not be saved.");
      setNotice(success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Setting could not be saved.");
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (flag: Flag) => {
    if (!await confirm({
      title: `Remove ${flag.label}?`,
      body: "This legacy flag has no effect on product features.",
      confirmLabel: "Remove flag",
      danger: true,
    })) return;
    await run("POST", { action: "delete_flag", id: flag.id }, flag.flag_key, "Legacy flag removed.");
  };

  const connected = flags.filter((flag) => flag.connected);
  const disconnected = flags.filter((flag) => !flag.connected);

  return <div className="page-shell space-y-4">
    <PageHeader title="Settings" icon={Settings2} />
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-muted">Platform-wide controls</span>
      <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-muted">Email mode: {emailMode}</span>
      {links.map((item) => <Link key={item.href} href={item.href} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg">{item.label}<ArrowRight size={12} /></Link>)}
    </div>
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <section className="card divide-y divide-line overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Feature controls</h2>
        <p className="text-xs text-fg-muted">These switches apply to every organization. Turning one off blocks its listed feature immediately.</p>
      </div>
      {connected.map((flag) => <div key={flag.id} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{flag.label}</p>
          <p className="text-xs text-fg-muted">{flag.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(flag.enabled)}
          aria-label={`${flag.label} enabled for all organizations`}
          disabled={busyKey !== null}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${flag.enabled ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted"}`}
          onClick={() => void run("PATCH", { flagKey: flag.flag_key, enabled: !flag.enabled }, flag.flag_key, `${flag.label} updated for all organizations.`)}
        >{busyKey === flag.flag_key ? "Saving…" : flag.enabled ? "On" : "Off"}</button>
      </div>)}
    </section>
    {disconnected.length > 0 && <section className="card divide-y divide-line overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Disconnected legacy flags</h2>
        <p className="text-xs text-fg-muted">These old keys have no effect and can be removed.</p>
      </div>
      {disconnected.map((flag) => <div key={flag.id} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{flag.label}</p>
          <p className="truncate text-xs text-fg-muted">{flag.flag_key}</p>
        </div>
        <button type="button" disabled={busyKey !== null} className="rounded-md p-2 text-fg-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50" onClick={() => void remove(flag)} aria-label={`Remove ${flag.label}`}><Trash2 size={16} /></button>
      </div>)}
    </section>}
  </div>;
}
