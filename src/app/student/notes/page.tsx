"use client";

import { useEffect, useState } from "react";

type Note = {
  id: string;
  title: string;
  body: string;
  priority: string;
  teacher_name: string | null;
  created_at: string;
};

export default function StudentNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setNotes(payload.data ?? []));
  }, []);

  return (
    <div className="page-shell max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Notes from teachers</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Teacher feedback, next steps, and reminders collected for you.</p>
      </div>
      <div className="grid gap-3">
        {notes.map((note) => (
          <article key={note.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{note.title}</h2>
              <span className="text-xs text-edsync-subtle">{new Date(note.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm text-edsync-subtle">
              {note.teacher_name || "Teacher"} / {note.priority}
            </p>
            <p className="mt-3 text-sm leading-6">{note.body}</p>
          </article>
        ))}
        {notes.length === 0 && <p className="edsync-card p-4 text-sm text-edsync-subtle">No notes yet.</p>}
      </div>
    </div>
  );
}
