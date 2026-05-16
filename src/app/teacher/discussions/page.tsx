"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MessageSquareText, Plus, Send, UsersRound } from "lucide-react";

type ClassRow = { id: string; name: string };
type Thread = {
  id: string;
  title: string;
  prompt: string | null;
  class_name: string | null;
  post_count: number;
  updated_at: string;
};

function updatedLabel(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TeacherDiscussionsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", prompt: "", classId: "" });

  const load = () => {
    fetch("/api/teacher/roster", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setClasses(payload.data?.classes ?? []));
    fetch("/api/discussions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setThreads(payload.data?.threads ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const postCount = useMemo(
    () => threads.reduce((sum, thread) => sum + Number(thread.post_count ?? 0), 0),
    [threads],
  );

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classId: form.classId || null }),
    });
    if (!response.ok) {
      toast.error("Discussion was not created.");
      return;
    }
    toast.success("Discussion created.");
    setForm({ title: "", prompt: "", classId: "" });
    setFormOpen(false);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">
              Classroom talk
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Discussions</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {threads.length} thread{threads.length !== 1 ? "s" : ""}, {postCount} posts
            </p>
          </div>
          <button type="button" onClick={() => setFormOpen((value) => !value)} className="btn-primary justify-center">
            <Plus className="h-4 w-4" />
            {formOpen ? "Close" : "New discussion"}
          </button>
        </div>
      </section>

      {formOpen && (
        <form onSubmit={create} className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="edsync-input md:col-span-2"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Discussion title"
              required
            />
            <select
              className="edsync-input"
              value={form.classId}
              onChange={(event) => setForm({ ...form, classId: event.target.value })}
            >
              <option value="">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button className="btn-primary justify-center" type="submit">
              <Send className="h-4 w-4" />
              Create
            </button>
            <textarea
              className="edsync-input min-h-24 md:col-span-4"
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
              placeholder="Prompt students should respond to"
            />
          </div>
        </form>
      )}

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="divide-y divide-edsync-border">
          {threads.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No discussions yet.</p>
          ) : (
            threads.map((thread) => (
              <article key={thread.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge bg-edsync-blue/10 text-edsync-blue">
                      {thread.class_name || "All classes"}
                    </span>
                    <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                      {thread.post_count} posts
                    </span>
                  </div>
                  <h2 className="truncate font-display text-lg font-bold">{thread.title}</h2>
                  {thread.prompt && <p className="mt-2 line-clamp-2 text-sm leading-6 text-edsync-subtle">{thread.prompt}</p>}
                </div>
                <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
                  <p className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-edsync-blue" />
                    Updated {updatedLabel(thread.updated_at)}
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-edsync-emerald" />
                    {thread.class_name || "Open"}
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
