"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import {
  Archive,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Paperclip,
  Plus,
  Save,
  StickyNote,
  Video,
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
import { Button, EmptyState, PageHeader, SearchInput, useConfirm } from "@/components/ui";

type TeacherNote = {
  id: string;
  title: string;
  body: string;
  priority: string;
  teacher_name: string | null;
  created_at: string;
};

type Attachment = {
  label: string;
  media: SafeMediaUrl;
};

type NoteDraft = {
  title: string;
  body: string;
  design: NoteDesignPresetId;
  attachments: Attachment[];
};

type UploadResponse = {
  data: { publicUrl: string; assetType: string; scanStatus: string } | null;
  error: { message: string } | null;
};

type FeedbackResponse = {
  data: TeacherNote[] | null;
  error: string | { message?: string } | null;
};

const designOptions = NOTE_DESIGN_PRESETS.filter((option) =>
  ["clean", "focus", "visual", "review"].includes(option.id),
);

function emptyDraft(): NoteDraft {
  return { title: "", body: "", design: "clean", attachments: [] };
}

function plainTextOf(note: StudioServerItem) {
  return note.plainText || (typeof note.content.body === "string" ? note.content.body : "");
}

function attachmentFrom(value: unknown): Attachment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const source = record.media && typeof record.media === "object"
    ? record.media as Record<string, unknown>
    : record;
  const media = classifySafeMediaUrl(typeof source.url === "string" ? source.url : "");
  if (!media) return null;
  return {
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : "Attachment",
    media,
  };
}

function attachmentsOf(note: StudioServerItem) {
  const stored = note.metadata.attachments;
  const raw = Array.isArray(stored) ? stored : note.metadata.media ? [note.metadata.media] : [];
  return raw.map(attachmentFrom).filter((item): item is Attachment => item !== null);
}

function draftFrom(note: StudioServerItem): NoteDraft {
  return {
    title: note.title,
    body: plainTextOf(note),
    design: noteDesignPresetById(note.metadata.design, "clean").id,
    attachments: attachmentsOf(note),
  };
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function attachmentIcon(media: SafeMediaUrl) {
  if (media.kind === "image") return ImageIcon;
  if (media.kind === "video") return Video;
  return FileText;
}

export default function StudentNotesPage() {
  const confirm = useConfirm();
  const [personalNotes, setPersonalNotes] = useState<StudioServerItem[]>([]);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = personalNotes.find((note) => note.id === selectedId) ?? null;
  const baseline = selected ? draftFrom(selected) : emptyDraft();
  const hasUnsavedChanges = editing && JSON.stringify(draft) !== JSON.stringify(baseline);
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return personalNotes;
    return personalNotes.filter((note) =>
      (note.title + " " + plainTextOf(note)).toLocaleLowerCase().includes(query),
    );
  }, [personalNotes, search]);

  const load = useCallback(async () => {
    const [personal, feedback] = await Promise.allSettled([
      listStudioItems("note"),
      fetch("/api/notes", { cache: "no-store", credentials: "include" }).then(async (response) => {
        const payload = await response.json() as FeedbackResponse;
        if (!response.ok || payload.error || !Array.isArray(payload.data)) {
          const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
          throw new Error(message || "Creator feedback could not be loaded.");
        }
        return payload.data;
      }),
    ]);

    if (personal.status === "fulfilled") {
      setPersonalNotes(personal.value);
      setSelectedId((current) => current && personal.value.some((note) => note.id === current)
        ? current
        : personal.value[0]?.id ?? null);
      setPersonalError(null);
    } else {
      setPersonalError(errorMessage(personal.reason, "Notes could not be loaded."));
    }

    if (feedback.status === "fulfilled") {
      setTeacherNotes(feedback.value);
      setFeedbackError(null);
    } else {
      setFeedbackError(errorMessage(feedback.reason, "Creator feedback could not be loaded."));
    }
    setLoading(false);
  }, []);

  const retry = () => {
    setLoading(true);
    void load();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const mayLeaveEditor = async () => {
    if (!hasUnsavedChanges) return true;
    return confirm({
      title: "Discard unsaved changes?",
      body: "This note has changes that have not been saved.",
      confirmLabel: "Discard changes",
      danger: true,
    });
  };

  const selectNote = async (note: StudioServerItem) => {
    if (note.id === selectedId && !creating) return;
    if (!(await mayLeaveEditor())) return;
    setSelectedId(note.id);
    setEditing(false);
    setCreating(false);
    setActionError(null);
  };

  const newNote = async () => {
    if (!(await mayLeaveEditor())) return;
    setDraft(emptyDraft());
    setAttachmentUrl("");
    setSelectedId(null);
    setEditing(true);
    setCreating(true);
    setActionError(null);
  };

  const cancelEdit = async () => {
    if (!(await mayLeaveEditor())) return;
    setEditing(false);
    setCreating(false);
    setActionError(null);
    if (!selectedId) setSelectedId(personalNotes[0]?.id ?? null);
  };

  const addLink = () => {
    const media = classifySafeMediaUrl(attachmentUrl.trim());
    if (!media) {
      setActionError("Use a safe HTTPS image, video, or reference link.");
      return;
    }
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.some((attachment) => attachment.media.url === media.url)
        ? current.attachments
        : [...current.attachments, { label: new URL(media.url).hostname, media }],
    }));
    setAttachmentUrl("");
    setActionError(null);
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setActionError(null);
    const uploaded: Attachment[] = [];
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        form.set("bucket", "notes");
        form.set("path", crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100));
        const response = await fetch("/api/storage/upload", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const payload = await response.json().catch(() => null) as UploadResponse | null;
        if (!response.ok || payload?.error || !payload?.data?.publicUrl) {
          throw new Error(payload?.error?.message || "Upload failed.");
        }
        const media = classifySafeMediaUrl(payload.data.publicUrl);
        if (!media) throw new Error("The uploaded file has no safe public link.");
        uploaded.push({ label: file.name, media });
      }
      toast.success(uploaded.length === 1 ? "Attachment added." : "Attachments added.");
    } catch (error) {
      setActionError(errorMessage(error, "Upload failed."));
    } finally {
      if (uploaded.length) {
        setDraft((current) => ({
          ...current,
          attachments: [
            ...current.attachments,
            ...uploaded.filter((item) => !current.attachments.some((old) => old.media.url === item.media.url)),
          ],
        }));
      }
      setUploading(false);
    }
  };

  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      setActionError("Add a title and note body first.");
      return;
    }
    setSaving(true);
    setActionError(null);
    const content = {
      type: "personal_note",
      body: draft.body.trim(),
      blocks: [
        { type: "paragraph", text: draft.body.trim() },
        ...draft.attachments.map(({ media }) => ({
          type: media.kind,
          url: media.url,
          embedUrl: media.embedUrl,
        })),
      ],
    };
    const metadata = {
      design: draft.design,
      attachments: draft.attachments.map(({ label, media }) => ({ label, media })),
      media: draft.attachments[0]?.media ?? null,
      source: "student_notes",
    };
    try {
      const saved = creating
        ? await saveStudioItem({
            kind: "note",
            title: draft.title.trim(),
            plainText: draft.body.trim(),
            status: "draft",
            content,
            metadata,
          })
        : await updateStudioItem({
            id: selectedId ?? "",
            title: draft.title.trim(),
            plainText: draft.body.trim(),
            status: "draft",
            content,
            metadata,
          });
      setPersonalNotes((current) => [saved, ...current.filter((note) => note.id !== saved.id)]);
      setSelectedId(saved.id);
      setEditing(false);
      setCreating(false);
      setAttachmentUrl("");
      toast.success(creating ? "Note created." : "Note saved.");
    } catch (error) {
      setActionError(errorMessage(error, "Note was not saved."));
    } finally {
      setSaving(false);
    }
  };

  const duplicateNote = async (note: StudioServerItem) => {
    setActionError(null);
    try {
      const copy = await saveStudioItem({
        kind: "note",
        title: note.title + " copy",
        plainText: plainTextOf(note),
        status: "draft",
        content: note.content,
        metadata: { ...note.metadata, duplicatedFrom: note.id, source: "student_notes" },
      });
      setPersonalNotes((current) => [copy, ...current]);
      setSelectedId(copy.id);
      toast.success("Note duplicated.");
    } catch (error) {
      setActionError(errorMessage(error, "Note was not duplicated."));
    }
  };

  const archiveNote = async (note: StudioServerItem) => {
    const approved = await confirm({
      title: "Archive " + note.title + "?",
      body: "The note will leave this workspace. You can restore it from draft history later.",
      confirmLabel: "Archive note",
      danger: true,
    });
    if (!approved) return;
    setActionError(null);
    try {
      await archiveStudioItem(note.id);
      const remaining = personalNotes.filter((item) => item.id !== note.id);
      setPersonalNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setEditing(false);
      setCreating(false);
      toast.success("Note archived.");
    } catch (error) {
      setActionError(errorMessage(error, "Note was not archived."));
    }
  };

  return (
    <div className="page-shell max-w-6xl">
      <PageHeader
        title="Notes"
        icon={StickyNote}
        count={personalNotes.length}
        actions={<Button variant="secondary" size="sm" icon={Plus} onClick={() => void newNote()}>New note</Button>}
      />

      {personalError ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <span>{personalError}</span>
          <Button size="sm" onClick={retry}>Retry</Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <section aria-label="Personal notes" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="border-b border-line p-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search notes" label="Search notes" shortcut="mod+k" className="sm:max-w-none" />
          </div>
          {loading && personalNotes.length === 0 ? (
            <div className="space-y-2 p-3" aria-label="Loading notes">
              {[1, 2, 3].map((item) => <div key={item} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : visibleNotes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title={search ? "No matching notes" : "No personal notes yet"}
              hint={search ? "Try another word." : "Capture an idea or study summary."}
              action={!search ? <Button size="sm" onClick={() => void newNote()}>Create note</Button> : undefined}
              compact
            />
          ) : (
            <div className="max-h-72 overflow-y-auto lg:max-h-[calc(100vh-15rem)]">
              {visibleNotes.map((note) => {
                const attachments = attachmentsOf(note);
                const active = note.id === selectedId && !creating;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => void selectNote(note)}
                    aria-current={active ? "true" : undefined}
                    className={"block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2 " +
                      (active ? "bg-accent-soft" : "")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{note.title}</span>
                      {attachments.length ? <Paperclip aria-label="Has attachments" className="size-3.5 shrink-0 text-fg-faint" /> : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-fg-muted">{plainTextOf(note) || "Empty note"}</span>
                    <span className="mt-1.5 block text-[11px] text-fg-faint">{dateLabel(note.updatedAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Note editor" className="min-h-96 min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
          {actionError ? (
            <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          {editing ? (
            <form onSubmit={(event) => void saveNote(event)} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-fg">{creating ? "New note" : "Edit note"}</h2>
                <span className="text-xs text-fg-faint">{draft.body.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-fg">
                <span>Title</span>
                <input
                  className="input w-full"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Give this note a title"
                  maxLength={160}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-fg">
                <span>Note</span>
                <textarea
                  className="textarea min-h-56 w-full resize-y leading-6"
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Write a summary, question, or idea…"
                  required
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium text-fg-muted">Style</p>
                <div className="flex flex-wrap gap-2">
                  {designOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={draft.design === option.id}
                      title={option.description}
                      onClick={() => setDraft((current) => ({ ...current, design: option.id }))}
                      className={"rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                        (draft.design === option.id
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-surface-2 text-fg-muted hover:text-fg")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 border-t border-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Paperclip className="size-4 text-fg-muted" />
                    Attachments
                    <span className="text-xs font-normal text-fg-faint">{draft.attachments.length}</span>
                  </h3>
                  <label htmlFor="note-file-upload" className="btn btn-secondary btn-sm cursor-pointer">
                    {uploading ? "Uploading…" : "Upload files"}
                  </label>
                  <input
                    id="note-file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    disabled={uploading}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.csv"
                    onChange={(event) => {
                      void uploadFiles(Array.from(event.currentTarget.files ?? []));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <div className="flex min-w-0 gap-2">
                  <input
                    className="input min-w-0 flex-1"
                    type="url"
                    aria-label="Attachment link"
                    placeholder="Paste an HTTPS link"
                    value={attachmentUrl}
                    onChange={(event) => setAttachmentUrl(event.target.value)}
                  />
                  <Button icon={Link2} size="sm" onClick={addLink} disabled={!attachmentUrl.trim()}>Add</Button>
                </div>
                {draft.attachments.length ? (
                  <ul className="space-y-1.5">
                    {draft.attachments.map((attachment) => {
                      const Icon = attachmentIcon(attachment.media);
                      return (
                        <li key={attachment.media.url} className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                          <Icon className="size-4 shrink-0 text-fg-muted" />
                          <span className="min-w-0 flex-1 truncate text-fg">{attachment.label}</span>
                          <button
                            type="button"
                            className="text-fg-muted hover:text-danger"
                            aria-label={"Remove " + attachment.label}
                            onClick={() => setDraft((current) => ({
                              ...current,
                              attachments: current.attachments.filter((item) => item.media.url !== attachment.media.url),
                            }))}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <Button onClick={() => void cancelEdit()} disabled={saving || uploading}>Cancel</Button>
                <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={uploading}>
                  {creating ? "Create note" : "Save changes"}
                </Button>
              </div>
            </form>
          ) : selected ? (
            <div className="space-y-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-fg-faint">{dateLabel(selected.updatedAt)} · {noteDesignPresetById(selected.metadata.design, "clean").label}</p>
                  <h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-fg">{selected.title}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => {
                    setDraft(draftFrom(selected));
                    setAttachmentUrl("");
                    setEditing(true);
                    setActionError(null);
                  }}>Edit</Button>
                  <Button size="sm" icon={Copy} aria-label="Duplicate note" title="Duplicate" onClick={() => void duplicateNote(selected)} />
                  <Button size="sm" icon={Archive} aria-label="Archive note" title="Archive" onClick={() => void archiveNote(selected)} />
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-fg">{plainTextOf(selected)}</p>
              {attachmentsOf(selected).length ? (
                <div className="border-t border-line pt-4">
                  <h3 className="mb-2 text-xs font-semibold text-fg-muted">Attachments</h3>
                  <div className="flex flex-wrap gap-2">
                    {attachmentsOf(selected).map((attachment) => {
                      const Icon = attachmentIcon(attachment.media);
                      return (
                        <a
                          key={attachment.media.url}
                          href={attachment.media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-fg hover:border-accent hover:text-accent"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{attachment.label}</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={StickyNote}
              title="Choose a note"
              hint="Open one from the list or start a new one."
              action={<Button size="sm" onClick={() => void newNote()}>New note</Button>}
            />
          )}
        </section>
      </div>

      <details className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-fg">
          Creator feedback
          <span className="text-xs font-normal text-fg-faint">{teacherNotes.length}</span>
        </summary>
        <div className="border-t border-line p-4">
          {feedbackError ? (
            <p role="alert" className="text-sm text-danger">{feedbackError} <button type="button" className="underline" onClick={retry}>Retry</button></p>
          ) : teacherNotes.length === 0 ? (
            <p className="text-sm text-fg-muted">No creator feedback yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {teacherNotes.map((note) => (
                <article key={note.id} className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-fg">{note.title}</h3>
                    <span className="shrink-0 text-[11px] text-fg-faint">{dateLabel(note.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{note.teacher_name || "Creator"} · {note.priority}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-fg">{note.body}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
