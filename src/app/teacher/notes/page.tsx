"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Edit3, Eye, LockKeyhole, Plus, Send, StickyNote, Trash2, X } from "lucide-react";

type StudentRow = {
  id: string;
  full_name: string | null;
  email: string;
  class_id: string;
  class_name: string;
};
type Note = {
  id: string;
  student_id: string;
  class_id: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const resetForm = () => {
    setForm({ studentId: "", title: "", body: "", visibility: "student", priority: "normal" });
    setEditingId(null);
    setFormOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === form.studentId);
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch("/api/notes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        id: editingId ?? undefined,
        classId: editingId ? undefined : student?.class_id ?? null,
      }),
    });
    if (!response.ok) {
      toast.error("Note was not saved.");
      return;
    }
    toast.success(editingId ? "Note updated." : "Note saved.");
    resetForm();
    load();
  };

  const edit = (note: Note) => {
    setForm({
      studentId: note.student_id,
      title: note.title,
      body: note.body,
      visibility: note.visibility,
      priority: note.priority,
    });
    setEditingId(note.id);
    setFormOpen(true);
  };

  const remove = async (note: Note) => {
    const confirmed = window.confirm(`Delete "${note.title}"? This removes it for the teacher and student.`);
    if (!confirmed) return;
    const response = await fetch(`/api/notes?id=${encodeURIComponent(note.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      toast.error("Note was not deleted.");
      return;
    }
    toast.success("Note deleted.");
    load();
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
              Student support
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Teacher notes for students</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {notes.length} teacher notes, {visibleCount} shared with students
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {formOpen && (
              <button type="button" onClick={resetForm} className="btn-secondary justify-center">
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
            <button type="button" onClick={() => setFormOpen(true)} className="btn-primary justify-center">
              <Plus className="h-4 w-4" />
              New note
            </button>
          </div>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={save} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="font-display text-lg font-bold">{editingId ? "Edit feedback note" : "New feedback note"}</h2>
            <p className="text-sm text-edsync-subtle">
              Shared notes appear in the student's personal notes workspace when visibility allows it.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="edsync-input"
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
              disabled={Boolean(editingId)}
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
              {editingId ? "Update" : "Save"}
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
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs" onClick={() => edit(note)}>
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button type="button" className="btn-secondary justify-center px-3 py-2 text-xs text-edsync-red" onClick={() => remove(note)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
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
