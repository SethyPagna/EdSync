"use client";

import { useEffect, useState } from "react";
import { Edit3, MoreVertical, Save, Trash2, UploadCloud, X } from "lucide-react";
import type { ScormPackage } from "@/types";
import { ActionMenu, InfoPopover } from "@/components/WorkspacePrimitives";
import {
  normalizeStandardsLaunchPath,
  validateStandardsFileName,
  validateStandardsManifestText,
  validateStandardsTitle,
} from "@/lib/validation/standards";

type StandardsPayload = {
  packages: ScormPackage[];
};

type PackageDraft = {
  title: string;
  launchPath: string;
  status: ScormPackage["status"];
};

const MANIFEST_SAMPLES = [
  {
    label: "SCORM 1.2",
    fileName: "imsmanifest.xml",
    manifestText: '<manifest identifier="edsync-sample" version="1.2"><organizations><organization><title>Sample SCORM Course</title><item identifierref="resource-1"><title>Launch lesson</title></item></organization></organizations><resources><resource identifier="resource-1" href="launch/index.html" /></resources></manifest>',
  },
  {
    label: "SCORM 2004",
    fileName: "imsmanifest.xml",
    manifestText: '<manifest identifier="edsync-2004" version="2004 4th Edition"><organizations><organization><title>Sample SCORM 2004 Course</title></organization></organizations><resources><resource identifier="resource-1" href="index.html" /></resources></manifest>',
  },
  {
    label: "xAPI",
    fileName: "tincan.xml",
    manifestText: '<tincan><activities><activity id="https://edsync.app/sample"><name>Sample xAPI Activity</name><launch lang="en-us">index.html</launch></activity></activities></tincan>',
  },
  {
    label: "cmi5",
    fileName: "cmi5.xml",
    manifestText: '<courseStructure><course><title>Sample cmi5 Course</title><au id="au-1"><title>Launch AU</title><url>au/index.html</url></au></course></courseStructure>',
  },
];

function statusBadge(status: ScormPackage["status"]) {
  if (status === "parsed") return "bg-edsync-emerald/10 text-edsync-emerald";
  if (status === "error") return "bg-edsync-red/10 text-edsync-red";
  if (status === "archived") return "bg-slate-100 text-slate-500";
  return "bg-edsync-blue/10 text-edsync-blue";
}

export default function AdminStandardsPage() {
  const [payload, setPayload] = useState<StandardsPayload>({ packages: [] });
  const [form, setForm] = useState({ fileName: "imsmanifest.xml", manifestText: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PackageDraft>({ title: "", launchPath: "", status: "parsed" });
  const [message, setMessage] = useState("");
  const [showManifest, setShowManifest] = useState(false);

  const load = () =>
    fetch("/api/standards", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: StandardsPayload }) => setPayload(json.data ?? { packages: [] }));

  useEffect(() => {
    load();
  }, []);

  const run = async (body: Record<string, unknown>, success: string) => {
    setMessage("");
    const response = await fetch("/api/standards", {
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

  const parse = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      validateStandardsFileName(form.fileName);
      validateStandardsManifestText(form.manifestText);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manifest is invalid.");
      return;
    }
    const ok = await run({ action: "parse", ...form }, "Package parsed.");
    if (ok) setForm({ fileName: "imsmanifest.xml", manifestText: "" });
  };

  const startEdit = (item: ScormPackage) => {
    setEditingId(item.id);
    setDraft({ title: item.title, launchPath: item.launch_path ?? "", status: item.status });
  };

  const save = async (item: ScormPackage) => {
    try {
      validateStandardsTitle(draft.title);
      normalizeStandardsLaunchPath(draft.launchPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Package is invalid.");
      return;
    }
    const ok = await run({ action: "update", id: item.id, ...draft }, "Package saved.");
    if (ok) setEditingId(null);
  };

  const applySample = (sample: (typeof MANIFEST_SAMPLES)[number]) => {
    setForm({ fileName: sample.fileName, manifestText: sample.manifestText });
    setShowManifest(true);
    setMessage(`${sample.label} sample loaded.`);
  };

  const remove = async (item: ScormPackage) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await run({ action: "delete", id: item.id }, "Package deleted.");
  };

  return (
    <div className="page-shell space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Governance</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Standards Packages</h1>
        </div>
        <InfoPopover label="Standards help">
          SCORM launches packaged lessons. xAPI stores learning statements. cmi5 adds structured launch rules.
        </InfoPopover>
      </header>

      {message && <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">{message}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {MANIFEST_SAMPLES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => applySample(sample)}
            className="rounded-lg border border-edsync-border bg-edsync-card p-4 text-left transition hover:border-edsync-blue/50 hover:bg-edsync-surface"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Template</span>
            <span className="mt-2 block font-semibold text-edsync-text">{sample.label}</span>
          </button>
        ))}
      </section>

      <form onSubmit={parse} className="edsync-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <input className="edsync-input" value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="Manifest file name" />
          <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setShowManifest((value) => !value)}>
            {showManifest ? "Hide manifest" : "Edit manifest"}
          </button>
          {showManifest && (
            <textarea className="edsync-input min-h-40" value={form.manifestText} onChange={(event) => setForm({ ...form, manifestText: event.target.value })} placeholder="Paste imsmanifest.xml or tincan.xml text" required />
          )}
        </div>
        <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
          <UploadCloud className="mb-3 h-7 w-7 text-edsync-blue" />
          <p className="font-semibold text-edsync-text">Parser checklist</p>
          <p className="mt-2 text-sm leading-5 text-edsync-subtle">Valid XML. Relative paths. Review before publish.</p>
          <button className="btn-primary mt-4 w-full justify-center" type="submit">Parse package</button>
        </div>
      </form>

      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Parsed packages</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {payload.packages.map((item) => {
            const editing = editingId === item.id;
            return (
              <section key={item.id} className="grid gap-3 px-4 py-4 text-sm">
                {editing ? (
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
                    <input className="edsync-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                    <input className="edsync-input" value={draft.launchPath} onChange={(event) => setDraft({ ...draft, launchPath: event.target.value })} placeholder="launch/index.html" />
                    <select className="edsync-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ScormPackage["status"] })}>
                      <option value="uploaded">Uploaded</option>
                      <option value="parsed">Parsed</option>
                      <option value="error">Error</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_minmax(0,1fr)]">
                    <span className="font-semibold">{item.title}</span>
                    <span>{item.package_type}</span>
                    <span className={`badge w-fit ${statusBadge(item.status)}`}>{item.status}</span>
                    <span className="truncate text-edsync-subtle">{item.launch_path || "No launch path detected"}</span>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  {editing ? (
                    <>
                      <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => save(item)}><Save className="h-4 w-4" /> Save</button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</button>
                    </>
                  ) : (
                    <ActionMenu label={`${item.title} actions`}>
                      <button type="button" className="btn-secondary justify-start px-3 py-2 text-sm" onClick={() => startEdit(item)}><Edit3 className="h-4 w-4" /> Edit</button>
                      <button type="button" className="btn-ghost justify-start px-3 py-2 text-sm text-rose-600" onClick={() => remove(item)}><Trash2 className="h-4 w-4" /> Delete</button>
                    </ActionMenu>
                  )}
                </div>
                {!editing && (
                  <details className="rounded-lg border border-edsync-border bg-edsync-surface">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-edsync-subtle">
                      <MoreVertical className="h-3.5 w-3.5" />
                      Manifest summary
                    </summary>
                    <pre className="overflow-auto border-t border-edsync-border p-3 text-xs text-edsync-subtle">{JSON.stringify(item.manifest ?? {}, null, 2)}</pre>
                  </details>
                )}
              </section>
            );
          })}
          {payload.packages.length === 0 && <p className="px-4 py-5 text-sm text-edsync-subtle">No standards packages parsed yet.</p>}
        </div>
      </div>
    </div>
  );
}
