"use client";

import { useEffect, useState } from "react";

export default function AdminStandardsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState({ fileName: "imsmanifest.xml", manifestText: "" });
  const load = () => fetch("/api/standards").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const parse = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/standards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ fileName: "imsmanifest.xml", manifestText: "" });
    load();
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Interoperability</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">SCORM, xAPI, cmi5</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Parse manifests, track launches, and store xAPI-ready package metadata.</p>
      </div>
      <form onSubmit={parse} className="edsync-card space-y-3 p-4">
        <input className="edsync-input" value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="Manifest file name" />
        <textarea className="edsync-input min-h-36" value={form.manifestText} onChange={(event) => setForm({ ...form, manifestText: event.target.value })} placeholder="Paste imsmanifest.xml or tincan.xml text" required />
        <button className="btn-primary" type="submit">Parse package</button>
      </form>
      <div className="edsync-card overflow-hidden">
        {(payload?.packages ?? []).map((item: any) => (
          <div key={item.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_120px_120px_1fr]">
            <span className="font-semibold">{item.title}</span>
            <span>{item.package_type}</span>
            <span className="capitalize text-edsync-subtle">{item.status}</span>
            <span className="truncate text-edsync-subtle">{item.launch_path || "No launch path detected"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
