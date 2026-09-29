"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import {
  SECTION_TEMPLATES,
  type SectionTemplate,
} from "@/lib/content/section-library";
import { QuestionBuilder, emptyQ, toQuestionDraft, type QDraft } from "@/components/lesson/editor/QuestionBuilder";
import { SectionEditor } from "@/components/lesson/editor/SectionEditor";
import { GlossaryEditCard } from "@/components/lesson/editor/GlossaryEditCard";
import { persistQuestions } from "@/components/lesson/editor/persistQuestions";
import { SectionOutline } from "@/components/lesson/editor/SectionOutline";
import { SectionInspector } from "@/components/lesson/editor/SectionInspector";
import { normalizeLessonAuthoringContent } from "@/lib/content/section-library";
import { outlineFromText, type LessonOutline, type OutlineQuestion } from "@/lib/compose";
import { Button, EmptyState, PageHeader, Sheet, Tabs, useConfirm } from "@/components/ui";
import { BookOpen, BookOpenCheck, CircleAlert, Eye, FileText, Layers3, PanelLeft, Plus, Settings2, Share2, Sparkles, Trash2 } from "lucide-react";
import type {
  Lesson,
  LessonSection,
  QuizQuestion,
  GlossaryTerm,
  Class,
  DifficultyLevel,
} from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { scopedClassHref } from "@/lib/classes/class-scope";
import toast from "react-hot-toast";

type Tab = "content" | "quiz" | "glossary" | "settings";
type AssignmentRow = {
  class_id: string;
  classes?: { name?: string | null } | null;
  created_at: string;
};
// Main page
export default function TeacherLessonDetail() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const lessonId = params.id as string;
  const edsync = useMemo(() => createClient(), []);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qDrafts, setQDrafts] = useState<QDraft[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [tab, setTab] = useState<Tab>("content");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<
    { class_id: string; class_name: string; created_at: string }[]
  >([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Controlled overview
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(45);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [complexity, setComplexity] = useState(50);
  const [pacing, setPacing] = useState(50);
  const [scaffolding, setScaffolding] = useState(50);
  const [overviewDirty, setOverviewDirty] = useState(false);

  // Glossary editing
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(
    null,
  );
  const [newTerm, setNewTerm] = useState({
    term: "",
    definition: "",
    example: "",
  });
  const [addingTerm, setAddingTerm] = useState(false);

  // Questions saving
  const [savingQ, setSavingQ] = useState(false);

  const loadAll = useCallback(async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) { setActionError("Sign in to edit this course."); setLoading(false); return; }

    const [
      lessonRes,
      sectionsRes,
      questionsRes,
      glossaryRes,
      classesRes,
      assignRes,
    ] = await Promise.all([
      edsync.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
      edsync
        .from("lesson_sections")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index"),
      edsync
        .from("quiz_questions")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index"),
      edsync
        .from("glossary_terms")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at"),
      edsync
        .from("classes")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("is_active", true)
        .order("name"),
      edsync
        .from("lesson_assignments")
        .select("class_id, created_at, classes(name)")
        .eq("lesson_id", lessonId)
        .eq("is_active", true),
    ]);

    const loadFailure = [lessonRes, sectionsRes, questionsRes, glossaryRes, classesRes, assignRes].find((result) => result.error);
    if (loadFailure?.error) setActionError(loadFailure.error.message);

    const l = lessonRes.data;
    if (l) {
      setLesson(l);
      setTitle(l.title || "");
      setDescription(l.description || "");
      setSubject(l.subject || "");
      setDuration(l.estimated_duration || 45);
      setDifficulty(l.difficulty || "intermediate");
      setObjectives(l.objectives || []);
      setComplexity(l.complexity_slider ?? 50);
      setPacing(l.pacing_slider ?? 50);
      setScaffolding(l.scaffolding_slider ?? 50);
    }
    setSections(sectionsRes.data || []);
    setEditingSectionId((current) => current || sectionsRes.data?.[0]?.id || null);
    const qs: QuizQuestion[] = questionsRes.data || [];
    setQuestions(qs);
    // Only load page-independent questions into the question bank drafts
    setQDrafts(
      qs
        .filter((q) => !q.section_id || q.section_id === null)
        .map(toQuestionDraft),
    );
    setGlossary(glossaryRes.data || []);
    setMyClasses(classesRes.data || []);
    setAssignments(
      ((assignRes.data || []) as AssignmentRow[]).map((a) => ({
        class_id: a.class_id,
        class_name: a.classes?.name || "",
        created_at: a.created_at,
      })),
    );
    setLoading(false);
  }, [edsync, lessonId]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadAll]);

  const saveOverview = async () => {
    if (!title.trim()) { setActionError("Course title is required."); return false; }
    if (!Number.isFinite(duration) || duration < 1) { setActionError("Duration must be at least one minute."); return false; }
    setSaving(true);
    setActionError("");
    const updates = {
      title: title.trim(),
      description: description.trim(),
      subject: subject.trim(),
      estimated_duration: duration,
      difficulty,
      objectives: objectives.filter(Boolean),
      complexity_slider: complexity,
      pacing_slider: pacing,
      scaffolding_slider: scaffolding,
    };
    const { error } = await edsync
      .from("lessons")
      .update(updates)
      .eq("id", lessonId);
    if (error) setActionError("Save failed: " + error.message);
    else {
      setLesson((l) => (l ? { ...l, ...updates } : l));
      setOverviewDirty(false);
      toast.success("Saved!");
    }
    setSaving(false);
    return !error;
  };

  const changeStatus = async (status: "draft" | "published" | "archived") => {
    if (overviewDirty && !(await saveOverview())) return false;
    setActionError("");
    const { error } = await edsync.from("lessons").update({ status }).eq("id", lessonId);
    if (error) { setActionError(error.message); return false; }
    setLesson((l) => (l ? { ...l, status } : l));
    toast.success(
      status === "published"
        ? " Published!"
        : status === "draft"
          ? "Moved to draft"
          : "Archived",
    );
    return true;
  };

  const saveSection = async (
    sectionId: string,
    updates: Partial<LessonSection>,
  ) => {
    const { error } = await edsync
      .from("lesson_sections")
      .update(updates)
      .eq("id", sectionId);
    if (error) {
      setActionError("Block save failed: " + error.message);
      return;
    }
    setSections((s) =>
      s.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec)),
    );
    setActionError("");
    toast.success("Block saved!");
  };

  const persistSectionOrder = async (nextSections: LessonSection[]) => {
    const results = await Promise.all(
      nextSections.map((section, index) =>
        edsync
          .from("lesson_sections")
          .update({ order_index: index })
          .eq("id", section.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
  };

  const addSection = async (template: SectionTemplate = SECTION_TEMPLATES[0]) => {
    const { data, error } = await edsync
      .from("lesson_sections")
      .insert({
        lesson_id: lessonId,
        title: template.title,
        content: template.content,
        content_type: template.contentType,
        order_index: sections.length,
        duration_minutes: template.durationMinutes,
        metadata: { template_id: template.id, template_category: template.category },
      })
      .select()
      .single();
    if (error) {
      toast.error("Could not add block");
      return;
    }
    setSections((s) => [...s, data]);
    setEditingSectionId(data.id);
  };

  const reorderSections = async (nextSections: LessonSection[]) => {
    const ordered = nextSections.map((section, index) => ({ ...section, order_index: index }));
    const previous = sections;
    setSections(ordered);
    try { await persistSectionOrder(ordered); }
    catch (caught) { setSections(previous); setActionError(caught instanceof Error ? caught.message : "Order was not saved."); }
  };

  const duplicateSection = async (section: LessonSection) => {
    const insertIndex = sections.findIndex((item) => item.id === section.id) + 1;
    const { data, error } = await edsync
      .from("lesson_sections")
      .insert({
        lesson_id: lessonId,
        title: `${section.title} Copy`,
        content: section.content || "",
        content_type: section.content_type,
        order_index: insertIndex,
        duration_minutes: section.duration_minutes,
        metadata: { ...(section.metadata || {}), duplicated_from: section.id },
      })
      .select()
      .single();

    if (error) {
      toast.error("Could not duplicate block");
      return;
    }

    const nextSections = [
      ...sections.slice(0, insertIndex),
      data,
      ...sections.slice(insertIndex),
    ].map((item, index) => ({ ...item, order_index: index }));

    setSections(nextSections);
    try { await persistSectionOrder(nextSections); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : "Order was not saved."); }
    setEditingSectionId(data.id);
    toast.success("Block duplicated");
  };

  const deleteSection = async (id: string) => {
    const { error } = await edsync.from("lesson_sections").delete().eq("id", id);
    if (error) { setActionError(error.message); return; }
    const nextSections = sections
      .filter((sec) => sec.id !== id)
      .map((section, index) => ({ ...section, order_index: index }));
    setSections(nextSections);
    try { await persistSectionOrder(nextSections); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : "Order was not saved."); }
    setEditingSectionId(null);
    toast.success("Block deleted");
  };

  // Glossary ops
  const addGlossaryTerm = async () => {
    if (!newTerm.term.trim() || !newTerm.definition.trim()) {
      toast.error("Term and definition required");
      return;
    }
    const { data, error } = await edsync
      .from("glossary_terms")
      .insert({ lesson_id: lessonId, ...newTerm })
      .select()
      .single();
    if (error) {
      toast.error("Could not add term");
      return;
    }
    setGlossary((g) => [...g, data]);
    setNewTerm({ term: "", definition: "", example: "" });
    setAddingTerm(false);
    toast.success("Term added!");
  };

  const updateGlossaryTerm = async (
    id: string,
    updates: Partial<GlossaryTerm>,
  ) => {
    const { error } = await edsync.from("glossary_terms").update(updates).eq("id", id);
    if (error) { setActionError(error.message); return; }
    setGlossary((g) => g.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    setEditingGlossaryId(null);
    toast.success("Term updated");
  };

  const deleteGlossaryTerm = async (id: string) => {
    const { error } = await edsync.from("glossary_terms").delete().eq("id", id);
    if (error) { setActionError(error.message); return; }
    setGlossary((g) => g.filter((t) => t.id !== id));
    toast.success("Term removed");
  };

  // Questions save
  const saveQuestions = async () => {
    setSavingQ(true);
    setActionError("");
    try {
      await persistQuestions({
        edsync,
        lessonId,
        sectionId: null,
        drafts: qDrafts,
        savedIds: questions.filter((question) => !question.section_id).map((question) => question.id),
      });
      const { data, error } = await edsync.from("quiz_questions").select("*").eq("lesson_id", lessonId).order("order_index");
      if (error) throw new Error(error.message);
      const next = (data || []) as QuizQuestion[];
      setQuestions(next);
      setQDrafts(next.filter((question) => !question.section_id).map(toQuestionDraft));
      toast.success("Questions saved!");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Questions were not saved.");
    } finally {
      setSavingQ(false);
    }
  };

  // Assign
  const assignToClass = async () => {
    if (!assignClassId) {
      toast.error("Pick a class");
      return;
    }
    setAssigning(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setAssigning(false);
      return;
    }
    if (assignments.find((a) => a.class_id === assignClassId)) {
      toast.error("Already assigned");
      setAssigning(false);
      return;
    }
    if (lesson?.status !== "published" && !(await changeStatus("published"))) {
      setAssigning(false);
      return;
    }
    const { error } = await edsync.from("lesson_assignments").insert({
      lesson_id: lessonId,
      class_id: assignClassId,
      assigned_by: user.id,
      due_date: assignDueDate || null,
      is_active: true,
    });
    if (error) {
      toast.error("Failed: " + error.message);
      setAssigning(false);
      return;
    }
    const cls = myClasses.find((c) => c.id === assignClassId);
    setAssignments((a) => [
      ...a,
      {
        class_id: assignClassId,
        class_name: cls?.name || "",
        created_at: new Date().toISOString(),
      },
    ]);
    await fetch("/api/notifications/lesson-assigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lessonId,
        classId: assignClassId,
        dueDate: assignDueDate || null,
      }),
    });
    setAssignClassId("");
    setAssignDueDate("");
    setAssigning(false);
    toast.success(`Shared with ${cls?.name}.`);
  };

  const unassign = async (classId: string) => {
    const { error } = await edsync
      .from("lesson_assignments")
      .update({ is_active: false })
      .eq("lesson_id", lessonId)
      .eq("class_id", classId);
    if (error) { setActionError(error.message); return; }
    setAssignments((a) => a.filter((x) => x.class_id !== classId));
    toast.success("Sharing removed");
  };

  const openInStudio = async () => {
    if (!lesson) return;
    const { data: latestQuestions, error: questionError } = await edsync.from("quiz_questions").select("*").eq("lesson_id", lessonId);
    if (questionError) { setActionError(questionError.message); return; }
    const source = sections.map((section) => `## ${section.title}\n${normalizeLessonAuthoringContent(section.content || "")}`).join("\n\n");
    const parsed = outlineFromText(`${title}\n\n${source}`, { title });
    const savedSectionQuestions = ((latestQuestions || []) as QuizQuestion[]).filter((question) => Boolean(question.section_id)).map(toQuestionDraft);
    const allQuestions: QDraft[] = [...savedSectionQuestions, ...qDrafts];
    const outlineQuestions: OutlineQuestion[] = allQuestions.filter((question) => question.question_text.trim()).map((question) => {
      const sectionIndex = sections.findIndex((section) => section.id === question.section_id);
      const choice = question.question_type === "multiple_choice" || question.question_type === "true_false";
      const answerIndex = question.options.findIndex((option) => option.is_correct);
      return {
        type: question.question_type === "multiple_choice" ? "mcq" : question.question_type === "true_false" ? "true_false" : question.question_type === "fill_blank" ? "fill_blank" : "short",
        prompt: question.question_text,
        choices: choice ? question.options.map((option) => option.text) : undefined,
        answer: question.question_type === "true_false" ? question.options[answerIndex]?.text.toLowerCase() === "true" : choice ? answerIndex : question.correct_answer,
        explanation: question.explanation || undefined,
        purpose: question.is_diagnostic ? "diagnostic" : question.is_final_quiz ? "final" : "check",
        section: sectionIndex >= 0 ? sectionIndex : undefined,
      };
    });
    const outline: LessonOutline = {
      ...parsed,
      title: title || lesson.title,
      level: difficulty,
      objectives: objectives.filter(Boolean),
      sections: sections.map((section) => ({
        kind: section.content_type === "activity" || section.content_type === "discussion" ? "activity" : section.content_type === "quiz" ? "question" : "concept",
        heading: section.title,
        bullets: [],
        body: normalizeLessonAuthoringContent(section.content || ""),
      })),
      glossary: glossary.map((term) => ({ term: term.term, definition: term.definition, example: term.example || undefined })),
      questions: outlineQuestions,
    };
    try {
      sessionStorage.setItem("edsync-studio-import", JSON.stringify({ outline, title: outline.title, lessonId }));
      router.push("/studio?import=1");
    } catch { setActionError("Studio handoff could not be prepared in this browser."); }
  };

  const selectedSection = sections.find((section) => section.id === editingSectionId) || null;
  const addSelectedSection = (template: SectionTemplate) => { void addSection(template); setOutlineOpen(false); };
  const removeSelectedSection = async () => {
    if (!selectedSection) return;
    if (!(await confirm({ title: `Delete ${selectedSection.title}?`, body: "This block and its content will be removed.", confirmLabel: "Delete block", danger: true }))) return;
    await deleteSection(selectedSection.id);
    setEditingSectionId(sections.find((section) => section.id !== selectedSection.id)?.id || null);
    setInspectorOpen(false);
  };
  const removeGlossaryTerm = async (term: GlossaryTerm) => {
    if (await confirm({ title: `Delete ${term.term}?`, confirmLabel: "Delete term", danger: true })) await deleteGlossaryTerm(term.id);
  };
  const removeAssignment = async (classId: string) => {
    if (await confirm({ title: "Remove class sharing?", body: "Students in this class will lose access to this course.", confirmLabel: "Remove", danger: true })) await unassign(classId);
  };
  const outline = <SectionOutline sections={sections} selectedId={editingSectionId} onSelect={(id) => { setEditingSectionId(id); setOutlineOpen(false); }} onReorder={(ordered) => { void reorderSections(ordered); }} onAdd={addSelectedSection} />;
  const inspector = <SectionInspector section={selectedSection} onRequiredChange={(required) => { if (selectedSection) void saveSection(selectedSection.id, { is_required: required }); }} onDuplicate={() => { if (selectedSection) void duplicateSection(selectedSection); setInspectorOpen(false); }} onDelete={() => { void removeSelectedSection(); }} />;

  if (loading) return <div className="page-shell max-w-7xl"><div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2" /><div className="mt-6 h-96 animate-pulse rounded-xl bg-surface-2" /></div>;
  if (!lesson) return <div className="page-shell max-w-3xl"><EmptyState icon={CircleAlert} title="Course not found" hint="It may have been removed or you may not have access." action={<Button onClick={() => router.push("/teacher/lessons")}>Back to courses</Button>} /></div>;

  return <div className="page-shell max-w-7xl">
    <PageHeader title={lesson.title} icon={BookOpen} back="/teacher/lessons" backLabel="Courses" actions={<>
      <Link href={`/student/lessons/${lessonId}`} className="btn btn-secondary btn-sm hidden sm:inline-flex"><Eye size={15} />Preview</Link>
      <Button size="sm" icon={Sparkles} onClick={openInStudio} className="hidden md:inline-flex">Open in Studio</Button>
      <Button size="sm" icon={Share2} onClick={() => setPublishOpen(true)}>Publish & share</Button>
    </>}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted"><span className={`rounded-full px-2 py-0.5 font-semibold ${lesson.status === "published" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{lesson.status}</span><span>{sections.length} blocks</span><span>·</span><span>{qDrafts.length} questions</span><span>·</span><span>Updated {formatRelativeTime(lesson.updated_at)}</span></div>
    </PageHeader>
    {actionError && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"><CircleAlert size={16} />{actionError}<button type="button" className="ml-auto underline" onClick={() => setActionError("")}>Dismiss</button></div>}
    <Tabs<Tab> value={tab} onChange={setTab} ariaLabel="Course editor" items={[
      { value: "content", label: "Content", icon: Layers3, count: sections.length },
      { value: "quiz", label: "Quiz", icon: BookOpenCheck, count: qDrafts.length },
      { value: "glossary", label: "Glossary", icon: FileText, count: glossary.length },
      { value: "settings", label: "Settings", icon: Settings2 },
    ]} className="mb-5 max-w-full overflow-x-auto" />

    {tab === "content" && <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_220px]">
      <aside className="hidden self-start rounded-xl border border-line bg-surface p-3 lg:sticky lg:top-4 lg:block">{outline}</aside>
      <main className="min-w-0">
        <div className="mb-3 flex items-center gap-2 xl:hidden"><Button size="sm" icon={PanelLeft} onClick={() => setOutlineOpen(true)} className="lg:hidden">Outline</Button><Button size="sm" icon={Settings2} onClick={() => setInspectorOpen(true)}>Properties</Button><span className="ml-auto truncate text-xs text-fg-muted">{selectedSection?.title || "No block selected"}</span></div>
        <div className="mb-3 hidden items-center justify-between gap-3 lg:flex"><p className="truncate text-xs font-medium text-fg-muted">{selectedSection ? `Editing ${selectedSection.title}` : "Select a block"}</p><Button size="sm" variant="ghost" icon={Plus} onClick={() => void addSection()}>Add block</Button></div>
        {selectedSection ? <SectionEditor key={selectedSection.id} section={selectedSection} index={sections.findIndex((section) => section.id === selectedSection.id)} onSave={saveSection} onDelete={(id) => { void deleteSection(id); }} onCancel={() => setEditingSectionId(null)} edsync={edsync} lessonId={lessonId} /> : <EmptyState icon={Layers3} title={sections.length ? "Choose a block" : "Start with a block"} hint={sections.length ? "Select a block from the outline to edit it." : "Add a block from the outline to build your course."} action={<Button icon={Plus} onClick={() => void addSection()}>Add block</Button>} />}
      </main>
      <aside className="hidden self-start rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-4 xl:block">{inspector}</aside>
    </div>}

    {tab === "quiz" && <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-fg">Question bank</h2><p className="text-xs text-fg-muted">Pre-checks, section checks, and final questions.</p></div><Button variant="primary" size="sm" loading={savingQ} onClick={() => void saveQuestions()}>Save questions</Button></div>
      {qDrafts.length ? qDrafts.map((question) => <QuestionBuilder key={question.clientKey} q={question} onChange={(updated) => setQDrafts((items) => items.map((item) => item.clientKey === question.clientKey ? updated : item))} onDelete={() => setQDrafts((items) => items.filter((item) => item.clientKey !== question.clientKey))} />) : <EmptyState icon={BookOpenCheck} title="No questions yet" hint="Add a question to start your quiz." compact />}
      <div className="flex flex-wrap gap-2"><Button size="sm" icon={Plus} onClick={() => setQDrafts((items) => [...items, emptyQ({ is_diagnostic: true, is_micro_check: false })])}>Pre-check</Button><Button size="sm" icon={Plus} onClick={() => setQDrafts((items) => [...items, emptyQ({ is_micro_check: false })])}>Practice</Button><Button size="sm" icon={Plus} onClick={() => setQDrafts((items) => [...items, emptyQ({ is_final_quiz: true, is_micro_check: false })])}>Final quiz</Button></div>
    </div>}

    {tab === "glossary" && <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-fg">Glossary</h2><Button size="sm" icon={Plus} onClick={() => setAddingTerm(true)}>Add term</Button></div>
      {addingTerm && <div className="space-y-3 rounded-xl border border-line bg-surface p-4"><label className="block text-sm font-medium text-fg">Term<input autoFocus className="input mt-1 w-full" value={newTerm.term} onChange={(event) => setNewTerm((value) => ({ ...value, term: event.target.value }))} /></label><label className="block text-sm font-medium text-fg">Definition<textarea className="input mt-1 min-h-20 w-full" value={newTerm.definition} onChange={(event) => setNewTerm((value) => ({ ...value, definition: event.target.value }))} /></label><label className="block text-sm font-medium text-fg">Example<input className="input mt-1 w-full" value={newTerm.example} onChange={(event) => setNewTerm((value) => ({ ...value, example: event.target.value }))} /></label><div className="flex gap-2"><Button onClick={() => { setAddingTerm(false); setNewTerm({ term: "", definition: "", example: "" }); }}>Cancel</Button><Button variant="primary" onClick={() => void addGlossaryTerm()}>Save term</Button></div></div>}
      {glossary.length ? <div className="grid gap-2 sm:grid-cols-2">{glossary.map((term) => editingGlossaryId === term.id ? <GlossaryEditCard key={term.id} term={term} onSave={updateGlossaryTerm} onCancel={() => setEditingGlossaryId(null)} /> : <article key={term.id} className="rounded-xl border border-line bg-surface p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-fg">{term.term}</h3><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditingGlossaryId(term.id)}>Edit</Button><Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${term.term}`} onClick={() => void removeGlossaryTerm(term)} /></div></div><p className="mt-1 text-sm text-fg-muted">{term.definition}</p>{term.example && <p className="mt-2 text-xs text-accent">Example: {term.example}</p>}</article>)}</div> : !addingTerm && <EmptyState icon={FileText} title="No terms yet" hint="Add key vocabulary for learners." compact />}
    </div>}

    {tab === "settings" && <div className="mx-auto max-w-3xl space-y-4">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-5"><h2 className="text-base font-semibold text-fg">Course details</h2><label className="block text-sm font-medium text-fg">Title<input className="input mt-1 w-full" value={title} onChange={(event) => { setTitle(event.target.value); setOverviewDirty(true); }} /></label><label className="block text-sm font-medium text-fg">Description<textarea className="input mt-1 min-h-20 w-full" value={description} onChange={(event) => { setDescription(event.target.value); setOverviewDirty(true); }} /></label><div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-medium text-fg">Subject<input className="input mt-1 w-full" value={subject} onChange={(event) => { setSubject(event.target.value); setOverviewDirty(true); }} /></label><label className="block text-sm font-medium text-fg">Minutes<input type="number" min={1} className="input mt-1 w-full" value={duration} onChange={(event) => { setDuration(Number(event.target.value)); setOverviewDirty(true); }} /></label><label className="block text-sm font-medium text-fg">Level<select className="select mt-1 w-full" value={difficulty} onChange={(event) => { setDifficulty(event.target.value as DifficultyLevel); setOverviewDirty(true); }}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div></section>
      <section className="rounded-xl border border-line bg-surface p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-fg">Objectives</h2><Button size="sm" icon={Plus} onClick={() => { setObjectives((items) => [...items, ""]); setOverviewDirty(true); }}>Add</Button></div><div className="space-y-2">{objectives.map((objective, index) => <div key={index} className="flex gap-2"><input aria-label={`Objective ${index + 1}`} className="input min-w-0 flex-1" value={objective} onChange={(event) => { setObjectives((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); setOverviewDirty(true); }} /><Button variant="ghost" size="sm" icon={Trash2} aria-label={`Remove objective ${index + 1}`} onClick={() => { setObjectives((items) => items.filter((_, itemIndex) => itemIndex !== index)); setOverviewDirty(true); }} /></div>)}{objectives.length === 0 && <p className="text-sm text-fg-muted">No objectives added.</p>}</div></section>
      <section className="rounded-xl border border-line bg-surface p-5"><h2 className="mb-4 text-base font-semibold text-fg">Learning pace</h2>{([{ label: "Complexity", value: complexity, set: setComplexity }, { label: "Pacing", value: pacing, set: setPacing }, { label: "Scaffolding", value: scaffolding, set: setScaffolding }] as const).map((item) => <label key={item.label} className="mb-3 flex items-center gap-3 text-xs text-fg-muted last:mb-0"><span className="w-24">{item.label}</span><input type="range" min={0} max={100} value={item.value} onChange={(event) => { item.set(Number(event.target.value)); setOverviewDirty(true); }} className="min-w-0 flex-1 accent-accent" /><span className="w-8 text-right tabular-nums">{item.value}</span></label>)}</section>
      <div className="flex justify-end"><Button variant="primary" loading={saving} disabled={!overviewDirty} onClick={() => void saveOverview()}>{overviewDirty ? "Save changes" : "Saved"}</Button></div>
    </div>}

    <Sheet open={outlineOpen} onClose={() => setOutlineOpen(false)} title="Course outline" side="bottom">{outline}</Sheet>
    <Sheet open={inspectorOpen} onClose={() => setInspectorOpen(false)} title="Block properties" side="bottom">{inspector}</Sheet>
    <Sheet open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish & share" description="Control course visibility and class access" size="md">
      <div className="space-y-5">
        {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"><div><p className="text-sm font-semibold text-fg">{lesson.status === "published" ? "Published" : "Draft"}</p><p className="text-xs text-fg-muted">{lesson.status === "published" ? "Available to assigned classes" : "Publish when ready to share"}</p></div><Button size="sm" variant={lesson.status === "published" ? "secondary" : "primary"} onClick={() => void changeStatus(lesson.status === "published" ? "draft" : "published")}>{lesson.status === "published" ? "Unpublish" : "Publish"}</Button></div>
        {assignments.length > 0 && <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Shared classes</h3><div className="space-y-2">{assignments.map((assignment) => <div key={assignment.class_id} className="flex items-center gap-2 rounded-lg bg-surface-2 p-3"><span className="min-w-0 flex-1 truncate text-sm text-fg">{assignment.class_name}</span><Link href={scopedClassHref("/teacher/work", assignment.class_id)} className="text-xs text-accent">Work</Link><Button variant="ghost" size="sm" icon={Trash2} aria-label={`Unshare ${assignment.class_name}`} onClick={() => void removeAssignment(assignment.class_id)} /></div>)}</div></section>}
        {myClasses.length ? <section className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Share to a class</h3><label className="block text-sm text-fg">Class<select className="select mt-1 w-full" value={assignClassId} onChange={(event) => setAssignClassId(event.target.value)}><option value="">Choose a class</option>{myClasses.filter((item) => !assignments.some((assignment) => assignment.class_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm text-fg">Due date<input type="date" className="input mt-1 w-full" value={assignDueDate} onChange={(event) => setAssignDueDate(event.target.value)} /></label><Button variant="primary" loading={assigning} disabled={!assignClassId} onClick={() => void assignToClass()}>Share course</Button></section> : <p className="text-sm text-fg-muted">Create a class before sharing this course.</p>}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4"><Link href={`/student/lessons/${lessonId}`} className="btn btn-secondary btn-sm"><Eye size={15} />Preview as student</Link><Button size="sm" icon={Sparkles} onClick={openInStudio}>Open in Studio</Button></div>
      </div>
    </Sheet>
  </div>;
}
