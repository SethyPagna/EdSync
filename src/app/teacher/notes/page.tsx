"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Archive, Copy, ExternalLink, Grid2X2, List, Paperclip, Plus, StickyNote, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, Menu, PageHeader, SearchInput, Segmented, Skeleton, useConfirm } from "@/components/ui";
import { archiveStudioItem, listStudioItems, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import { NOTE_DESIGN_PRESETS, noteDesignPresetById, type NoteDesignPresetId } from "@/lib/learning/creator-library";
import { classifySafeMediaUrl } from "@/lib/security/media";
import { readViewMode, writeViewMode, type ViewMode } from "@/lib/ui/view-preferences";

type StudentRow = { id: string; full_name: string | null; email: string; class_id: string; class_name: string };
type LearnerNote = {
  id: string;
  student_id: string;
  class_id: string | null;
  title: string;
  body: string;
  priority: string;
  visibility: string;
  student_name: string | null;
  student_email: string;
  created_at: string;
};
type PersonalDraft = { title: string; body: string; mediaUrl: string; design: NoteDesignPresetId };
type LearnerDraft = { studentKey: string; title: string; body: string; visibility: string; priority: string };
type Tab = "personal" | "learners";
type UploadResponse = { data: { publicUrl: string; assetType: string } | null; error: { message: string } | string | null };

const tabs: Array<{ value: Tab; label: string }> = [{ value: "personal", label: "My notes" }, { value: "learners", label: "Learner notes" }];
const designOptions = NOTE_DESIGN_PRESETS.filter((option) => ["clean", "planning", "feedback", "resource"].includes(option.id));
const VIEW_KEY = "edsync-teacher-notes-view-mode";
const emptyPersonal: PersonalDraft = { title: "", body: "", mediaUrl: "", design: "clean" };
const emptyLearner: LearnerDraft = { studentKey: "", title: "", body: "", visibility: "student", priority: "normal" };

function personalText(item: StudioServerItem) {
  return item.plainText || (typeof item.content.body === "string" ? item.content.body : "");
}

function personalMedia(item: StudioServerItem) {
  const media = item.metadata.media;
  return media && typeof media === "object" && "url" in media ? String(media.url || "") : "";
}

function errorText(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return fallback;
}

async function readData(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error || !payload) throw new Error(errorText(payload?.error, "Request failed."));
  return payload.data;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function TeacherNotesPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("personal");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [learnerNotes, setLearnerNotes] = useState<LearnerNote[]>([]);
  const [personalNotes, setPersonalNotes] = useState<StudioServerItem[]>([]);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>(emptyPersonal);
  const [learnerDraft, setLearnerDraft] = useState<LearnerDraft>(emptyLearner);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [personalError, setPersonalError] = useState("");
  const [learnerError, setLearnerError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selectedPersonal = personalNotes.find((item) => item.id === selectedPersonalId) || null;
  const selectedLearner = learnerNotes.find((item) => item.id === selectedLearnerId) || null;
  const safeMedia = useMemo(() => classifySafeMediaUrl(personalDraft.mediaUrl), [personalDraft.mediaUrl]);
  const visiblePersonal = personalNotes.filter((item) => (item.title + " " + personalText(item)).toLowerCase().includes(search.trim().toLowerCase()));
  const visibleLearner = learnerNotes.filter((item) => (item.title + " " + item.body + " " + (item.student_name || item.student_email)).toLowerCase().includes(search.trim().toLowerCase()));

  const load = useCallback(async () => {
    setLoading(true);
    const [personal, feedback, roster] = await Promise.allSettled([
      listStudioItems("note"),
      fetch("/api/notes", { cache: "no-store" }).then(readData),
      fetch("/api/teacher/roster", { cache: "no-store" }).then(readData),
    ]);
    if (personal.status === "fulfilled") {
      const items = personal.value.filter((item) => {
        const source = item.metadata.source;
        return source === "teacher_notes" || source === "student_notes" || source === undefined || source === null;
      });
      setPersonalNotes(items);
      setSelectedPersonalId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id || null);
      setPersonalError("");
    } else {
      setPersonalError(errorText(personal.reason, "Creator notes could not load."));
    }
    if (feedback.status === "fulfilled") {
      const items = (feedback.value || []) as LearnerNote[];
      setLearnerNotes(items);
      setSelectedLearnerId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id || null);
      setLearnerError("");
    } else {
      setLearnerError(errorText(feedback.reason, "Learner notes could not load."));
    }
    if (roster.status === "fulfilled") setStudents((roster.value?.students || []) as StudentRow[]);
    else setLearnerError(errorText(roster.reason, "Learner roster could not load."));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setViewMode(readViewMode(VIEW_KEY, "list"));
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const guardChanges = async () => {
    if (!editing || !dirty) return true;
    return confirm({ title: "Discard unsaved changes?", body: "Changes in the open note will be lost.", confirmLabel: "Discard", danger: true });
  };

  const changeTab = async (next: Tab) => {
    if (next === tab || !await guardChanges()) return;
    setTab(next);
    setEditing(false);
    setCreating(false);
    setDirty(false);
    setSearch("");
    setActionError("");
  };

  const selectPersonal = async (item: StudioServerItem) => {
    if (!await guardChanges()) return;
    setSelectedPersonalId(item.id);
    setEditing(false);
    setCreating(false);
    setDirty(false);
    setActionError("");
  };

  const selectLearner = async (item: LearnerNote) => {
    if (!await guardChanges()) return;
    setSelectedLearnerId(item.id);
    setEditing(false);
    setCreating(false);
    setDirty(false);
    setActionError("");
  };

  const newNote = async () => {
    if (!await guardChanges()) return;
    setCreating(true);
    setEditing(true);
    setDirty(false);
    setActionError("");
    if (tab === "personal") setPersonalDraft(emptyPersonal);
    else setLearnerDraft(emptyLearner);
  };

  const editNote = () => {
    setCreating(false);
    setEditing(true);
    setDirty(false);
    setActionError("");
    if (tab === "personal" && selectedPersonal) {
      setPersonalDraft({
        title: selectedPersonal.title,
        body: personalText(selectedPersonal),
        mediaUrl: personalMedia(selectedPersonal),
        design: noteDesignPresetById(selectedPersonal.metadata.design, "clean").id,
      });
    }
    if (tab === "learners" && selectedLearner) {
      const row = students.find((item) => item.id === selectedLearner.student_id && item.class_id === selectedLearner.class_id);
      setLearnerDraft({
        studentKey: row ? row.class_id + ":" + row.id : "",
        title: selectedLearner.title,
        body: selectedLearner.body,
        visibility: selectedLearner.visibility,
        priority: selectedLearner.priority,
      });
    }
  };

  const changePersonal = <K extends keyof PersonalDraft>(key: K, value: PersonalDraft[K]) => {
    setPersonalDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setActionError("");
  };
  const changeLearner = <K extends keyof LearnerDraft>(key: K, value: LearnerDraft[K]) => {
    setLearnerDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setActionError("");
  };

  const uploadMedia = async (file: File | null) => {
    if (!file || uploading) return;
    setUploading(true);
    setActionError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "teacher-notes");
      form.set("path", Date.now() + "-" + file.name);
      const response = await fetch("/api/storage/upload", { method: "POST", body: form });
      const payload = await response.json().catch(() => null) as UploadResponse | null;
      if (!response.ok || payload?.error || !payload?.data?.publicUrl) throw new Error(errorText(payload?.error, "Upload failed."));
      changePersonal("mediaUrl", payload.data.publicUrl);
      toast.success("Media uploaded");
    } catch (cause) {
      setActionError(errorText(cause, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const savePersonal = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!personalDraft.title.trim() || !personalDraft.body.trim()) return setActionError("Add a title and note.");
    if (personalDraft.mediaUrl.trim() && !safeMedia) return setActionError("Use a safe HTTPS image, video, or link.");
    setSaving(true);
    setActionError("");
    try {
      const content = {
        type: "teacher_personal_note",
        body: personalDraft.body.trim(),
        blocks: [{ type: "paragraph", text: personalDraft.body.trim() }, ...(safeMedia ? [{ type: safeMedia.kind, url: safeMedia.url, embedUrl: safeMedia.embedUrl }] : [])],
      };
      const metadata = { design: personalDraft.design, media: safeMedia, source: "teacher_notes" };
      const saved = creating
        ? await saveStudioItem({ kind: "note", title: personalDraft.title.trim(), plainText: personalDraft.body.trim(), status: "draft", content, metadata })
        : await updateStudioItem({ id: selectedPersonalId || "", title: personalDraft.title.trim(), plainText: personalDraft.body.trim(), status: "draft", content, metadata });
      setPersonalNotes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedPersonalId(saved.id);
      setEditing(false);
      setCreating(false);
      setDirty(false);
      toast.success("Note saved");
    } catch (cause) {
      setActionError(errorText(cause, "Note was not saved."));
    } finally {
      setSaving(false);
    }
  };

  const saveLearner = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const student = students.find((item) => item.class_id + ":" + item.id === learnerDraft.studentKey);
    if (creating && !student) return setActionError("Choose a learner.");
    setSaving(true);
    setActionError("");
    try {
      const saved = await fetch("/api/notes", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: creating ? undefined : selectedLearnerId,
          studentId: creating ? student?.id : selectedLearner?.student_id,
          classId: creating ? student?.class_id : undefined,
          title: learnerDraft.title.trim(),
          body: learnerDraft.body.trim(),
          visibility: learnerDraft.visibility,
          priority: learnerDraft.priority,
        }),
      }).then(readData);
      toast.success(creating ? "Learner note sent" : "Learner note updated");
      setEditing(false);
      setCreating(false);
      setDirty(false);
      await load();
      if (typeof saved?.id === "string") setSelectedLearnerId(saved.id);
    } catch (cause) {
      setActionError(errorText(cause, "Learner note was not saved."));
    } finally {
      setSaving(false);
    }
  };

  const duplicatePersonal = async (item: StudioServerItem) => {
    setActionError("");
    try {
      const copy = await saveStudioItem({
        kind: "note", title: item.title + " copy", plainText: personalText(item), status: "draft",
        content: item.content, metadata: { ...item.metadata, duplicatedFrom: item.id, source: "teacher_notes" },
      });
      setPersonalNotes((current) => [copy, ...current]);
      setSelectedPersonalId(copy.id);
      toast.success("Note duplicated");
    } catch (cause) {
      setActionError(errorText(cause, "Note was not duplicated."));
    }
  };

  const archivePersonal = async (item: StudioServerItem) => {
    if (!await confirm({ title: "Archive " + item.title + "?", body: "The note will leave this workspace.", confirmLabel: "Archive", danger: true })) return;
    setActionError("");
    try {
      await archiveStudioItem(item.id);
      const remaining = personalNotes.filter((note) => note.id !== item.id);
      setPersonalNotes(remaining);
      setSelectedPersonalId(remaining[0]?.id || null);
      setEditing(false);
      setCreating(false);
      setDirty(false);
      toast.success("Note archived");
    } catch (cause) {
      setActionError(errorText(cause, "Note was not archived."));
    }
  };

  const deleteLearner = async (item: LearnerNote) => {
    if (!await confirm({ title: "Delete " + item.title + "?", body: "This removes it for the learner too.", confirmLabel: "Delete", danger: true })) return;
    setActionError("");
    try {
      await fetch("/api/notes?id=" + encodeURIComponent(item.id), { method: "DELETE" }).then(readData);
      const remaining = learnerNotes.filter((note) => note.id !== item.id);
      setLearnerNotes(remaining);
      setSelectedLearnerId(remaining[0]?.id || null);
      toast.success("Learner note deleted");
    } catch (cause) {
      setActionError(errorText(cause, "Learner note was not deleted."));
    }
  };

  const selectedMedia = selectedPersonal ? classifySafeMediaUrl(personalMedia(selectedPersonal)) : null;
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    writeViewMode(VIEW_KEY, mode);
  };

  return (
    <main className="page max-w-6xl">
      <PageHeader title="Notes" icon={StickyNote} count={personalNotes.length + learnerNotes.length} actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => void newNote()}>New note</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Note type" value={tab} onChange={(next) => void changeTab(next)} options={tabs} />
        <span className="ml-auto text-xs text-fg-muted">{tab === "personal" ? personalNotes.length : learnerNotes.length} notes</span>
      </div>
      {tab === "personal" && personalError ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{personalError} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      {tab === "learners" && learnerError ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{learnerError} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <section aria-label="Notes list" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center gap-1 border-b border-line p-3"><SearchInput value={search} onChange={setSearch} placeholder="Search notes" label="Search notes" className="min-w-0 flex-1" />{tab === "personal" ? <Menu label="View options" items={[{ label: "List", icon: List, onSelect: () => changeViewMode("list") }, { label: "Grid", icon: Grid2X2, onSelect: () => changeViewMode("grid") }]} /> : null}</div>
          {loading ? <div className="space-y-2 p-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-16" />)}</div> :
            tab === "personal" ? visiblePersonal.length === 0 ? <EmptyState icon={StickyNote} title="No notes yet" hint={search ? "Try another search." : "Capture a teaching idea."} compact /> :
              <div className={"max-h-80 overflow-y-auto lg:max-h-[calc(100vh-15rem)] " + (viewMode === "grid" ? "grid grid-cols-2 gap-1 p-1" : "")}>{visiblePersonal.map((item) => <button key={item.id} type="button" aria-current={selectedPersonalId === item.id && !creating ? "true" : undefined} onClick={() => void selectPersonal(item)} className={"block min-w-0 w-full border-b border-line px-3 py-3 text-left hover:bg-surface-2 " + (selectedPersonalId === item.id && !creating ? "bg-accent-soft" : "")}><span className="block truncate text-sm font-semibold text-fg">{item.title}</span><span className="mt-1 block truncate text-xs text-fg-muted">{personalText(item) || "Empty note"}</span><span className="mt-1 block text-[11px] text-fg-faint">{dateLabel(item.updatedAt)}</span></button>)}</div>
            : visibleLearner.length === 0 ? <EmptyState icon={StickyNote} title="No learner notes" hint={search ? "Try another search." : "Write a note for a learner."} compact /> :
              <div className="max-h-80 overflow-y-auto lg:max-h-[calc(100vh-15rem)]">{visibleLearner.map((item) => <button key={item.id} type="button" aria-current={selectedLearnerId === item.id && !creating ? "true" : undefined} onClick={() => void selectLearner(item)} className={"block w-full border-b border-line px-3 py-3 text-left hover:bg-surface-2 " + (selectedLearnerId === item.id && !creating ? "bg-accent-soft" : "")}><span className="block truncate text-sm font-semibold text-fg">{item.title}</span><span className="mt-1 block truncate text-xs text-fg-muted">{item.student_name || item.student_email}</span><span className="mt-1 block text-[11px] text-fg-faint">{dateLabel(item.created_at)}</span></button>)}</div>}
        </section>
        <section aria-label="Note detail" className="min-h-80 min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          {actionError ? <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{actionError}</p> : null}
          {editing && tab === "personal" ? <form onSubmit={savePersonal} className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-fg">{creating ? "New note" : "Edit note"}</h2><span className="text-xs text-fg-faint">{personalDraft.body.trim().split(/\s+/).filter(Boolean).length} words</span></div>
            <label className="block text-sm font-medium text-fg">Title<input className="input mt-1 w-full" required maxLength={160} value={personalDraft.title} onChange={(event) => changePersonal("title", event.target.value)} /></label>
            <label className="block text-sm font-medium text-fg">Note<textarea className="input mt-1 min-h-48 w-full" required value={personalDraft.body} onChange={(event) => changePersonal("body", event.target.value)} /></label>
            <div><p className="mb-2 text-xs font-medium text-fg-muted">Style</p><div className="flex flex-wrap gap-2">{designOptions.map((option) => <button key={option.id} type="button" title={option.description} aria-pressed={personalDraft.design === option.id} onClick={() => changePersonal("design", option.id)} className={"rounded-lg border px-2.5 py-1 text-xs font-medium " + (personalDraft.design === option.id ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg")}>{option.label}</button>)}</div></div>
            <div className="border-t border-line pt-3"><label className="block text-sm font-medium text-fg">Media or link<input className="input mt-1 w-full" type="url" value={personalDraft.mediaUrl} onChange={(event) => changePersonal("mediaUrl", event.target.value)} placeholder="Optional HTTPS link" /></label>{personalDraft.mediaUrl && !safeMedia ? <p className="mt-1 text-xs text-danger">This link is not supported.</p> : null}<label className="mt-2 inline-block cursor-pointer text-xs font-medium text-accent hover:underline"><Paperclip size={14} className="mr-1 inline" />{uploading ? "Uploading…" : "Upload a file"}<input type="file" className="sr-only" disabled={uploading} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.csv" onChange={(event) => { void uploadMedia(event.target.files?.[0] || null); event.target.value = ""; }} /></label></div>
            <div className="flex justify-end gap-2 border-t border-line pt-3"><Button onClick={() => { setEditing(false); setCreating(false); setDirty(false); }}>Cancel</Button><Button type="submit" variant="primary" loading={saving} disabled={uploading}>Save note</Button></div>
          </form> : editing && tab === "learners" ? <form onSubmit={saveLearner} className="space-y-4">
            <h2 className="text-base font-semibold text-fg">{creating ? "New learner note" : "Edit learner note"}</h2>
            <label className="block text-sm font-medium text-fg">Learner<select className="input mt-1 w-full" required disabled={!creating} value={learnerDraft.studentKey} onChange={(event) => changeLearner("studentKey", event.target.value)}><option value="">Choose learner</option>{students.map((item) => <option key={item.class_id + item.id} value={item.class_id + ":" + item.id}>{item.full_name || item.email} · {item.class_name}</option>)}</select></label>
            <label className="block text-sm font-medium text-fg">Title<input className="input mt-1 w-full" required maxLength={160} value={learnerDraft.title} onChange={(event) => changeLearner("title", event.target.value)} /></label>
            <label className="block text-sm font-medium text-fg">Note<textarea className="input mt-1 min-h-44 w-full" required value={learnerDraft.body} onChange={(event) => changeLearner("body", event.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-fg">Visibility<select className="input mt-1 w-full" value={learnerDraft.visibility} onChange={(event) => changeLearner("visibility", event.target.value)}><option value="student">Learner visible</option><option value="teacher">Teacher only</option><option value="guardian">Learner / guardian</option></select></label><label className="block text-sm font-medium text-fg">Priority<select className="input mt-1 w-full" value={learnerDraft.priority} onChange={(event) => changeLearner("priority", event.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label></div>
            <div className="flex justify-end gap-2 border-t border-line pt-3"><Button onClick={() => { setEditing(false); setCreating(false); setDirty(false); }}>Cancel</Button><Button type="submit" variant="primary" loading={saving}>Save learner note</Button></div>
          </form> : tab === "personal" && selectedPersonal ? <div className="space-y-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-fg-faint">{dateLabel(selectedPersonal.updatedAt)} · {noteDesignPresetById(selectedPersonal.metadata.design, "clean").label}</p><h2 className="mt-1 break-words text-xl font-semibold text-fg">{selectedPersonal.title}</h2></div><Menu label="Note actions" items={[{ label: "Edit", onSelect: editNote }, { label: "Duplicate", icon: Copy, onSelect: () => void duplicatePersonal(selectedPersonal) }, { separator: true }, { label: "Archive", icon: Archive, danger: true, onSelect: () => void archivePersonal(selectedPersonal) }]} /></div>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-fg">{personalText(selectedPersonal)}</p>
            {selectedMedia ? <a href={selectedMedia.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"><Paperclip size={15} />Open attached {selectedMedia.kind}<ExternalLink size={13} /></a> : null}
          </div> : tab === "learners" && selectedLearner ? <div className="space-y-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-fg-faint">{selectedLearner.student_name || selectedLearner.student_email} · {dateLabel(selectedLearner.created_at)}</p><h2 className="mt-1 break-words text-xl font-semibold text-fg">{selectedLearner.title}</h2></div><Menu label="Learner note actions" items={[{ label: "Edit", onSelect: editNote }, { separator: true }, { label: "Delete", icon: Trash2, danger: true, onSelect: () => void deleteLearner(selectedLearner) }]} /></div>
            <div className="flex gap-2"><Badge>{selectedLearner.visibility}</Badge><Badge>{selectedLearner.priority}</Badge></div><p className="whitespace-pre-wrap break-words text-sm leading-7 text-fg">{selectedLearner.body}</p>
          </div> : <EmptyState icon={StickyNote} title="Choose a note" hint="Select one from the list or start a new note." action={<Button size="sm" onClick={() => void newNote()}>New note</Button>} />}
        </section>
      </div>
    </main>
  );
}
