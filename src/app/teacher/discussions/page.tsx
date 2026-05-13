"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type ClassRow = { id: string; name: string };
type Thread = { id: string; title: string; prompt: string | null; class_name: string | null; post_count: number; updated_at: string };

export default function TeacherDiscussionsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
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
    load();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Discussions</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Start class conversations tied to activities or independent prompts.</p>
      </div>

      <form onSubmit={create} className="edsync-card grid gap-3 p-4 md:grid-cols-4">
        <input className="edsync-input md:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Discussion title" required />
        <select className="edsync-input" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}>
          <option value="">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="btn-primary justify-center" type="submit">Create</button>
        <textarea className="edsync-input min-h-24 md:col-span-4" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="Prompt students should respond to" />
      </form>

      <div className="grid gap-3">
        {threads.map((thread) => (
          <article key={thread.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{thread.title}</h2>
              <span className="text-xs text-edsync-subtle">{thread.post_count} posts</span>
            </div>
            <p className="mt-1 text-sm text-edsync-subtle">{thread.class_name || "All classes"} · updated {new Date(thread.updated_at).toLocaleString()}</p>
            {thread.prompt && <p className="mt-3 text-sm leading-6">{thread.prompt}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
