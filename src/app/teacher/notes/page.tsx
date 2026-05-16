"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Eye, LockKeyhole, Plus, Send, StickyNote } from "lucide-react";

type StudentRow = {
  id: string;
  full_name: string | null;
  email: string;
  class_id: string;
  class_name: string;
};
type Note = {
  id: string;
  title: string;
  body: string;
  priority: string;
  visibility: string;
  student_name: string | null;
  student_email: string;
  created_at: string;
};

function visibilityIcon(value: string) {
  return value === "teacher" ? LockKeyhole : Eye;
}

export default function TeacherNotesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    title: "",
    body: "",
    visibility: "student",
    priority: "normal",
  });

  const load = () => {
    fetch("/api/teacher/roster", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setStudents(payload.data?.students ?? []));
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setNotes(payload.data ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const visibleCount = useMemo(() => notes.filter((note) => note.visibility !== "teacher").length, [notes]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === form.studentId);
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: student?.class_id ?? null }),
    });
    if (!response.ok) {
      toast.error("Note was not saved.");
      return;
    }
    toast.success("Note saved.");
    setForm({ studentId: "", title: "", body: "", visibility: "student", priority: "normal" });
    setFormOpen(false);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
              Student support
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Student notes</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {notes.length} notes, {visibleCount} visible to students
            </p>
          </div>
          <button type="button" onClick={() => setFormOpen((value) => !value)} className="btn-primary justify-center">
            <Plus className="h-4 w-4" />
            {formOpen ? "Close" : "New note"}
          </button>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={create} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="edsync-input"
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
              required
            >
              <option value="">Student</option>
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
              <option value="student">Student visible</option>
              <option value="teacher">Teacher only</option>
              <option value="guardian">Student/guardian</option>
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
              Save
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
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
