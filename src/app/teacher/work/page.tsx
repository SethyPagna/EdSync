"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

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

export default function TeacherWorkPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
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
      .then((payload) => setClasses(payload.data?.classes ?? []));
    fetch("/api/work", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.data ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
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
    setForm({ title: "", workType: "task", classId: "", instructions: "", pointsPossible: "100", dueAt: "", status: "published" });
    load();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Work builder</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Create quizzes, tests, tasks, discussions, and activities with points and due dates.</p>
      </div>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 lg:grid-cols-6">
        <input className="edsync-input lg:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" required />
        <select className="edsync-input" value={form.workType} onChange={(event) => setForm({ ...form, workType: event.target.value })}>
          {workTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select className="edsync-input" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
          <option value="">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <input className="edsync-input" type="number" value={form.pointsPossible} onChange={(event) => setForm({ ...form, pointsPossible: event.target.value })} />
        <input className="edsync-input" type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
        <textarea className="edsync-input min-h-24 lg:col-span-5" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Instructions, rubric, links, or discussion prompt" />
        <button className="btn-primary justify-center" type="submit">Create work</button>
      </form>

      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="edsync-card flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold">{item.title}</h2>
                <span className="rounded-md border border-edsync-border px-2 py-1 text-xs capitalize text-edsync-subtle">{item.work_type}</span>
                <span className="rounded-md border border-edsync-border px-2 py-1 text-xs capitalize text-edsync-subtle">{item.status}</span>
              </div>
              <p className="mt-1 text-sm text-edsync-subtle">
                {item.class_name || "All classes"} · {item.points_possible} pts · {item.submission_count ?? 0} submissions
                {item.due_at ? ` · due ${new Date(item.due_at).toLocaleString()}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
