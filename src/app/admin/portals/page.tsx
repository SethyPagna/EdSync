"use client";

import { useEffect, useState } from "react";

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
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Tenant command</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Portals</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Manage branded academies for internal, customer, partner, and public audiences.</p>
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
      <div className="edsync-card overflow-hidden">
        {(payload?.portals ?? []).map((portal: any) => (
          <div key={portal.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_120px_1fr_100px]">
            <span className="font-semibold">{portal.name}</span>
            <span className="capitalize text-edsync-subtle">{portal.audience}</span>
            <span className="text-edsync-subtle">{portal.domain || "No custom domain"}</span>
            <span className="badge bg-edsync-blue/10 text-edsync-blue">{portal.is_default ? "Default" : "Portal"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
