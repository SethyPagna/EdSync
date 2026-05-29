"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MessageSquareText, Send, UsersRound } from "lucide-react";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams } from "@/lib/classes/class-scope";

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

export default function StudentDiscussionsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [requestedClassId] = useState(classScopeFromLocation);

  const load = useCallback(() => {
    const query = requestedClassId === ALL_CLASSES_SCOPE ? "" : `?classId=${encodeURIComponent(requestedClassId)}`;
    fetch(`/api/discussions${query}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setThreads(payload.data?.threads ?? []));
  }, [requestedClassId]);

  useEffect(() => {
    load();
  }, [load]);

  const postCount = useMemo(
    () => threads.reduce((sum, thread) => sum + Number(thread.post_count ?? 0), 0),
    [threads],
  );

  const post = async (threadId: string) => {
    const body = responses[threadId] || "";
    if (!body.trim()) {
      toast.error("Write a response first.");
      return;
    }

    const response = await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, body }),
    });
    if (!response.ok) {
      toast.error("Post was not saved.");
      return;
    }
    toast.success("Posted.");
    setResponses((current) => ({ ...current, [threadId]: "" }));
    load();
  };

  return (
    <div className="page-shell max-w-5xl space-y-5">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">
          Class talk
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Discussions</h1>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-edsync-subtle">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}, {postCount} posts
            {requestedClassId !== ALL_CLASSES_SCOPE ? " in this class" : ""}
          </p>
          {requestedClassId !== ALL_CLASSES_SCOPE && (
            <Link href="/student/discussions" className="btn-secondary w-fit px-3 py-2 text-sm">
              All
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="divide-y divide-edsync-border">
          {threads.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No discussions yet.</p>
          ) : (
            threads.map((thread) => (
              <article key={thread.id} className="p-4 sm:p-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {thread.class_name || "Class"}
                      </span>
                      <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                        {thread.post_count} posts
                      </span>
                    </div>
                    <h2 className="truncate font-display text-xl font-bold">{thread.title}</h2>
                    {thread.prompt && <p className="mt-3 text-sm leading-6 text-edsync-text">{thread.prompt}</p>}
                  </div>
                  <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm text-edsync-subtle">
                    <p className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-edsync-blue" />
                      Updated {updatedLabel(thread.updated_at)}
                    </p>
                    <p className="mt-2 flex items-center gap-2">
                      <UsersRound className="h-4 w-4 text-edsync-emerald" />
                      {thread.class_name || "Class"}
                    </p>
                  </div>
                </div>

                <details className="mt-4 rounded-lg border border-edsync-border bg-edsync-surface p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-edsync-text marker:hidden">
                    <MessageSquareText className="h-4 w-4 text-edsync-blue" />
                    Reply
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <textarea
                      className="edsync-input min-h-20"
                      value={responses[thread.id] ?? ""}
                      onChange={(event) =>
                        setResponses((current) => ({ ...current, [thread.id]: event.target.value }))
                      }
                      placeholder="Reply..."
                    />
                    <button className="btn-primary self-end justify-center" type="button" onClick={() => post(thread.id)}>
                      <Send className="h-4 w-4" />
                      Post
                    </button>
                  </div>
                </details>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
