"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type WorkItem = {
  id: string;
  title: string;
  work_type: string;
  instructions: string | null;
  due_at: string | null;
  points_possible: number;
  class_name: string | null;
  submission_status: string | null;
  submission_percent: number | null;
};

export default function StudentWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const load = () => {
    fetch("/api/work", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.data ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (workItemId: string) => {
    const response = await fetch("/api/work/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, response: { text: responses[workItemId] || "" } }),
    });
    if (!response.ok) {
      toast.error("Submission was not saved.");
      return;
    }
    toast.success("Submitted.");
    setResponses((current) => ({ ...current, [workItemId]: "" }));
    load();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">My work</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Tasks, tests, quizzes, discussions, and activities assigned to you.</p>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <article key={item.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{item.title}</h2>
                <p className="mt-1 text-sm text-edsync-subtle">
                  {item.class_name || "Class"} · {item.work_type} · {item.points_possible} pts
                  {item.due_at ? ` · due ${new Date(item.due_at).toLocaleString()}` : ""}
                </p>
              </div>
              <span className="rounded-md border border-edsync-border px-2 py-1 text-xs capitalize text-edsync-subtle">
                {item.submission_status || "not submitted"}{item.submission_percent !== null && item.submission_percent !== undefined ? ` · ${item.submission_percent}%` : ""}
              </span>
            </div>
            {item.instructions && <p className="mt-3 text-sm leading-6">{item.instructions}</p>}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <textarea
                className="edsync-input min-h-24"
                value={responses[item.id] ?? ""}
                onChange={(event) => setResponses((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Write your response or reflection..."
              />
              <button type="button" onClick={() => submit(item.id)} className="btn-primary self-end justify-center">
                Submit
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="edsync-card p-4 text-sm text-edsync-subtle">No assigned work yet.</p>}
      </div>
    </div>
  );
}
