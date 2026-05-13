"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Globe2 } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

export default function AdminPortalsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState({ name: "", audience: "internal", domain: "" });

  const load = () => fetch("/api/portals").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const createPortal = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/portals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, domain: form.domain || null }),
    });
    setForm({ name: "", audience: "internal", domain: "" });
    load();
  };

  return (
    <div className="page-shell space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Tenant command</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Organizations & Portals</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Portals work like branded academies: one organization can run internal training, partner learning, customer education, or a public course catalog.
          </p>
        </div>
        <GuidePanel
          title="Blackboard-style organization layer"
          description="Platform admin controls the whole app. Organization owners and managers should only control their own portal branding, catalog visibility, users, and roles."
          icon={Building2}
          items={[
            "Internal: private workspace for staff or enrolled learners.",
            "Public: discoverable organization catalog.",
            "Customer/partner: scoped external audience portals.",
          ]}
        />
      </div>
      <form onSubmit={createPortal} className="edsync-card grid gap-3 p-4 md:grid-cols-4">
        <input className="edsync-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Portal name" required />
        <select className="edsync-input" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
          <option value="internal">Internal</option>
          <option value="customer">Customer</option>
          <option value="partner">Partner</option>
          <option value="public">Public</option>
        </select>
        <input className="edsync-input" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="portal.example.com" />
        <button className="btn-primary" type="submit">Create portal</button>
      </form>
      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Portal directory</h2>
          <p className="text-sm text-edsync-subtle">Public portals can also be opened through `/org/[portalSlug]` until a custom domain is active.</p>
        </div>
        {(payload?.portals ?? []).map((portal: any) => (
          <div key={portal.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm lg:grid-cols-[1fr_120px_1fr_180px] lg:items-center">
            <span className="font-semibold">{portal.name}</span>
            <span className="capitalize text-edsync-subtle">{portal.audience}</span>
            <span className="text-edsync-subtle">{portal.domain || "No custom domain"}</span>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <span className="badge bg-edsync-blue/10 text-edsync-blue">{portal.is_default ? "Default" : "Portal"}</span>
              {portal.audience === "public" && (
                <Link href={`/org/${portal.slug}`} className="badge bg-edsync-emerald/10 text-edsync-emerald">
                  <Globe2 className="h-3 w-3" /> Open
                </Link>
              )}
            </div>
          </div>
        ))}
        {(payload?.portals ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No portals yet.</p>
        )}
      </div>
    </div>
  );
}
