"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Archive, CalendarClock, ClipboardList, Edit3, FileCheck2, MessageSquareText, Plus, Save, Send, UsersRound, X } from "lucide-react";
import {
  normalizeWorkGradingSettings,
  workGradeContribution,
  workGradingLabel,
  type WorkGradingMode,
} from "@/lib/work/grading";

type ClassRow = { id: string; name: string };
type WorkItem = {
  id: string;
  title: string;
  work_type: string;
  status: string;
  instructions: string | null;
  due_at: string | null;
  points_possible: number;
  settings: unknown;
  class_name?: string | null;
  submission_count?: number;
};
type SubmissionRow = {
  id: string;
  work_item_id: string;
  title: string;
  work_type: string;
  work_points_possible: number;
  work_settings: unknown;
  full_name: string | null;
  email: string;
  response: Record<string, unknown> | string | null;
  status: string;
  points_earned: number | null;
  points_possible: number | null;
  percent: number | null;
  feedback: string | null;
  updated_at: string;
};
type ReviewDraft = {
  pointsEarned: string;
  pointsPossible: string;
  feedback: string;
};

const workTypes = ["quiz", "test", "task", "discussion", "activity"];
const gradingModes: Array<{ value: WorkGradingMode; label: string; description: string }> = [
  { value: "points", label: "Points", description: "Score against possible points and release to gradebook." },
  { value: "weighted", label: "Weighted", description: "Score points, then count this item as a fixed percent of the whole grade." },
  { value: "completion", label: "Completion only", description: "Track done/not done and feedback without changing grade average." },
  { value: "participation", label: "Participation", description: "Use criteria for engagement, discussion, or class activity evidence." },
];

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TeacherWorkPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [form, setForm] = useState({
    title: "",
    workType: "task",
    classId: "",
    instructions: "",
    pointsPossible: "100",
    gradingMode: "points" as WorkGradingMode,
    gradeWeightPercent: "",
    countsTowardGrade: true,
    participationCriteria: "",
    dueAt: "",
    status: "published",
  });

  const resetForm = (classId = form.classId) => {
    setForm({
      title: "",
      workType: "task",
      classId,
      instructions: "",
      pointsPossible: "100",
      gradingMode: "points",
      gradeWeightPercent: "",
      countsTowardGrade: true,
      participationCriteria: "",
      dueAt: "",
      status: "published",
    });
    setEditingId(null);
    setFormOpen(false);
  };

  const load = () => {
    fetch("/api/teacher/roster", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const classRows = payload.data?.classes ?? [];
        setClasses(classRows);
        setForm((current) => ({
          ...current,
          classId: current.classId || classRows[0]?.id || "",
        }));
      });
    fetch("/api/work", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.data ?? []));
    fetch("/api/work/submissions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rows = (payload.data ?? []) as SubmissionRow[];
        setSubmissions(rows);
        setReviewDrafts((current) => {
          const next = { ...current };
          rows.forEach((row) => {
            if (next[row.id]) return;
            next[row.id] = {
              pointsEarned: String(row.points_earned ?? ""),
              pointsPossible: String(row.points_possible ?? row.work_points_possible ?? 100),
              feedback: row.feedback ?? "",
            };
          });
          return next;
        });
      });
  };

  useEffect(() => {
    load();
  }, []);

  const saveWork = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.classId && !editingId) {
      toast.error("Choose a class so assignments, quizzes, and deadlines stay connected.");
      return;
    }
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch("/api/work", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        id: editingId ?? undefined,
        classId: form.classId || null,
        pointsPossible: Number(form.pointsPossible),
        gradingMode: form.gradingMode,
        gradeWeightPercent: form.gradeWeightPercent ? Number(form.gradeWeightPercent) : null,
        countsTowardGrade: form.countsTowardGrade,
        participationCriteria: form.participationCriteria,
        dueAt: form.dueAt || null,
      }),
    });
    if (!response.ok) {
      toast.error(`Work item was not ${editingId ? "updated" : "created"}.`);
      return;
    }
    toast.success(editingId ? "Work item updated." : "Work item created.");
    resetForm(form.classId);
    load();
  };

  const editWork = (item: WorkItem) => {
    const grading = normalizeWorkGradingSettings(item.settings);
    setEditingId(item.id);
    setForm({
      title: item.title,
      workType: item.work_type,
      classId: classes.find((cls) => cls.name === item.class_name)?.id ?? form.classId,
      instructions: item.instructions ?? "",
      pointsPossible: String(item.points_possible ?? 100),
      gradingMode: grading.mode,
      gradeWeightPercent: grading.gradeWeightPercent === null ? "" : String(grading.gradeWeightPercent),
      countsTowardGrade: grading.countsTowardGrade,
      participationCriteria: grading.participationCriteria,
      dueAt: item.due_at ? item.due_at.slice(0, 16) : "",
      status: item.status,
    });
    setFormOpen(true);
  };

  const archiveWork = async (item: WorkItem) => {
    const confirmed = window.confirm(`Archive "${item.title}"? Students will no longer see it as open work.`);
    if (!confirmed) return;
    const response = await fetch(`/api/work?id=${encodeURIComponent(item.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      toast.error(payload?.error || "Work item was not archived.");
      return;
    }
    toast.success("Work item archived.");
    load();
  };

  const review = async (submission: SubmissionRow) => {
    const draft = reviewDrafts[submission.id];
    if (!draft) return;
    const response = await fetch("/api/work/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: submission.id,
        pointsEarned: Number(draft.pointsEarned),
        pointsPossible: Number(draft.pointsPossible),
        feedback: draft.feedback,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      toast.error(payload?.error || "Feedback was not saved.");
      return;
    }
    toast.success("Feedback saved.");
    load();
  };

  const publishedCount = useMemo(() => items.filter((item) => item.status === "published").length, [items]);
  const selectedClass = useMemo(
    () => classes.find((classRow) => classRow.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const filteredItems = useMemo(() => {
    if (!selectedClass) return items;
    return items.filter((item) => item.class_name === selectedClass.name);
  }, [items, selectedClass]);
  const filteredItemIds = useMemo(() => new Set(filteredItems.map((item) => item.id)), [filteredItems]);
  const filteredSubmissions = useMemo(() => {
    if (!selectedClass) return submissions;
    return submissions.filter((submission) => filteredItemIds.has(submission.work_item_id));
  }, [filteredItemIds, selectedClass, submissions]);
  const submissionCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.submission_count ?? 0), 0),
    [items],
  );
  const unreviewedCount = useMemo(
    () => filteredSubmissions.filter((submission) => submission.status !== "graded").length,
    [filteredSubmissions],
  );

  return (
    <div className="page-shell space-y-5">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">
              Work builder
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Assignments</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {publishedCount} published, {submissionCount} submissions. Published class work notifies students and due dates appear in Planner.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/planner" className="btn-secondary justify-center">
              <CalendarClock className="h-4 w-4" />
              Planner
            </Link>
            {formOpen && (
              <button type="button" onClick={() => resetForm()} className="btn-secondary justify-center">
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedClass) setForm((current) => ({ ...current, classId: selectedClass.id }));
                setFormOpen(true);
              }}
              className="btn-primary justify-center"
            >
              <Plus className="h-4 w-4" />
              Create work
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-edsync-border bg-edsync-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Course scope</p>
            <p className="mt-1 text-sm text-edsync-subtle">
              Manage everything at once, or narrow assignments, projects, quizzes, and feedback to one class.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-3xl">
            <button
              type="button"
              onClick={() => setSelectedClassId("all")}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                selectedClassId === "all"
                  ? "border-edsync-blue bg-edsync-blue text-white"
                  : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
              }`}
            >
              All classes
            </button>
            {classes.map((classRow) => (
              <button
                key={classRow.id}
                type="button"
                onClick={() => setSelectedClassId(classRow.id)}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  selectedClassId === classRow.id
                    ? "border-edsync-blue bg-edsync-blue text-white"
                    : "border-edsync-border bg-edsync-surface text-edsync-subtle hover:border-edsync-blue/50"
                }`}
              >
                {classRow.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={saveWork} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">{editingId ? "Edit work item" : "New work item"}</h2>
              <p className="text-sm text-edsync-subtle">
                Quiz, test, task, discussion, or activity. Published class work creates notifications; due dates sync to Planner.
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-edsync-blue" />
          </div>
          <div className="grid gap-3 lg:grid-cols-6">
            <input
              className="edsync-input lg:col-span-2"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Title"
              required
            />
            <select
              className="edsync-input"
              value={form.workType}
              onChange={(event) => setForm({ ...form, workType: event.target.value })}
            >
              {workTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="edsync-input"
              value={form.classId}
              onChange={(event) => setForm({ ...form, classId: event.target.value })}
              disabled={Boolean(editingId)}
            >
              <option value="">Choose class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              className="edsync-input"
              type="number"
              value={form.pointsPossible}
              onChange={(event) => setForm({ ...form, pointsPossible: event.target.value })}
              aria-label="Points possible"
            />
            <input
              className="edsync-input"
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
              aria-label="Due date"
            />
            <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-3 lg:col-span-6">
              <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Scoring mode</span>
                  <select
                    className="edsync-input"
                    value={form.gradingMode}
                    onChange={(event) => {
                      const mode = event.target.value as WorkGradingMode;
                      setForm({
                        ...form,
                        gradingMode: mode,
                        countsTowardGrade: mode === "completion" || mode === "participation" ? false : form.countsTowardGrade,
                      });
                    }}
                  >
                    {gradingModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Course weight</span>
                  <input
                    className="edsync-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={form.gradingMode !== "weighted"}
                    value={form.gradeWeightPercent}
                    onChange={(event) => setForm({ ...form, gradeWeightPercent: event.target.value })}
                    placeholder={form.gradingMode === "weighted" ? "Example: 5" : "Only weighted work"}
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-edsync-border bg-edsync-card px-3 py-2 text-sm font-semibold text-edsync-text">
                  <input
                    type="checkbox"
                    checked={form.countsTowardGrade}
                    disabled={form.gradingMode === "completion" || form.gradingMode === "participation"}
                    onChange={(event) => setForm({ ...form, countsTowardGrade: event.target.checked })}
                  />
                  Counts toward gradebook
                </label>
              </div>
              <p className="mt-2 text-xs text-edsync-subtle">
                {gradingModes.find((mode) => mode.value === form.gradingMode)?.description}
              </p>
              {form.gradingMode === "participation" && (
                <textarea
                  className="edsync-input mt-3 min-h-20"
                  value={form.participationCriteria}
                  onChange={(event) => setForm({ ...form, participationCriteria: event.target.value })}
                  placeholder="Participation criteria, for example: posted once, replied to two peers, used evidence, joined activity."
                />
              )}
            </div>
            <textarea
              className="edsync-input min-h-24 lg:col-span-5"
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              placeholder="Instructions, rubric, links, practice rules, or quiz prompt"
            />
            <button className="btn-primary justify-center" type="submit">
              <Send className="h-4 w-4" />
              {editingId ? "Update" : "Publish"}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="border-b border-edsync-border p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Work list</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {filteredItems.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No work items yet.</p>
          ) : (
            filteredItems.map((item) => {
              const grading = normalizeWorkGradingSettings(item.settings);
              return (
                <article key={item.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.work_type}</span>
                      <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.status}</span>
                      <span className="badge bg-edsync-amber/10 text-edsync-amber">{workGradingLabel(grading, item.points_possible)}</span>
                      {!grading.countsTowardGrade && (
                        <span className="badge bg-edsync-surface text-edsync-subtle">not averaged</span>
                      )}
                    </div>
                    <h3 className="truncate font-display text-lg font-bold text-edsync-text">{item.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-edsync-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <UsersRound className="h-4 w-4" />
                        {item.class_name || "All classes"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        {dueLabel(item.due_at)}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-edsync-text">
                      <FileCheck2 className="h-4 w-4 text-edsync-blue" />
                      {item.submission_count ?? 0} submissions
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs" onClick={() => editWork(item)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs text-edsync-red" onClick={() => archiveWork(item)}>
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="border-b border-edsync-border p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Review submissions</h2>
              <p className="text-sm text-edsync-subtle">
                {filteredSubmissions.length} submitted, {unreviewedCount} waiting for feedback.
              </p>
            </div>
            <MessageSquareText className="h-5 w-5 text-edsync-amber" />
          </div>
        </div>
        <div className="divide-y divide-edsync-border">
          {filteredSubmissions.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">Student submissions will appear here for scoring and feedback.</p>
          ) : (
            filteredSubmissions.map((submission) => {
              const grading = normalizeWorkGradingSettings(submission.work_settings);
              const draft = reviewDrafts[submission.id] ?? {
                pointsEarned: "",
                pointsPossible: String(submission.work_points_possible ?? 100),
                feedback: "",
              };
              const contribution = workGradeContribution({
                pointsEarned: Number(draft.pointsEarned || 0),
                pointsPossible: Number(draft.pointsPossible || submission.work_points_possible || 0),
                settings: grading,
              });
              return (
                <article key={submission.id} className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">{submission.work_type}</span>
                      <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{submission.status}</span>
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {workGradingLabel(grading, submission.work_points_possible)}
                      </span>
                      {submission.percent !== null && (
                        <span className="badge bg-edsync-amber/10 text-edsync-amber">{submission.percent}%</span>
                      )}
                      {contribution !== null && (
                        <span className="badge bg-edsync-cyan/10 text-edsync-cyan">{contribution}% course credit</span>
                      )}
                    </div>
                    <h3 className="truncate font-display text-lg font-bold text-edsync-text">{submission.title}</h3>
                    <p className="mt-1 text-sm text-edsync-subtle">
                      {submission.full_name || submission.email} / updated {new Date(submission.updated_at).toLocaleDateString()}
                    </p>
                    <div className="mt-3 rounded-xl border border-edsync-border bg-edsync-surface p-3 text-sm leading-6 text-edsync-text">
                      {typeof submission.response === "string"
                        ? submission.response
                        : typeof submission.response?.text === "string"
                          ? submission.response.text
                          : JSON.stringify(submission.response ?? {}, null, 2)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-xs font-bold text-edsync-subtle">Earned</span>
                        <input
                          className="edsync-input"
                          type="number"
                          min="0"
                          value={draft.pointsEarned}
                          onChange={(event) =>
                            setReviewDrafts((current) => ({
                              ...current,
                              [submission.id]: { ...draft, pointsEarned: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-bold text-edsync-subtle">Possible</span>
                        <input
                          className="edsync-input"
                          type="number"
                          min="0"
                          value={draft.pointsPossible}
                          onChange={(event) =>
                            setReviewDrafts((current) => ({
                              ...current,
                              [submission.id]: { ...draft, pointsPossible: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>
                    <textarea
                      className="edsync-input mt-2 min-h-24"
                      value={draft.feedback}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [submission.id]: { ...draft, feedback: event.target.value },
                        }))
                      }
                      placeholder="Feedback, next step, or revision note..."
                    />
                    <button type="button" className="btn-primary mt-3 w-full justify-center" onClick={() => review(submission)}>
                      <Save className="h-4 w-4" />
                      Save feedback
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
