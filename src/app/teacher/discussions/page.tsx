"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { MessageSquareText, Plus, Send, UsersRound } from "lucide-react";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams, hasClassScope, scopedClassHref } from "@/lib/classes/class-scope";

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

function classScopeFromLocation() {
  if (typeof window === "undefined") return ALL_CLASSES_SCOPE;
  return classScopeFromSearchParams(new URLSearchParams(window.location.search));
}

export default function TeacherDiscussionsPage() {
  const router = useRouter();
  const [requestedClassId, setRequestedClassId] = useState(classScopeFromLocation);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", prompt: "", classId: "" });
  const [selectedClassId, setSelectedClassId] = useState("all");

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

  useEffect(() => {
    if (!hasClassScope(classes, requestedClassId)) return;
    const scopeTimer = window.setTimeout(() => {
      setSelectedClassId(requestedClassId);
      if (requestedClassId !== ALL_CLASSES_SCOPE) {
        setForm((current) => ({ ...current, classId: current.classId || requestedClassId }));
      }
    }, 0);
    return () => window.clearTimeout(scopeTimer);
  }, [classes, requestedClassId]);

  const chooseClassScope = (classId: string) => {
    setRequestedClassId(classId);
    setSelectedClassId(classId);
    if (classId !== ALL_CLASSES_SCOPE) {
      setForm((current) => ({ ...current, classId }));
    }
    router.replace(scopedClassHref("/teacher/discussions", classId), { scroll: false });
  };

  const postCount = useMemo(
    () => threads.reduce((sum, thread) => sum + Number(thread.post_count ?? 0), 0),
    [threads],
  );
  const selectedClass = useMemo(
    () => classes.find((classRow) => classRow.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const filteredThreads = useMemo(() => {
    if (!selectedClass) return threads;
    return threads.filter((thread) => thread.class_name === selectedClass.name);
  }, [selectedClass, threads]);

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
          <button
            type="button"
            onClick={() => {
              if (selectedClass) setForm((current) => ({ ...current, classId: selectedClass.id }));
              setFormOpen((value) => !value);
            }}
            className="btn-primary justify-center"
          >
            <Plus className="h-4 w-4" />
            {formOpen ? "Close" : "New discussion"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-edsync-border bg-edsync-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Course scope</p>
            <p className="mt-1 text-sm text-edsync-subtle">
              View every discussion, or focus on the threads attached to one class.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-3xl">
            <button
              type="button"
              onClick={() => chooseClassScope(ALL_CLASSES_SCOPE)}
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
                onClick={() => chooseClassScope(classRow.id)}
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
          {filteredThreads.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No discussions yet.</p>
          ) : (
            filteredThreads.map((thread) => (
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
