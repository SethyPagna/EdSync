"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, ClipboardList, FileCheck2, Plus, UsersRound } from "lucide-react";

type ClassRow = { id: string; name: string };
type WorkItem = {
  id: string;
  title: string;
  work_type: string;
  status: string;
  due_at: string | null;
  points_possible: number;
  class_name?: string | null;
  submission_count?: number;
};

const workTypes = ["quiz", "test", "task", "discussion", "activity"];

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
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    workType: "task",
    classId: "",
    instructions: "",
    pointsPossible: "100",
    dueAt: "",
    status: "published",
  });

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
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.classId) {
      toast.error("Choose a class so assignments, quizzes, and deadlines stay connected.");
      return;
    }
    const response = await fetch("/api/work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        classId: form.classId || null,
        pointsPossible: Number(form.pointsPossible),
        dueAt: form.dueAt || null,
      }),
    });
    if (!response.ok) {
      toast.error("Work item was not created.");
      return;
    }
    toast.success("Work item created.");
    setForm((current) => ({ title: "", workType: "task", classId: current.classId, instructions: "", pointsPossible: "100", dueAt: "", status: "published" }));
    setFormOpen(false);
    load();
  };

  const publishedCount = useMemo(() => items.filter((item) => item.status === "published").length, [items]);
  const submissionCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.submission_count ?? 0), 0),
    [items],
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
              {publishedCount} published, {submissionCount} submissions. Class due dates are added to Planner automatically.
            </p>
          </div>
          <button type="button" onClick={() => setFormOpen((value) => !value)} className="btn-primary justify-center">
            <Plus className="h-4 w-4" />
            {formOpen ? "Close builder" : "Create work"}
          </button>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={create} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">New work item</h2>
              <p className="text-sm text-edsync-subtle">Quiz, test, task, discussion, or activity.</p>
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
            <textarea
              className="edsync-input min-h-24 lg:col-span-5"
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              placeholder="Instructions, rubric, links, practice rules, or quiz prompt"
            />
            <button className="btn-primary justify-center" type="submit">
              Create
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="border-b border-edsync-border p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Work list</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {items.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No work items yet.</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.work_type}</span>
                    <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.status}</span>
                    <span className="badge bg-edsync-amber/10 text-edsync-amber">{item.points_possible} pts</span>
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
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
