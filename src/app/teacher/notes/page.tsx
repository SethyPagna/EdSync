"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type StudentRow = { id: string; full_name: string | null; email: string; class_id: string; class_name: string };
type Note = { id: string; title: string; body: string; priority: string; visibility: string; student_name: string | null; student_email: string; created_at: string };

export default function TeacherNotesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState({ studentId: "", title: "", body: "", visibility: "student", priority: "normal" });

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
    load();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Student notes</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Write private notes or student-visible feedback without losing context.</p>
      </div>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-4">
        <select className="edsync-input" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required>
          <option value="">Student</option>
          {students.map((student) => <option key={`${student.class_id}-${student.id}`} value={student.id}>{student.full_name || student.email} · {student.class_name}</option>)}
        </select>
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" required />
        <select className="edsync-input" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
          <option value="student">Student visible</option>
          <option value="teacher">Teacher only</option>
          <option value="guardian">Student/guardian</option>
        </select>
        <select className="edsync-input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <textarea className="edsync-input min-h-24 md:col-span-3" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Note..." required />
        <button className="btn-primary justify-center" type="submit">Save note</button>
      </form>

      <div className="grid gap-3">
        {notes.map((note) => (
          <article key={note.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{note.title}</h2>
              <span className="text-xs text-edsync-subtle">{new Date(note.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm text-edsync-subtle">{note.student_name || note.student_email} · {note.visibility} · {note.priority}</p>
            <p className="mt-3 text-sm leading-6">{note.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
