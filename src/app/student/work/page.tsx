"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BookOpenCheck, CalendarClock, CheckCircle2, Send, TimerReset } from "lucide-react";

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

type WorkFilter = "open" | "submitted" | "all";

const FILTERS: Array<{ key: WorkFilter; label: string }> = [
  { key: "open", label: "To do" },
  { key: "submitted", label: "Submitted" },
  { key: "all", label: "All" },
];

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSubmitted(item: WorkItem) {
  return item.submission_status === "submitted" || item.submission_status === "graded";
}

export default function StudentWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<WorkFilter>("open");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/work", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setItems(payload.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (workItemId: string) => {
    const responseText = responses[workItemId] || "";
    if (!responseText.trim()) {
      toast.error("Write a response first.");
      return;
    }

    const response = await fetch("/api/work/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId, response: { text: responseText } }),
    });
    if (!response.ok) {
      toast.error("Submission was not saved.");
      return;
    }
    toast.success("Submitted.");
    setResponses((current) => ({ ...current, [workItemId]: "" }));
    load();
  };

  const filteredItems = useMemo(() => {
    if (filter === "submitted") return items.filter(isSubmitted);
    if (filter === "open") return items.filter((item) => !isSubmitted(item));
    return items;
  }, [filter, items]);

  const openCount = items.filter((item) => !isSubmitted(item)).length;
  const submittedCount = items.length - openCount;

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">
              Assignments
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">My work</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {openCount} to do, {submittedCount} submitted
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  filter === item.key
                    ? "bg-edsync-emerald text-white"
                    : "border border-edsync-border bg-edsync-surface text-edsync-subtle hover:text-edsync-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-32 rounded-xl bg-edsync-card shimmer" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-edsync-emerald" />
          <p className="font-semibold text-edsync-text">
            {filter === "open" ? "Nothing due right now" : "No work in this view"}
          </p>
          <p className="mt-2 text-sm text-edsync-subtle">
            New tasks, tests, discussions, and activities will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <article key={item.id} className="rounded-xl border border-edsync-border bg-edsync-card p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="badge bg-edsync-blue/10 text-edsync-blue">
                      {item.work_type}
                    </span>
                    <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                      {item.points_possible} pts
                    </span>
                    {isSubmitted(item) && (
                      <span className="badge bg-edsync-amber/10 text-edsync-amber">
                        {item.submission_percent ?? 0}%
                      </span>
                    )}
                  </div>
                  <h2 className="truncate font-display text-xl font-bold">{item.title}</h2>
                  <p className="mt-1 text-sm text-edsync-subtle">
                    {item.class_name || "Class"}
                  </p>
                  {item.instructions && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-edsync-text">
                      {item.instructions}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-edsync-text">
                    <CalendarClock className="h-4 w-4 text-edsync-blue" />
                    {dueLabel(item.due_at)}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-edsync-subtle">
                    {isSubmitted(item) ? (
                      <CheckCircle2 className="h-4 w-4 text-edsync-emerald" />
                    ) : (
                      <TimerReset className="h-4 w-4 text-edsync-amber" />
                    )}
                    {item.submission_status || "not submitted"}
                  </p>
                </div>
              </div>

              {!isSubmitted(item) && (
                <details className="mt-4 rounded-lg border border-edsync-border bg-edsync-surface p-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-edsync-text marker:hidden">
                    <BookOpenCheck className="h-4 w-4 text-edsync-blue" />
                    Write response
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <textarea
                      className="edsync-input min-h-24"
                      value={responses[item.id] ?? ""}
                      onChange={(event) =>
                        setResponses((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      placeholder="Write your response or reflection..."
                    />
                    <button
                      type="button"
                      onClick={() => submit(item.id)}
                      className="btn-primary self-end justify-center"
                    >
                      <Send className="h-4 w-4" />
                      Submit
                    </button>
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
