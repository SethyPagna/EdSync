"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Plus, Trash2 } from "lucide-react";
import type { CertificationRule } from "@/types";
import { CERTIFICATION_RECIPES } from "@/lib/certifications/rules";
import { Button, PageHeader, Sheet, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";

type Draft = { title: string; description: string; courseId: string; expiresAfterDays: number; notifyBeforeDays: number; settings: Record<string, unknown> };
type IssuePayload = { data?: { issued?: number; renewed?: number; nextCursor?: string | null }; error?: string };
const emptyDraft: Draft = { title: "", description: "", courseId: "", expiresAfterDays: 365, notifyBeforeDays: 30, settings: { evidence: ["completion"], renewal: "annual" } };
function fromRule(rule: CertificationRule): Draft { return { title: rule.title, description: rule.description ?? "", courseId: rule.course_id ?? "", expiresAfterDays: rule.expires_after_days ?? 0, notifyBeforeDays: rule.notify_before_days, settings: { ...(rule.settings ?? {}) } }; }
function fromRecipe(recipe: (typeof CERTIFICATION_RECIPES)[number]): Draft { return { title: recipe.title, description: recipe.description, courseId: "", expiresAfterDays: recipe.expiresAfterDays ?? 0, notifyBeforeDays: recipe.notifyBeforeDays, settings: { ...recipe.settings } }; }

export default function AdminCertificationsPage() {
  const edsync = useMemo(() => createClient(), []);
  const [rules, setRules] = useState<CertificationRule[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [issueCursors, setIssueCursors] = useState<Record<string, string>>({});
  const confirm = useConfirm();
  const load = useCallback(async () => { try { const response = await fetch("/api/certifications", { cache: "no-store" }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Could not load certifications."); setRules(payload.data?.rules ?? []); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load certifications."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void edsync.from("lessons").select("id,title,status").order("title").then(({ data }) => {
        setCourses(((data ?? []) as Array<{ id: string; title: string; status: string }>).filter((lesson) => lesson.status === "published"));
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [edsync]);
  const run = async (body: Record<string, unknown>, success: string) => { setBusy(true); setError(""); try { const response = await fetch("/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok || payload.error) throw new Error(payload.error || "Certification could not be saved."); setNotice(success); await load(); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "Certification could not be saved."); return false; } finally { setBusy(false); } };
  const create = (recipe?: (typeof CERTIFICATION_RECIPES)[number]) => { setEditingId(null); setDraft(recipe ? fromRecipe(recipe) : emptyDraft); setOpen(true); };
  const edit = (rule: CertificationRule) => { setEditingId(rule.id); setDraft(fromRule(rule)); setOpen(true); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (Array.isArray(draft.settings.evidence) && draft.settings.evidence.length === 0) { setError("Select completion or score evidence."); return; } const ok = await run({ action: editingId ? "update" : "create", ...(editingId ? { id: editingId } : {}), ...draft }, editingId ? "Certification saved." : "Certification created."); if (ok) setOpen(false); };
  const remove = async (rule: CertificationRule) => { if (!await confirm({ title: `Delete ${rule.title}?`, body: "This removes the certification rule.", confirmLabel: "Delete rule", danger: true })) return; await run({ action: "delete", id: rule.id }, "Certification deleted."); };
  const issue = async (rule: CertificationRule) => {
    setIssuingId(rule.id); setError(""); setNotice("");
    let cursor: string | undefined = issueCursors[rule.id];
    let issued = 0;
    let renewed = 0;
    try {
      for (let page = 0; page < 20; page += 1) {
        const response: Response = await fetch("/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue", id: rule.id, cursor }) });
        const payload: IssuePayload = await response.json();
        if (!response.ok || payload.error) throw new Error(payload.error || "Could not issue certifications.");
        issued += Number(payload.data?.issued ?? 0);
        renewed += Number(payload.data?.renewed ?? 0);
        cursor = payload.data?.nextCursor ?? undefined;
        if (!cursor) break;
      }
      setIssueCursors((current) => ({ ...current, [rule.id]: cursor ?? "" }));
      setNotice(`${issued} issued · ${renewed} renewed${cursor ? " · more learners remain; run again" : ""}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not issue certifications."); }
    finally { setIssuingId(null); }
  };
  const setSetting = (key: string, value: unknown) => setDraft((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const evidence = Array.isArray(draft.settings.evidence) ? draft.settings.evidence as string[] : ["completion"];
  const setScoreTarget = (value: string) => setDraft((current) => {
    const settings = { ...current.settings };
    if (value === "") delete settings.scoreGte;
    else { settings.scoreGte = Number(value); settings.evidence = Array.from(new Set([...(Array.isArray(settings.evidence) ? settings.evidence : ["completion"]), "score"])); }
    return { ...current, settings };
  });

  return <div className="page-shell space-y-4"><PageHeader title="Certifications" icon={Award} count={rules.length} actions={<Button variant="primary" onClick={() => create()}><Plus size={16} /> New rule</Button>} />
    {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fg-muted">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Start from a recipe</span>{CERTIFICATION_RECIPES.map((recipe) => <button key={recipe.id} type="button" onClick={() => create(recipe)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-accent hover:text-fg">{recipe.title}</button>)}</div>
    <section className="card divide-y divide-line overflow-hidden">{rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Award size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{rule.title}</p><p className="truncate text-xs text-fg-muted">{rule.description || (rule.course_id ? courses.find((course) => course.id === rule.course_id)?.title ?? `Lesson ${rule.course_id}` : "Link a course to issue credentials")}</p></div><span className="text-xs text-fg-muted">{rule.expires_after_days ? `${rule.expires_after_days}d expiry` : "No expiry"} · {rule.notify_before_days}d notice</span>{rule.course_id && <button type="button" disabled={issuingId !== null} className="rounded-md px-2 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-50" onClick={() => void issue(rule)}>{issuingId === rule.id ? "Issuing…" : "Issue eligible"}</button>}<button type="button" className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2" onClick={() => edit(rule)}>Edit</button><button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-soft hover:text-danger" onClick={() => void remove(rule)} aria-label={`Delete ${rule.title}`}><Trash2 size={16} /></button></div>)}{rules.length === 0 && <p className="px-4 py-8 text-center text-sm text-fg-muted">No certification rules yet.</p>}</section>
    <Sheet open={open} onClose={() => setOpen(false)} title={editingId ? "Edit certification" : "New certification"} size="lg" onSubmit={save} footer={<><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save rule"}</Button></>}><div className="space-y-4">{error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <label className="block space-y-1 text-sm font-medium text-fg">Title<input className="edsync-input w-full" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={140} required /></label>
      <label className="block space-y-1 text-sm font-medium text-fg">Description<textarea className="edsync-input min-h-20 w-full" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={600} /></label>
      <label className="block space-y-1 text-sm font-medium text-fg">Course lesson ID<input className="edsync-input w-full" list="certification-courses" value={draft.courseId} onChange={(event) => setDraft({ ...draft, courseId: event.target.value })} placeholder="Choose a published lesson" /><span className="text-xs font-normal text-fg-faint">Required before credentials can be issued.</span></label><datalist id="certification-courses">{courses.map((course) => <option key={course.id} value={course.id} label={course.title} />)}</datalist>
      <div className="grid grid-cols-2 gap-3"><label className="block space-y-1 text-sm font-medium text-fg">Expires after days<input className="edsync-input w-full" type="number" min="0" max="3650" value={draft.expiresAfterDays} onChange={(event) => setDraft({ ...draft, expiresAfterDays: Number(event.target.value) })} /><span className="text-xs font-normal text-fg-faint">0 means no expiry</span></label><label className="block space-y-1 text-sm font-medium text-fg">Notify before days<input className="edsync-input w-full" type="number" min="0" max="365" value={draft.notifyBeforeDays} onChange={(event) => setDraft({ ...draft, notifyBeforeDays: Number(event.target.value) })} /></label></div>
      <fieldset className="space-y-3 border-t border-line pt-4"><legend className="text-sm font-semibold text-fg">Evidence settings</legend><p className="text-xs text-fg-muted">Completion and score determine eligibility. Renewal needs new evidence after expiry and the selected cadence. Audit level and audience are program metadata.</p><div className="flex flex-wrap gap-3">{["completion", "score"].map((item) => <label key={item} className="flex items-center gap-2 text-sm capitalize text-fg-muted"><input type="checkbox" checked={evidence.includes(item)} onChange={(event) => setSetting("evidence", event.target.checked ? [...evidence, item] : evidence.filter((value) => value !== item))} />{item}</label>)}</div><label className="block space-y-1 text-sm text-fg-muted">Audit level<select className="edsync-input w-full" value={String(draft.settings.audit ?? "standard")} onChange={(event) => setSetting("audit", event.target.value)}><option value="light">Light</option><option value="standard">Standard</option><option value="required">Required</option></select></label><label className="block space-y-1 text-sm text-fg-muted">Renewal<select className="edsync-input w-full" value={String(draft.settings.renewal ?? (draft.expiresAfterDays ? "annual" : "none"))} onChange={(event) => setSetting("renewal", event.target.value)}><option value="none">One time</option><option value="annual">Allow reissue</option><option value="biennial">Allow reissue every two years</option></select></label><label className="block space-y-1 text-sm text-fg-muted">Minimum score (optional)<input className="edsync-input w-full" type="number" min="0" max="100" value={draft.settings.scoreGte === undefined ? "" : Number(draft.settings.scoreGte)} onChange={(event) => setScoreTarget(event.target.value)} /></label><label className="block space-y-1 text-sm text-fg-muted">Audience<select className="edsync-input w-full" value={String(draft.settings.audience ?? "internal")} onChange={(event) => setSetting("audience", event.target.value)}><option value="internal">Internal</option><option value="external">External</option></select></label></fieldset>
    </div></Sheet>
  </div>;
}
