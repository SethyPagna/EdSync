"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ExternalLink, ImageIcon, Link2, Palette, Plus, Save, StickyNote, Video } from "lucide-react";
import { listStudioItems, saveStudioItem, type StudioServerItem } from "@/lib/studio/api";
import { classifySafeMediaUrl, type SafeMediaUrl } from "@/lib/security/media";

type TeacherNote = {
  id: string;
  title: string;
  body: string;
  priority: string;
  teacher_name: string | null;
  created_at: string;
};

type NoteDraft = {
  title: string;
  body: string;
  mediaUrl: string;
  design: "clean" | "focus" | "visual" | "review";
};

const emptyDraft: NoteDraft = {
  title: "",
  body: "",
  mediaUrl: "",
  design: "clean",
};

const designOptions: Array<{ id: NoteDraft["design"]; label: string; className: string }> = [
  { id: "clean", label: "Clean", className: "border-edsync-border bg-edsync-card" },
  { id: "focus", label: "Focus", className: "border-edsync-blue/30 bg-edsync-blue/10" },
  { id: "visual", label: "Visual", className: "border-edsync-emerald/30 bg-edsync-emerald/10" },
  { id: "review", label: "Review", className: "border-edsync-amber/30 bg-edsync-amber/10" },
];

function mediaIcon(media: SafeMediaUrl | null) {
  if (media?.kind === "image") return ImageIcon;
  if (media?.kind === "video") return Video;
  return Link2;
}

function plainTextOf(item: StudioServerItem) {
  return item.plainText || (typeof item.content.body === "string" ? item.content.body : "");
}

export default function StudentNotesPage() {
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([]);
  const [personalNotes, setPersonalNotes] = useState<StudioServerItem[]>([]);
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const safeMedia = useMemo(() => classifySafeMediaUrl(draft.mediaUrl), [draft.mediaUrl]);
  const selectedDesign = designOptions.find((option) => option.id === draft.design) ?? designOptions[0];

  const load = () => {
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setTeacherNotes(payload.data ?? []));
    listStudioItems("note")
      .then(setPersonalNotes)
      .catch(() => setPersonalNotes([]));
  };

  useEffect(() => {
    load();
  }, []);

  const createPersonalNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Add a title and note body first.");
      return;
    }
    if (draft.mediaUrl.trim() && !safeMedia) {
      toast.error("Use a safe HTTPS image, video, YouTube, Vimeo, or normal link.");
      return;
    }

    setSaving(true);
    try {
      await saveStudioItem({
        kind: "note",
        title: draft.title,
        plainText: draft.body,
        status: "draft",
        content: {
          type: "personal_note",
          body: draft.body,
          blocks: [
            { type: "paragraph", text: draft.body },
            ...(safeMedia ? [{ type: safeMedia.kind, url: safeMedia.url, embedUrl: safeMedia.embedUrl }] : []),
          ],
        },
        metadata: {
          design: draft.design,
          media: safeMedia,
          source: "student_notes",
        },
      });
      toast.success("Personal note saved.");
      setDraft(emptyDraft);
      setComposerOpen(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Note was not saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">Personal workspace</p>
            <h1 className="mt-1 font-display text-3xl font-bold">Notes</h1>
            <p className="mt-1 max-w-2xl text-sm text-edsync-subtle">
              Save personal notes with designs, images, video links, references, and teacher feedback in one place.
            </p>
          </div>
          <button type="button" className="btn-primary justify-center" onClick={() => setComposerOpen((value) => !value)}>
            <Plus className="h-4 w-4" />
            {composerOpen ? "Close" : "New note"}
          </button>
        </div>
      </section>

      {composerOpen && (
        <form onSubmit={createPersonalNote} className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Quick note builder</h2>
              <p className="text-sm text-edsync-subtle">Personal notes are saved as Studio drafts so you can expand them later.</p>
            </div>
            <Palette className="h-5 w-5 text-edsync-blue" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3">
              <input
                className="edsync-input"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Note title"
                required
              />
              <textarea
                className="edsync-input min-h-36"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                placeholder="Write your note, summary, study idea, question, or reflection..."
                required
              />
              <input
                className="edsync-input"
                value={draft.mediaUrl}
                onChange={(event) => setDraft({ ...draft, mediaUrl: event.target.value })}
                placeholder="Optional HTTPS image, video, YouTube, Vimeo, or reference link"
              />
            </div>
            <aside className={`rounded-2xl border p-4 ${selectedDesign.className}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Design</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {designOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, design: option.id })}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      draft.design === option.id
                        ? "border-edsync-blue bg-edsync-blue text-white"
                        : "border-edsync-border bg-edsync-surface text-edsync-subtle"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-edsync-border bg-edsync-card p-3">
                <p className="font-display text-lg font-bold">{draft.title || "Preview title"}</p>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-edsync-subtle">
                  {draft.body || "Your note preview will appear here."}
                </p>
                {draft.mediaUrl && (
                  <p className={`mt-3 text-xs font-semibold ${safeMedia ? "text-edsync-emerald" : "text-rose-600"}`}>
                    {safeMedia ? `Safe ${safeMedia.kind} detected` : "Unsupported or unsafe URL"}
                  </p>
                )}
              </div>
              <button type="submit" disabled={saving} className="btn-primary mt-4 w-full justify-center">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save note"}
              </button>
            </aside>
          </div>
        </form>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Personal notes</h2>
              <p className="text-sm text-edsync-subtle">{personalNotes.length} Studio note drafts</p>
            </div>
            <Link href="/studio?tab=notes" className="btn-secondary px-3 py-2 text-sm">
              Open Studio
            </Link>
          </div>
          {personalNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-8 text-center">
              <StickyNote className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No personal notes yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">Create one with text, media, links, or design style.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {personalNotes.map((note) => {
                const media = classifySafeMediaUrl(
                  typeof note.metadata.media === "object" && note.metadata.media
                    ? String((note.metadata.media as { url?: unknown }).url ?? "")
                    : "",
                );
                const Icon = mediaIcon(media);
                return (
                  <article key={note.id} className="premium-card rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="badge bg-edsync-emerald/10 text-edsync-emerald">personal</span>
                          <span className="badge bg-edsync-blue/10 text-edsync-blue">{String(note.metadata.design ?? "clean")}</span>
                        </div>
                        <h3 className="truncate font-display text-lg font-bold">{note.title}</h3>
                      </div>
                      {media && <Icon className="h-5 w-5 text-edsync-blue" />}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-edsync-subtle">{plainTextOf(note)}</p>
                    {media && (
                      <a href={media.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                        Open attached {media.kind}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-bold">Teacher feedback</h2>
            <p className="text-sm text-edsync-subtle">Notes shared by your teachers.</p>
          </div>
          {teacherNotes.length === 0 ? (
            <p className="rounded-2xl border border-edsync-border bg-edsync-card p-4 text-sm text-edsync-subtle">
              No teacher feedback notes yet.
            </p>
          ) : (
            teacherNotes.map((note) => (
              <article key={note.id} className="rounded-2xl border border-edsync-border bg-edsync-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold">{note.title}</h3>
                  <span className="text-xs text-edsync-subtle">{new Date(note.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-edsync-subtle">
                  {note.teacher_name || "Teacher"} / {note.priority}
                </p>
                <p className="mt-3 text-sm leading-6">{note.body}</p>
              </article>
            ))
          )}
        </aside>
      </section>
    </div>
  );
}
