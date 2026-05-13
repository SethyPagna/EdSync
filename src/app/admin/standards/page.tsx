"use client";

import { useEffect, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Interoperability</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">SCORM, xAPI, cmi5</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Use standards support when a course, quiz, or outside package needs launch tracking and portable learning records.
          </p>
        </div>
        <GuidePanel
          title="When to use this"
          description="Paste a manifest while preparing a package import. EdSync extracts title, launch path, package type, and metadata before the content is assigned."
          icon={FileCheck2}
          items={[
            "SCORM: packaged lessons with a launch file.",
            "xAPI: granular learning statements for analytics.",
            "cmi5: structured xAPI launch and completion rules.",
          ]}
        />
      </div>

      <form onSubmit={parse} className="edsync-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <input className="edsync-input" value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="Manifest file name" />
          <textarea className="edsync-input min-h-40" value={form.manifestText} onChange={(event) => setForm({ ...form, manifestText: event.target.value })} placeholder="Paste imsmanifest.xml or tincan.xml text" required />
        </div>
        <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
          <UploadCloud className="mb-3 h-7 w-7 text-edsync-blue" />
          <p className="font-semibold text-edsync-text">Parser checklist</p>
          <p className="mt-2 text-sm leading-6 text-edsync-subtle">
            Use clear XML, keep launch paths relative, and check the detected package type before publishing.
          </p>
          <button className="btn-primary mt-4 w-full justify-center" type="submit">Parse package</button>
        </div>
      </form>
      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Parsed packages</h2>
          <p className="text-sm text-edsync-subtle">Review launch paths and package status before assignment.</p>
        </div>
        {(payload?.packages ?? []).map((item: any) => (
          <div key={item.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_120px_120px_1fr]">
            <span className="font-semibold">{item.title}</span>
            <span>{item.package_type}</span>
            <span className="capitalize text-edsync-subtle">{item.status}</span>
            <span className="truncate text-edsync-subtle">{item.launch_path || "No launch path detected"}</span>
          </div>
        ))}
        {(payload?.packages ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No standards packages parsed yet.</p>
        )}
      </div>
    </div>
  );
}
