"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, StickyNote } from "lucide-react";
import { listStudioItems, saveStudioItem, updateStudioItem, type StudioServerItem } from "@/lib/studio/api";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import type { LessonSection } from "@/types";

export default function NotesTool({ lessonId, lessonTitle, section }: { lessonId: string; lessonTitle: string; section: LessonSection | undefined }) {
  const [notes, setNotes] = useState<StudioServerItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await listStudioItems("note");
      setNotes(items.filter((item) => item.sourceType === "lesson" && item.sourceId === lessonId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notes could not load.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const note = notes.find((item) => item.metadata.sectionId === section?.id);
  const body = section ? drafts[section.id] ?? note?.plainText ?? "" : "";

  const save = async () => {
    if (!section || !body.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: `${lessonTitle} · ${section.title}`,
        plainText: body.trim(),
        content: { type: "personal_note", body: body.trim(), blocks: [{ type: "paragraph", text: body.trim() }] },
        metadata: { ...(note?.metadata ?? {}), source: "lesson_player", sectionId: section.id },
      };
      const saved = note
        ? await updateStudioItem({ id: note.id, ...payload })
        : await saveStudioItem({ kind: "note", status: "draft", sourceType: "lesson", sourceId: lessonId, ...payload });
      setNotes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-10" /></div>;
  if (error && !notes.length) return <div role="alert" className="space-y-3 text-sm text-danger">{error}<div><Button onClick={() => void reload()}>Retry</Button></div></div>;
  if (!section) return <EmptyState icon={StickyNote} title="Choose a section" compact />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">{section.title}</p>
      <textarea aria-label="Lesson note" className="textarea min-h-44 w-full" placeholder="Capture an idea or question" value={body} onChange={(event) => setDrafts((current) => ({ ...current, [section.id]: event.target.value }))} />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fg-faint">Saved with your notes</span>
        <Button icon={Save} variant="primary" onClick={() => void save()} loading={saving} disabled={!body.trim() || body.trim() === (note?.plainText ?? "")}>Save note</Button>
      </div>
    </div>
  );
}
