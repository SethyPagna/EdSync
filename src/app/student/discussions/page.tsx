"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Thread = { id: string; title: string; prompt: string | null; class_name: string | null; post_count: number; updated_at: string };

export default function StudentDiscussionsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const load = () => {
    fetch("/api/discussions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setThreads(payload.data?.threads ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const post = async (threadId: string) => {
    const response = await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, body: responses[threadId] || "" }),
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
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Discussions</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Join class prompts and activity conversations.</p>
      </div>
      <div className="grid gap-4">
        {threads.map((thread) => (
          <article key={thread.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{thread.title}</h2>
              <span className="text-xs text-edsync-subtle">{thread.post_count} posts</span>
            </div>
            <p className="mt-1 text-sm text-edsync-subtle">{thread.class_name || "Class"} · updated {new Date(thread.updated_at).toLocaleString()}</p>
            {thread.prompt && <p className="mt-3 text-sm leading-6">{thread.prompt}</p>}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <textarea className="edsync-input min-h-20" value={responses[thread.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [thread.id]: event.target.value }))} placeholder="Add your response..." />
              <button className="btn-primary self-end justify-center" type="button" onClick={() => post(thread.id)}>Post</button>
            </div>
          </article>
        ))}
        {threads.length === 0 && <p className="edsync-card p-4 text-sm text-edsync-subtle">No discussions yet.</p>}
      </div>
    </div>
  );
}
