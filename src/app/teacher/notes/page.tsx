"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Archive,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Grid2X2,
  ImageIcon,
  Link2,
  List,
  LockKeyhole,
  Palette,
  Plus,
  Save,
  Send,
  StickyNote,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import {
  archiveStudioItem,
  listStudioItems,
  saveStudioItem,
  updateStudioItem,
  type StudioServerItem,
} from "@/lib/studio/api";
import {
  NOTE_DESIGN_PRESETS,
  noteDesignPresetById,
  type NoteDesignPresetId,
} from "@/lib/learning/creator-library";
import { classifySafeMediaUrl, type SafeMediaUrl } from "@/lib/security/media";
import { readViewMode, writeViewMode, type ViewMode } from "@/lib/ui/view-preferences";

type StudentRow = {
  id: string;
  full_name: string | null;
  email: string;
  class_id: string;
  class_name: string;
};
type Note = {
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
type PersonalDraft = {
  title: string;
  body: string;
  mediaUrl: string;
  design: NoteDesignPresetId;
};

type UploadResponse = {
  data: {
    publicUrl: string;
    assetType: string;
    scanStatus: string;
  } | null;
  error: { message: string } | null;
};

const emptyPersonalDraft: PersonalDraft = {
  title: "",
  body: "",
  mediaUrl: "",
  design: "clean",
};

const TEACHER_NOTES_VIEW_KEY = "edsync-teacher-notes-view-mode";

const designOptions = NOTE_DESIGN_PRESETS.filter((option) => ["clean", "planning", "feedback", "resource"].includes(option.id));

function visibilityIcon(value: string) {
  return value === "teacher" ? LockKeyhole : Eye;
}

function getPersonalMediaUrl(item: StudioServerItem) {
  if (typeof item.metadata.media !== "object" || !item.metadata.media) return "";
  return String((item.metadata.media as { url?: unknown }).url ?? "");
}

function getPersonalDesign(item: StudioServerItem): PersonalDraft["design"] {
  return noteDesignPresetById(item.metadata.design, "clean").id;
}

function personalNoteText(item: StudioServerItem) {
  return item.plainText || (typeof item.content.body === "string" ? item.content.body : "");
}

function mediaIcon(media: SafeMediaUrl | null) {
  if (media?.kind === "image") return ImageIcon;
  if (media?.kind === "video") return Video;
  return Link2;
}

export default function TeacherNotesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [personalNotes, setPersonalNotes] = useState<StudioServerItem[]>([]);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>(emptyPersonalDraft);
  const [editingPersonalId, setEditingPersonalId] = useState<string | null>(null);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode(TEACHER_NOTES_VIEW_KEY));
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    title: "",
    body: "",
    visibility: "student",
    priority: "normal",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/teacher/roster", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setStudents(payload.data?.students ?? []));
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setNotes(payload.data ?? []));
    listStudioItems("note")
      .then((items) => setPersonalNotes(items.filter((item) => item.metadata.source === "teacher_notes" || item.metadata.source === "student_notes" || !item.metadata.source)))
      .catch(() => setPersonalNotes([]));
  };

  useEffect(() => {
    load();
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    writeViewMode(TEACHER_NOTES_VIEW_KEY, mode);
  };

  const visibleCount = useMemo(() => notes.filter((note) => note.visibility !== "teacher").length, [notes]);
  const safePersonalMedia = useMemo(() => classifySafeMediaUrl(personalDraft.mediaUrl), [personalDraft.mediaUrl]);
  const selectedPersonalDesign = designOptions.find((option) => option.id === personalDraft.design) ?? designOptions[0];

  const resetForm = () => {
    setForm({ studentId: "", title: "", body: "", visibility: "student", priority: "normal" });
    setEditingId(null);
    setFormOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === form.studentId);
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch("/api/notes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        id: editingId ?? undefined,
        classId: editingId ? undefined : student?.class_id ?? null,
      }),
    });
    if (!response.ok) {
      toast.error("Note was not saved.");
      return;
    }
    toast.success(editingId ? "Note updated." : "Note saved.");
    resetForm();
    load();
  };

  const edit = (note: Note) => {
    setForm({
      studentId: note.student_id,
      title: note.title,
      body: note.body,
      visibility: note.visibility,
      priority: note.priority,
    });
    setEditingId(note.id);
    setFormOpen(true);
  };

  const remove = async (note: Note) => {
    const confirmed = window.confirm(`Delete "${note.title}"? This removes it for the teacher and student.`);
    if (!confirmed) return;
    const response = await fetch(`/api/notes?id=${encodeURIComponent(note.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      toast.error("Note was not deleted.");
      return;
    }
    toast.success("Note deleted.");
    load();
  };

  const resetPersonal = () => {
    setPersonalDraft(emptyPersonalDraft);
    setEditingPersonalId(null);
    setPersonalOpen(false);
  };

  const buildPersonalPayload = (media: SafeMediaUrl | null) => ({
    content: {
      type: "teacher_personal_note",
      body: personalDraft.body,
      blocks: [
        { type: "paragraph", text: personalDraft.body },
        ...(media ? [{ type: media.kind, url: media.url, embedUrl: media.embedUrl }] : []),
      ],
    },
    metadata: {
      design: personalDraft.design,
      media,
      source: "teacher_notes",
    },
  });

  const savePersonalNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!personalDraft.title.trim() || !personalDraft.body.trim()) {
      toast.error("Add a title and note body first.");
      return;
    }
    if (personalDraft.mediaUrl.trim() && !safePersonalMedia) {
      toast.error("Use a safe HTTPS image, video, YouTube, Vimeo, or normal link.");
      return;
    }
    setSavingPersonal(true);
    try {
      const payload = buildPersonalPayload(safePersonalMedia);
      if (editingPersonalId) {
        await updateStudioItem({
          id: editingPersonalId,
          title: personalDraft.title,
          plainText: personalDraft.body,
          status: "draft",
          ...payload,
        });
      } else {
        await saveStudioItem({
          kind: "note",
          title: personalDraft.title,
          plainText: personalDraft.body,
          status: "draft",
          ...payload,
        });
      }
      toast.success(editingPersonalId ? "Creator note updated." : "Creator note saved.");
      resetPersonal();
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator note was not saved.");
    } finally {
      setSavingPersonal(false);
    }
  };

  const uploadPersonalMedia = async (file: File | null) => {
    if (!file) return;
    setUploadingPersonal(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("bucket", "teacher-notes");
      formData.set("path", `${Date.now()}-${file.name}`);
      const response = await fetch("/api/storage/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as UploadResponse | null;
      if (!response.ok || payload?.error || !payload?.data?.publicUrl) {
        throw new Error(payload?.error?.message || "Upload failed.");
      }
      setPersonalDraft((current) => ({ ...current, mediaUrl: payload.data?.publicUrl ?? current.mediaUrl }));
      toast.success(`${payload.data.assetType} uploaded and scanned.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingPersonal(false);
    }
  };

  const editPersonal = (note: StudioServerItem) => {
    setPersonalDraft({
      title: note.title,
      body: personalNoteText(note),
      mediaUrl: getPersonalMediaUrl(note),
      design: getPersonalDesign(note),
    });
    setEditingPersonalId(note.id);
    setPersonalOpen(true);
  };

  const duplicatePersonal = async (note: StudioServerItem) => {
    const media = classifySafeMediaUrl(getPersonalMediaUrl(note));
    try {
      await saveStudioItem({
        kind: "note",
        title: `${note.title} copy`,
        plainText: personalNoteText(note),
        status: "draft",
        content: note.content,
        metadata: {
          ...note.metadata,
          media,
          duplicatedFrom: note.id,
          source: "teacher_notes",
        },
      });
      toast.success("Creator note duplicated.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator note was not duplicated.");
    }
  };

  const archivePersonal = async (note: StudioServerItem) => {
    const confirmed = window.confirm(`Archive "${note.title}"?`);
    if (!confirmed) return;
    try {
      await archiveStudioItem(note.id);
      toast.success("Creator note archived.");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator note was not archived.");
    }
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
              Notes workspace
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Notes</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {personalNotes.length} creator drafts, {notes.length} learner notes, {visibleCount} shared.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {formOpen && (
              <button type="button" onClick={resetForm} className="btn-secondary justify-center">
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
            <button type="button" onClick={() => setFormOpen(true)} className="btn-primary justify-center">
              <Plus className="h-4 w-4" />
              Learner note
            </button>
            <button type="button" onClick={() => setPersonalOpen(true)} className="btn-secondary justify-center">
              <StickyNote className="h-4 w-4" />
              Creator note
            </button>
          </div>
        </div>
      </section>

      {personalOpen && (
        <form onSubmit={savePersonalNote} className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">
                {editingPersonalId ? "Edit creator note" : "New creator note"}
              </h2>
              <p className="text-sm text-edsync-subtle">
                Save lesson ideas, references, media, links, and planning notes as editable drafts.
              </p>
            </div>
            <Palette className="h-5 w-5 text-edsync-amber" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3">
              <input
                className="edsync-input"
                value={personalDraft.title}
                onChange={(event) => setPersonalDraft({ ...personalDraft, title: event.target.value })}
                placeholder="Creator note title"
                required
              />
              <textarea
                className="edsync-input min-h-32"
                value={personalDraft.body}
                onChange={(event) => setPersonalDraft({ ...personalDraft, body: event.target.value })}
                placeholder="Plan, reference, link, rubric idea, media note, or follow-up..."
                required
              />
              <input
                className="edsync-input"
                value={personalDraft.mediaUrl}
                onChange={(event) => setPersonalDraft({ ...personalDraft, mediaUrl: event.target.value })}
                placeholder="Optional HTTPS image, video, YouTube, Vimeo, or reference link"
              />
              <label className="flex flex-col gap-2 rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-4 text-sm text-edsync-subtle sm:flex-row sm:items-center sm:justify-between">
                  <span>
                  <span className="font-semibold text-edsync-text">Upload media</span>
                  <span className="block text-xs">Attach safe references, examples, videos, PDFs, or source docs.</span>
                </span>
                <span className="btn-secondary w-fit px-3 py-2 text-sm">
                  <UploadCloud className="h-4 w-4" />
                  {uploadingPersonal ? "Uploading..." : "Choose file"}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  disabled={uploadingPersonal}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.csv"
                  onChange={(event) => {
                    void uploadPersonalMedia(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <aside className={`rounded-2xl border p-4 ${selectedPersonalDesign.className}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Design</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {designOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPersonalDraft({ ...personalDraft, design: option.id })}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      personalDraft.design === option.id
                        ? "border-edsync-amber bg-edsync-amber text-white"
                        : "border-edsync-border bg-edsync-surface text-edsync-subtle"
                    }`}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-edsync-border bg-edsync-card p-3">
                <p className="font-display text-lg font-bold">{personalDraft.title || "Preview title"}</p>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-edsync-subtle">
                  {personalDraft.body || "Preview"}
                </p>
                {personalDraft.mediaUrl && (
                  <p className={`mt-3 text-xs font-semibold ${safePersonalMedia ? "text-edsync-emerald" : "text-rose-600"}`}>
                    {safePersonalMedia ? `Safe ${safePersonalMedia.kind} detected` : "Unsupported or unsafe URL"}
                  </p>
                )}
              </div>
              <button type="submit" disabled={savingPersonal} className="btn-primary mt-4 w-full justify-center">
                <Save className="h-4 w-4" />
                {savingPersonal ? "Saving..." : "Save"}
              </button>
            </aside>
          </div>
        </form>
      )}

      {formOpen && (
        <form onSubmit={save} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="group mb-3">
            <h2 className="font-display text-lg font-bold">{editingId ? "Edit feedback note" : "New feedback note"}</h2>
            <p className="edsync-hover-detail">
              Shared notes appear in the learner's personal notes workspace when visibility allows it.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="edsync-input"
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
              disabled={Boolean(editingId)}
              required
            >
              <option value="">Learner</option>
              {students.map((student) => (
                <option key={`${student.class_id}-${student.id}`} value={student.id}>
                  {student.full_name || student.email} / {student.class_name}
                </option>
              ))}
            </select>
            <input
              className="edsync-input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Title"
              required
            />
            <select
              className="edsync-input"
              value={form.visibility}
              onChange={(event) => setForm({ ...form, visibility: event.target.value })}
            >
              <option value="student">Learner visible</option>
              <option value="teacher">Creator only</option>
              <option value="guardian">Learner/guardian</option>
            </select>
            <select
              className="edsync-input"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <textarea
              className="edsync-input min-h-24 md:col-span-3"
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              placeholder="Note..."
              required
            />
            <button className="btn-primary justify-center" type="submit">
              <Send className="h-4 w-4" />
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="group">
              <h2 className="font-display text-xl font-bold">Creator notes</h2>
              <p className="edsync-hover-detail">Planning notes, links, media, and lesson ideas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-xl border border-edsync-border bg-edsync-card p-1">
                {[
                  { mode: "grid" as const, label: "Grid", icon: Grid2X2 },
                  { mode: "list" as const, label: "List", icon: List },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => changeViewMode(item.mode)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                        viewMode === item.mode ? "bg-edsync-amber text-white" : "text-edsync-subtle hover:text-edsync-text"
                      }`}
                      aria-label={`${item.label} view`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setPersonalOpen(true)} className="btn-secondary px-3 py-2 text-sm">
                New note
              </button>
            </div>
          </div>
          {personalNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-8 text-center">
              <StickyNote className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No creator notes yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">Start with one note.</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid gap-3 md:grid-cols-2" : "grid gap-3"}>
              {personalNotes.map((note) => {
                const media = classifySafeMediaUrl(getPersonalMediaUrl(note));
                const Icon = mediaIcon(media);
                return (
                  <article key={note.id} className="premium-card rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="badge bg-edsync-amber/10 text-edsync-amber">teacher</span>
                          <span className="badge bg-edsync-blue/10 text-edsync-blue">{String(note.metadata.design ?? "clean")}</span>
                        </div>
                        <h3 className="truncate font-display text-lg font-bold">{note.title}</h3>
                      </div>
                      {media && <Icon className="h-5 w-5 text-edsync-blue" />}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-edsync-subtle">{personalNoteText(note)}</p>
                    {media && (
                      <a href={media.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                        Open {media.kind}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => editPersonal(note)}>
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => duplicatePersonal(note)}>
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </button>
                      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => archivePersonal(note)}>
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="group">
            <h2 className="font-display text-xl font-bold">Learner notes</h2>
            <p className="edsync-hover-detail">Shared or private learner notes.</p>
          </div>
          <div className="rounded-2xl border border-edsync-border bg-edsync-card">
        <div className="divide-y divide-edsync-border">
          {notes.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No notes yet.</p>
          ) : (
            notes.map((note) => {
              const Icon = visibilityIcon(note.visibility);
              return (
                <article key={note.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">{note.visibility}</span>
                      <span className="badge bg-edsync-amber/10 text-edsync-amber">{note.priority}</span>
                    </div>
                    <h2 className="truncate font-display text-lg font-bold">{note.title}</h2>
                    <p className="mt-1 text-sm text-edsync-subtle">
                      {note.student_name || note.student_email}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6">{note.body}</p>
                  </div>
                  <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
                    <p className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-edsync-blue" />
                      {note.visibility}
                    </p>
                    <p className="mt-2 flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-edsync-amber" />
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs" onClick={() => edit(note)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs text-edsync-red" onClick={() => remove(note)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
