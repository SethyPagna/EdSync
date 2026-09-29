"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { BookOpen, Copy, ExternalLink, Plus, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";
import OutlineComposer from "@/components/compose/OutlineComposer";
import { createCourseFromOutline } from "@/components/compose/api";
import { Badge, Button, EmptyState, Menu, PageHeader, Segmented, Sheet, Skeleton, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import { outlineFromText, type LessonOutline } from "@/lib/compose";
import { listStudioItems, type StudioServerItem } from "@/lib/studio/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Class, GlossaryTerm, Lesson, LessonSection, QuizQuestion } from "@/types";

type Status = "all" | "published" | "draft" | "archived";
const statusOptions: Array<{ value: Status; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

function asError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function TeacherLessons() {
  const router = useRouter();
  const confirm = useConfirm();
  const edsync = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [studioItems, setStudioItems] = useState<StudioServerItem[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newClassId, setNewClassId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to see your courses.");
      const [lessonResult, classResult, studioResult] = await Promise.all([
        edsync.from("lessons").select("*").eq("teacher_id", user.id).order("updated_at", { ascending: false }),
        edsync.from("classes").select("*").eq("teacher_id", user.id).eq("is_active", true).order("name"),
        listStudioItems(undefined, false).catch(() => []),
      ]);
      if (lessonResult.error) throw lessonResult.error;
      if (classResult.error) throw classResult.error;
      setLessons((lessonResult.data || []) as Lesson[]);
      setClasses((classResult.data || []) as Class[]);
      setStudioItems(studioResult.filter((item) => {
        const originalKind = item.metadata?.originalKind;
        const kind = typeof originalKind === "string" ? originalKind : item.kind;
        return ["doc", "slide", "design", "lesson"].includes(kind);
      }));
    } catch (cause) {
      setError(asError(cause));
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      const timer = window.setTimeout(() => setNewOpen(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const closeNew = () => {
    setNewOpen(false);
    if (new URLSearchParams(window.location.search).has("new")) router.replace("/teacher/lessons", { scroll: false });
  };

  const createFromOutline = async (outline: LessonOutline) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createCourseFromOutline({ outline, classId: newClassId || undefined });
      toast.success("Course created");
      closeNew();
      router.push("/teacher/lessons/" + result.lessonId);
    } catch (cause) {
      toast.error(asError(cause));
    } finally {
      setBusy(false);
    }
  };

  const createBlank = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to create a course.");
      const { data, error: insertError } = await edsync.from("lessons").insert({
        teacher_id: user.id,
        class_id: newClassId || null,
        title: "Untitled course",
        status: "draft",
      }).select("id").single();
      if (insertError || !data) throw insertError || new Error("Course was not created.");
      closeNew();
      router.push("/teacher/lessons/" + data.id);
    } catch (cause) {
      toast.error(asError(cause));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (lesson: Lesson, next: Lesson["status"]) => {
    const { error: updateError } = await edsync.from("lessons").update({ status: next }).eq("id", lesson.id);
    if (updateError) return toast.error(updateError.message);
    setLessons((current) => current.map((item) => item.id === lesson.id ? { ...item, status: next } : item));
    toast.success(next === "published" ? "Course published" : "Course moved to drafts");
  };

  const deleteLesson = async (lesson: Lesson) => {
    if (!await confirm({ title: "Delete " + lesson.title + "?", body: "This also removes its lessons and questions.", confirmLabel: "Delete course", danger: true })) return;
    const { error: deleteError } = await edsync.from("lessons").delete().eq("id", lesson.id);
    if (deleteError) return toast.error(deleteError.message);
    setLessons((current) => current.filter((item) => item.id !== lesson.id));
    toast.success("Course deleted");
  };

  const duplicateLesson = async (lesson: Lesson) => {
    if (busy) return;
    setBusy(true);
    let copyId: string | null = null;
    try {
      const [sectionResult, questionResult, glossaryResult] = await Promise.all([
        edsync.from("lesson_sections").select("*").eq("lesson_id", lesson.id).order("order_index"),
        edsync.from("quiz_questions").select("*").eq("lesson_id", lesson.id).order("order_index"),
        edsync.from("glossary_terms").select("*").eq("lesson_id", lesson.id),
      ]);
      if (sectionResult.error || questionResult.error || glossaryResult.error) {
        throw sectionResult.error || questionResult.error || glossaryResult.error;
      }
      const { id, created_at, updated_at, sections: embeddedSections, progress, ...rest } = lesson;
      void id; void created_at; void updated_at; void embeddedSections; void progress;
      const { data: copy, error: copyError } = await edsync.from("lessons").insert({
        ...rest,
        title: lesson.title + " (copy)",
        status: "draft",
      }).select("id").single();
      if (copyError || !copy) throw copyError || new Error("Could not duplicate course.");
      copyId = copy.id;
      const sectionIds = new Map<string, string>();
      const sections = ((sectionResult.data || []) as LessonSection[]).map((section) => {
        const newId = crypto.randomUUID();
        sectionIds.set(section.id, newId);
        const { created_at: oldCreated, ...fields } = section;
        void oldCreated;
        return { ...fields, id: newId, lesson_id: copy.id };
      });
      if (sections.length) {
        const { error: sectionError } = await edsync.from("lesson_sections").insert(sections);
        if (sectionError) throw sectionError;
      }
      const questions = ((questionResult.data || []) as QuizQuestion[]).map((question) => {
        const { created_at: oldCreated, ...fields } = question;
        void oldCreated;
        return { ...fields, id: crypto.randomUUID(), lesson_id: copy.id, section_id: question.section_id ? sectionIds.get(question.section_id) || null : null };
      });
      if (questions.length) {
        const { error: questionError } = await edsync.from("quiz_questions").insert(questions);
        if (questionError) throw questionError;
      }
      const terms = ((glossaryResult.data || []) as GlossaryTerm[]).map((term) => {
        const { created_at: oldCreated, ...fields } = term;
        void oldCreated;
        return { ...fields, id: crypto.randomUUID(), lesson_id: copy.id };
      });
      if (terms.length) {
        const { error: termError } = await edsync.from("glossary_terms").insert(terms);
        if (termError) throw termError;
      }
      toast.success("Course duplicated");
      await load();
    } catch (cause) {
      if (copyId) await edsync.from("lessons").delete().eq("id", copyId);
      toast.error(asError(cause));
    } finally {
      setBusy(false);
    }
  };

  const openInStudio = async (lesson: Lesson) => {
    try {
      const { data, error: sectionError } = await edsync.from("lesson_sections")
        .select("title, content").eq("lesson_id", lesson.id).order("order_index");
      if (sectionError) throw sectionError;
      const text = "# " + lesson.title + "\n\n" +
        ((data || []) as Array<{ title: string; content: string | null }>)
          .map((section) => "## " + section.title + "\n" + (section.content || "")).join("\n\n");
      const outline = outlineFromText(text, { title: lesson.title });
      outline.objectives = Array.isArray(lesson.objectives) ? lesson.objectives : [];
      sessionStorage.setItem("edsync-studio-import", JSON.stringify({ outline, title: lesson.title, lessonId: lesson.id }));
      router.push("/studio?import=1");
    } catch (cause) {
      toast.error(asError(cause));
    }
  };

  const filtered = lessons.filter((lesson) =>
    (status === "all" || lesson.status === status) &&
    (lesson.title + " " + (classes.find((item) => item.id === lesson.class_id)?.name || ""))
      .toLowerCase().includes(search.trim().toLowerCase()));
  const filteredStudio = studioItems.filter((item) =>
    (status === "all" || item.status === status) &&
    item.title.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <main className="page">
      <PageHeader title="Courses" icon={BookOpen} count={lessons.length + studioItems.length} actions={
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setNewOpen(true)}>New course</Button>
      } />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <Search aria-hidden size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input className="input w-full pl-9" aria-label="Search courses" placeholder="Search courses" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Segmented ariaLabel="Course status" value={status} onChange={setStatus} options={statusOptions} />
      </div>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      {loading ? <div className="space-y-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16" />)}</div> :
        filtered.length + filteredStudio.length === 0 ? <EmptyState icon={BookOpen} title={search ? "No matching courses" : "No courses yet"} hint={search ? "Try a different search." : "Create a course from a topic, notes, or a blank page."} /> :
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((lesson) => (
            <div key={lesson.id} className="flex min-w-0 items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:px-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><BookOpen size={18} /></span>
              <Link href={"/teacher/lessons/" + lesson.id} className="min-w-0 flex-1 hover:text-accent">
                <span className="block truncate text-sm font-semibold text-fg">{lesson.title}</span>
                <span className="block truncate text-xs text-fg-muted">{classes.find((item) => item.id === lesson.class_id)?.name || "No class"} · Updated {formatRelativeTime(lesson.updated_at)}</span>
              </Link>
              <Badge tone={lesson.status === "published" ? "success" : "neutral"} className="hidden capitalize sm:inline-flex">{lesson.status}</Badge>
              <Menu label={"Actions for " + lesson.title} items={[
                { label: "Open course", icon: ExternalLink, href: "/teacher/lessons/" + lesson.id },
                { label: "Open in Studio", icon: Sparkles, onSelect: () => void openInStudio(lesson) },
                { label: "Duplicate", icon: Copy, onSelect: () => void duplicateLesson(lesson), disabled: busy },
                { label: lesson.status === "published" ? "Move to drafts" : "Publish", icon: UploadCloud, onSelect: () => void changeStatus(lesson, lesson.status === "published" ? "draft" : "published") },
                { separator: true },
                { label: "Delete", icon: Trash2, danger: true, onSelect: () => void deleteLesson(lesson) },
              ]} />
            </div>
          ))}
          {filteredStudio.map((item) => (
            <div key={item.id} className="flex min-w-0 items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:px-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><Sparkles size={18} /></span>
              <Link href={"/studio?doc=" + encodeURIComponent(item.id)} className="min-w-0 flex-1 hover:text-accent">
                <span className="block truncate text-sm font-semibold text-fg">{item.title}</span>
                <span className="block truncate text-xs text-fg-muted">Studio · Updated {formatRelativeTime(item.updatedAt)}</span>
              </Link>
              <Badge className="hidden sm:inline-flex">Studio</Badge>
              <Menu label={"Actions for " + item.title} items={[{ label: "Open in Studio", icon: ExternalLink, href: "/studio?doc=" + encodeURIComponent(item.id) }]} />
            </div>
          ))}
        </div>
      }
      <Sheet open={newOpen} onClose={closeNew} title="Create course" description="Start with an outline or open a blank editor." size="lg">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-fg">Class
            <select className="input mt-1 w-full" value={newClassId} onChange={(event) => setNewClassId(event.target.value)}>
              <option value="">No class yet</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <OutlineComposer useLabel="Create course" onUse={createFromOutline} busy={busy} compact />
          <div className="border-t border-line pt-4"><Button onClick={() => void createBlank()} disabled={busy}>Start blank</Button></div>
        </div>
      </Sheet>
    </main>
  );
}
