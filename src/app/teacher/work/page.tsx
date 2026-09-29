"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Archive, ClipboardCheck, ClipboardList, Edit3, MessageSquare, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Menu, PageHeader, Segmented, Sheet, Skeleton, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import { normalizeWorkGradingSettings, workGradingLabel, type WorkGradingMode } from "@/lib/work/grading";
import { normalizeWorkSubmissionPolicy } from "@/lib/work/policy";
import type { Lesson } from "@/types";

type ClassRow = { id: string; name: string };
type CategoryRow = { id: string; class_id: string; name: string };
type WorkItem = {
  id: string;
  class_id: string | null;
  lesson_id: string | null;
  category_id: string | null;
  title: string;
  work_type: string;
  status: string;
  instructions: string | null;
  points_possible: number;
  due_at: string | null;
  allow_late: number | null;
  rubric: string | null;
  settings: unknown;
  class_name: string | null;
  submission_count: number;
};
type Submission = {
  id: string;
  work_item_id: string;
  student_id: string;
  class_id: string | null;
  title: string;
  work_type: string;
  work_points_possible: number;
  work_settings: unknown;
  full_name: string | null;
  email: string;
  response: unknown;
  status: string;
  points_earned: number | null;
  points_possible: number | null;
  feedback: string | null;
  updated_at: string;
  attempt_count?: number;
};
type QuizScore = {
  id: string;
  student_id: string;
  class_id: string | null;
  source_type: string;
  source_id: string | null;
  title: string;
  points_earned: number | null;
  points_possible: number | null;
  feedback: string | null;
  status: string;
  full_name: string | null;
  email: string;
  category_id: string | null;
  updated_at: string;
};
type QueueRow = { kind: "work"; data: Submission } | { kind: "lesson"; data: QuizScore };
type View = "work" | "review" | "discussions";
type ReviewFilter = "to_review" | "graded" | "all";
type WorkForm = {
  title: string;
  classId: string;
  workType: string;
  status: string;
  instructions: string;
  pointsPossible: string;
  dueAt: string;
  gradingMode: WorkGradingMode;
  gradeWeightPercent: string;
  countsTowardGrade: boolean;
  participationCriteria: string;
  allowLate: boolean;
  allowResubmission: boolean;
  maxAttempts: string;
  lessonId: string;
  categoryId: string;
  rubricText: string;
};

const workTypes = ["task", "quiz", "test", "discussion", "activity"];
const modes: Array<{ value: WorkGradingMode; label: string }> = [
  { value: "points", label: "Points" },
  { value: "weighted", label: "Weighted" },
  { value: "completion", label: "Completion" },
  { value: "participation", label: "Participation" },
];
const viewOptions: Array<{ value: View; label: string }> = [
  { value: "work", label: "Work" },
  { value: "review", label: "Review" },
  { value: "discussions", label: "Discussions" },
];
const reviewOptions: Array<{ value: ReviewFilter; label: string }> = [
  { value: "to_review", label: "To review" },
  { value: "graded", label: "Graded" },
  { value: "all", label: "All" },
];

function blankForm(classId = ""): WorkForm {
  return {
    title: "", classId, workType: "task", status: "published", instructions: "",
    pointsPossible: "100", dueAt: "", gradingMode: "points", gradeWeightPercent: "",
    countsTowardGrade: true, participationCriteria: "", allowLate: true,
    allowResubmission: false, maxAttempts: "", lessonId: "", categoryId: "", rubricText: "",
  };
}

function rubricText(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]") as Array<{ criterion?: string; points?: number }>;
    return Array.isArray(parsed) ? parsed.map((item) => item.criterion + (item.points ? " | " + item.points : "")).join("\n") : "";
  } catch {
    return "";
  }
}

function rubricItems(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [criterion, rawPoints] = line.split("|", 2);
    return { criterion: criterion.trim(), points: rawPoints ? Number(rawPoints.trim()) || 0 : 0 };
  });
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

async function jsonData(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) throw new Error(payload?.error || "Request failed.");
  return payload.data;
}

function itemForm(item: WorkItem): WorkForm {
  const grading = normalizeWorkGradingSettings(item.settings);
  const policy = normalizeWorkSubmissionPolicy(item.settings);
  return {
    title: item.title,
    classId: item.class_id || "",
    workType: item.work_type,
    status: item.status,
    instructions: item.instructions || "",
    pointsPossible: String(item.points_possible),
    dueAt: localDateTime(item.due_at),
    gradingMode: grading.mode,
    gradeWeightPercent: grading.gradeWeightPercent === null ? "" : String(grading.gradeWeightPercent),
    countsTowardGrade: grading.countsTowardGrade,
    participationCriteria: grading.participationCriteria,
    allowLate: Number(item.allow_late ?? 1) !== 0,
    allowResubmission: policy.allowResubmission,
    maxAttempts: policy.maxAttempts === null ? "" : String(policy.maxAttempts),
    lessonId: item.lesson_id || "",
    categoryId: item.category_id || "",
    rubricText: rubricText(item.rubric),
  };
}

function toRequestField(key: keyof WorkForm, value: WorkForm[keyof WorkForm]): [string, unknown] {
  if (key === "rubricText") return ["rubric", rubricItems(String(value))];
  if (key === "pointsPossible" || key === "gradeWeightPercent") return [key, value === "" ? null : Number(value)];
  if (key === "maxAttempts") return [key, value === "" ? null : Number(value)];
  if (key === "dueAt") return [key, value ? new Date(String(value)).toISOString() : null];
  if (key === "lessonId" || key === "categoryId") return [key, value || null];
  return [key, value];
}

export default function TeacherWorkPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [quizScores, setQuizScores] = useState<QuizScore[]>([]);
  const [classId, setClassId] = useState("all");
  const [view, setView] = useState<View>("work");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("to_review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [form, setForm] = useState<WorkForm>(blankForm);
  const [initial, setInitial] = useState<WorkForm>(blankForm);
  const [selectedReview, setSelectedReview] = useState<QueueRow | null>(null);
  const [earned, setEarned] = useState("");
  const [possible, setPossible] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to manage work.");
      const [roster, work, reviews, grades, lessonResult] = await Promise.all([
        fetch("/api/teacher/roster", { cache: "no-store" }).then(jsonData),
        fetch("/api/work", { cache: "no-store" }).then(jsonData),
        fetch("/api/work/submissions", { cache: "no-store" }).then(jsonData),
        fetch("/api/grades", { cache: "no-store" }).then(jsonData),
        edsync.from("lessons").select("id, title, class_id, status").eq("teacher_id", user.id).order("title"),
      ]);
      if (lessonResult.error) throw lessonResult.error;
      setClasses((roster?.classes || []) as ClassRow[]);
      setItems((work || []) as WorkItem[]);
      setSubmissions((reviews || []) as Submission[]);
      setCategories((grades?.categories || []) as CategoryRow[]);
      setQuizScores(((grades?.scores || []) as QuizScore[]).filter((score) => score.source_type === "lesson_quiz"));
      setLessons((lessonResult.data || []) as Lesson[]);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    const scope = params.get("classId");
    const timer = window.setTimeout(() => {
      if (scope) setClassId(scope);
      if (section === "submissions" || section === "feedback") {
        setView("review");
        setReviewFilter(section === "feedback" ? "graded" : "to_review");
      } else if (section === "discussions") {
        setView("discussions");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLocation = (nextClass: string, nextView: View, nextFilter = reviewFilter) => {
    const params = new URLSearchParams();
    if (nextClass !== "all") params.set("classId", nextClass);
    if (nextView === "discussions") params.set("section", "discussions");
    if (nextView === "review") params.set("section", nextFilter === "graded" ? "feedback" : "submissions");
    router.replace("/teacher/work" + (params.size ? "?" + params.toString() : ""), { scroll: false });
  };

  const scopedItems = items.filter((item) => classId === "all" || item.class_id === classId);
  const visibleItems = scopedItems.filter((item) => view !== "discussions" || item.work_type === "discussion");
  const itemIds = new Set(scopedItems.map((item) => item.id));
  const queue: QueueRow[] = [
    ...submissions.filter((row) => itemIds.has(row.work_item_id)).map((data) => ({ kind: "work" as const, data })),
    ...quizScores.filter((row) => classId === "all" || row.class_id === classId).map((data) => ({ kind: "lesson" as const, data })),
  ].sort((a, b) => Date.parse(b.data.updated_at) - Date.parse(a.data.updated_at));
  const pendingCount = queue.filter((row) => row.data.status === "submitted").length;
  const visibleQueue = queue.filter((row) => reviewFilter === "all" || (reviewFilter === "graded" ? row.data.status === "graded" : row.data.status === "submitted"));
  const linkedLessons = lessons.filter((item) => !form.classId || item.class_id === form.classId || item.class_id === null);
  const linkedCategories = categories.filter((item) => item.class_id === form.classId);

  const openNew = () => {
    const next = blankForm(classId === "all" ? classes[0]?.id || "" : classId);
    setEditing(null);
    setForm(next);
    setInitial(next);
    setFormOpen(true);
  };

  const openEdit = (item: WorkItem) => {
    const next = itemForm(item);
    setEditing(item);
    setForm(next);
    setInitial(next);
    setFormOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!editing && !form.classId) return toast.error("Choose a class.");
    if (!form.title.trim()) return toast.error("Add a title.");
    const points = Number(form.pointsPossible);
    if (form.pointsPossible.trim() === "" || !Number.isFinite(points) || points < 0) return toast.error("Enter valid possible points.");
    if (form.maxAttempts && (!Number.isInteger(Number(form.maxAttempts)) || Number(form.maxAttempts) < 1 || Number(form.maxAttempts) > 100)) return toast.error("Attempts must be between 1 and 100.");
    if (form.dueAt && Number.isNaN(new Date(form.dueAt).getTime())) return toast.error("Choose a valid due date.");
    setBusy(true);
    try {
      const keys = Object.keys(form) as Array<keyof WorkForm>;
      const changed = editing ? keys.filter((key) => key !== "classId" && form[key] !== initial[key]) : keys;
      const body = Object.fromEntries(changed.map((key) => toRequestField(key, form[key])));
      if (editing) body.id = editing.id;
      if (editing && changed.length === 0) {
        setFormOpen(false);
        return;
      }
      await fetch("/api/work", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(jsonData);
      toast.success(editing ? "Work updated" : "Work created");
      setFormOpen(false);
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (item: WorkItem) => {
    if (!await confirm({ title: "Archive " + item.title + "?", body: "Learners will no longer see it as open work.", confirmLabel: "Archive", danger: true })) return;
    try {
      await fetch("/api/work?id=" + encodeURIComponent(item.id), { method: "DELETE" }).then(jsonData);
      toast.success("Work archived");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    }
  };

  const openReview = (row: QueueRow) => {
    setSelectedReview(row);
    setEarned(String(row.data.points_earned ?? ""));
    setPossible(String(row.kind === "work" ? row.data.points_possible ?? row.data.work_points_possible : row.data.points_possible ?? ""));
    setFeedback(row.data.feedback || "");
  };

  const grade = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReview || busy) return;
    if (earned.trim() === "" || possible.trim() === "") return toast.error("Enter earned and possible points.");
    const earnedValue = Number(earned);
    const possibleValue = Number(possible);
    if (!Number.isFinite(earnedValue) || !Number.isFinite(possibleValue) || earnedValue < 0 || possibleValue < 0 || earnedValue > possibleValue) return toast.error("Check the score and possible points.");
    setBusy(true);
    try {
      if (selectedReview.kind === "work") {
        await fetch("/api/work/submissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionId: selectedReview.data.id, pointsEarned: earnedValue, pointsPossible: possibleValue, feedback }),
        }).then(jsonData);
      } else {
        const score = selectedReview.data;
        if (!score.source_id) throw new Error("This quiz has no linked course.");
        await fetch("/api/grades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: score.student_id,
            classId: score.class_id,
            sourceType: "lesson_quiz",
            sourceId: score.source_id,
            title: score.title,
            pointsEarned: earnedValue,
            pointsPossible: possibleValue,
            categoryId: score.category_id,
            feedback,
          }),
        }).then(jsonData);
      }
      toast.success("Grade saved");
      setSelectedReview(null);
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof WorkForm>(key: K, value: WorkForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const reviewedItem = selectedReview?.kind === "work" ? items.find((item) => item.id === selectedReview.data.work_item_id) : null;

  return (
    <main className="page">
      <PageHeader title="Work" icon={ClipboardList} count={scopedItems.length} actions={<Button variant="primary" size="sm" icon={Plus} onClick={openNew}>New work</Button>}>
        <p className="text-sm text-fg-muted">{pendingCount} to review</p>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Work view" value={view} onChange={(next) => { setView(next); setLocation(classId, next); }} options={viewOptions} />
        <select className="input ml-auto min-w-36" aria-label="Filter by class" value={classId} onChange={(event) => { setClassId(event.target.value); setLocation(event.target.value, view); }}>
          <option value="all">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      {loading ? <div className="space-y-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16" />)}</div> :
        view === "review" ? <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3"><h2 className="mr-auto text-sm font-semibold text-fg">Submissions</h2><Segmented ariaLabel="Review status" size="sm" value={reviewFilter} onChange={(next) => { setReviewFilter(next); setLocation(classId, view, next); }} options={reviewOptions} /></div>
          {visibleQueue.length === 0 ? <EmptyState icon={ClipboardCheck} title="Queue is clear" hint="Submissions will appear here." compact /> :
            visibleQueue.map((row) => <button key={row.kind + row.data.id} type="button" onClick={() => openReview(row)} className="flex w-full min-w-0 items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-surface-2 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><ClipboardCheck size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{row.data.full_name || row.data.email}</span><span className="block truncate text-xs text-fg-muted">{row.data.title}{row.kind === "lesson" ? " · Course quiz" : ""}</span></span>
              <Badge tone={row.data.status === "graded" ? "success" : "warning"}>{row.data.status}</Badge>
            </button>)}
        </section> :
        visibleItems.length === 0 ? <EmptyState icon={view === "discussions" ? MessageSquare : ClipboardList} title={view === "discussions" ? "No discussions yet" : "No work yet"} hint="Create an item to get started." /> :
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          {visibleItems.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:px-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">{item.work_type === "discussion" ? <MessageSquare size={17} /> : <ClipboardList size={17} />}</span>
            <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold text-fg">{item.title}</span><span className="block truncate text-xs text-fg-muted">{item.class_name || "No class"} · {item.due_at ? "Due " + new Date(item.due_at).toLocaleDateString() : "No due date"} · {item.submission_count || 0} submissions</span></button>
            <Badge tone={item.status === "published" ? "success" : "neutral"} className="hidden capitalize sm:inline-flex">{item.status}</Badge>
            <Menu label={"Actions for " + item.title} items={[{ label: "Edit", icon: Edit3, onSelect: () => openEdit(item) }, { label: "Archive", icon: Archive, danger: true, onSelect: () => void archive(item) }]} />
          </div>)}
        </section>}
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit work" : "New work"} size="lg" footer={<Button variant="primary" type="submit" form="work-form" loading={busy}>{editing ? "Save changes" : "Create work"}</Button>}>
        <form id="work-form" onSubmit={save} className="space-y-4">
          <label className="block text-sm font-medium text-fg">Title<input className="input mt-1 w-full" required maxLength={160} value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-fg">Class<select className="input mt-1 w-full" required disabled={!!editing} value={form.classId} onChange={(event) => { update("classId", event.target.value); update("lessonId", ""); update("categoryId", ""); }}><option value="">Choose class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="block text-sm font-medium text-fg">Type<select className="input mt-1 w-full" disabled={!!editing && Number(editing.submission_count) > 0} value={form.workType} onChange={(event) => update("workType", event.target.value)}>{workTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="block text-sm font-medium text-fg">Points possible<input className="input mt-1 w-full" type="number" min="0" max="10000" step="0.01" required value={form.pointsPossible} onChange={(event) => update("pointsPossible", event.target.value)} /></label>
            <label className="block text-sm font-medium text-fg">Due date<input className="input mt-1 w-full" type="datetime-local" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} /></label>
            <label className="block text-sm font-medium text-fg">Status<select className="input mt-1 w-full" value={form.status} onChange={(event) => update("status", event.target.value)}><option value="published">Published</option><option value="draft">Draft</option></select></label>
            <label className="block text-sm font-medium text-fg">Scoring<select className="input mt-1 w-full" value={form.gradingMode} onChange={(event) => update("gradingMode", event.target.value as WorkGradingMode)}>{modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          </div>
          <label className="block text-sm font-medium text-fg">Instructions<textarea className="input mt-1 min-h-20 w-full" value={form.instructions} onChange={(event) => update("instructions", event.target.value)} /></label>
          <details className="rounded-xl border border-line bg-surface-2 p-3"><summary className="cursor-pointer text-sm font-medium text-fg">Scoring and submission options</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {form.gradingMode === "weighted" ? <label className="block text-sm font-medium text-fg">Course weight %<input className="input mt-1 w-full" type="number" min="0" max="100" step="0.1" value={form.gradeWeightPercent} onChange={(event) => update("gradeWeightPercent", event.target.value)} /></label> : null}
              {form.gradingMode === "participation" ? <label className="block text-sm font-medium text-fg">Participation criteria<input className="input mt-1 w-full" value={form.participationCriteria} onChange={(event) => update("participationCriteria", event.target.value)} /></label> : null}
              <label className="block text-sm font-medium text-fg">Maximum attempts<input className="input mt-1 w-full" type="number" min="1" max="100" value={form.maxAttempts} onChange={(event) => update("maxAttempts", event.target.value)} placeholder="Unlimited" /></label>
              <label className="block text-sm font-medium text-fg">Linked course<select className="input mt-1 w-full" value={form.lessonId} onChange={(event) => update("lessonId", event.target.value)}><option value="">None</option>{linkedLessons.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              <label className="block text-sm font-medium text-fg">Grade category<select className="input mt-1 w-full" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">None</option>{linkedCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-fg">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowLate} onChange={(event) => update("allowLate", event.target.checked)} />Allow late work</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowResubmission} onChange={(event) => update("allowResubmission", event.target.checked)} />Allow resubmission</label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled={form.gradingMode === "completion" || form.gradingMode === "participation"} checked={form.countsTowardGrade && form.gradingMode !== "completion" && form.gradingMode !== "participation"} onChange={(event) => update("countsTowardGrade", event.target.checked)} />Counts toward average</label>
            </div>
            <label className="mt-3 block text-sm font-medium text-fg">Rubric <span className="font-normal text-fg-muted">One criterion per line, optional points after |</span><textarea className="input mt-1 min-h-20 w-full" value={form.rubricText} onChange={(event) => update("rubricText", event.target.value)} placeholder={"Clarity | 10\nEvidence | 20"} /></label>
          </details>
        </form>
      </Sheet>
      <Sheet open={selectedReview !== null} onClose={() => setSelectedReview(null)} title={selectedReview?.data.full_name || selectedReview?.data.email || "Review"} description={selectedReview?.data.title} size="lg" footer={<Button variant="primary" type="submit" form="review-form" loading={busy}>Save grade</Button>}>
        {selectedReview ? <form id="review-form" onSubmit={grade} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted"><Badge tone={selectedReview.data.status === "graded" ? "success" : "warning"}>{selectedReview.data.status}</Badge>{selectedReview.kind === "work" ? <span>{selectedReview.data.attempt_count || 1} attempt(s)</span> : <span>Course quiz</span>}</div>
          {reviewedItem ? <p className="text-sm text-fg-muted">{workGradingLabel(normalizeWorkGradingSettings(reviewedItem.settings), reviewedItem.points_possible)}</p> : null}
          {selectedReview.kind === "work" ? <section className="rounded-xl border border-line bg-surface-2 p-3"><h3 className="mb-2 text-sm font-semibold text-fg">Submission</h3><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-fg-muted">{typeof selectedReview.data.response === "string" ? selectedReview.data.response : JSON.stringify(selectedReview.data.response, null, 2)}</pre></section> : null}
          {reviewedItem?.rubric && rubricText(reviewedItem.rubric) ? <section className="rounded-xl border border-line p-3"><h3 className="text-sm font-semibold text-fg">Rubric</h3><p className="mt-1 whitespace-pre-wrap text-sm text-fg-muted">{rubricText(reviewedItem.rubric)}</p></section> : null}
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-fg">Earned points<input className="input mt-1 w-full" type="number" min="0" step="0.01" required value={earned} onChange={(event) => setEarned(event.target.value)} /></label><label className="block text-sm font-medium text-fg">Possible points<input className="input mt-1 w-full" type="number" min="0" step="0.01" required value={possible} onChange={(event) => setPossible(event.target.value)} /></label></div>
          <label className="block text-sm font-medium text-fg">Feedback<textarea className="input mt-1 min-h-24 w-full" value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label>
          {selectedReview.kind === "lesson" && selectedReview.data.source_id ? <Link className="text-sm text-accent hover:underline" href={"/teacher/lessons/" + selectedReview.data.source_id}>Open course</Link> : null}
        </form> : null}
      </Sheet>
    </main>
  );
}
