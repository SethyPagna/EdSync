"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, MessageSquareText, TrendingUp } from "lucide-react";

type Score = {
  id: string;
  title: string;
  source_type: string;
  points_earned: number;
  points_possible: number;
  percent: number | null;
  feedback: string | null;
  category_name?: string | null;
  updated_at: string;
};

function percentText(value: number | null) {
  return value === null ? "Not graded" : `${value}%`;
}

export default function StudentGradesPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [overall, setOverall] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/grades", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setScores(payload.data?.scores ?? []);
        setOverall(payload.data?.overall ?? null);
      });
  }, []);

  const gradedScores = useMemo(() => scores.filter((score) => score.percent !== null), [scores]);
  const feedbackCount = useMemo(() => scores.filter((score) => Boolean(score.feedback)).length, [scores]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">
              Progress
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Grades</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {gradedScores.length} graded item{gradedScores.length !== 1 ? "s" : ""}, {feedbackCount} with feedback
            </p>
          </div>
          <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-center">
            <p className="text-sm font-semibold text-edsync-subtle">Overall</p>
            <p className="mt-2 font-display text-4xl font-bold">{percentText(overall)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={TrendingUp} label="Current overall" value={percentText(overall)} tone="text-edsync-blue" />
        <SummaryTile icon={CheckCircle2} label="Graded" value={gradedScores.length} tone="text-edsync-emerald" />
        <SummaryTile icon={MessageSquareText} label="Feedback" value={feedbackCount} tone="text-edsync-amber" />
      </section>

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="border-b border-edsync-border p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Score history</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {scores.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No grades yet.</p>
          ) : (
            scores.map((score) => (
              <article key={score.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_8rem] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="badge bg-edsync-blue/10 text-edsync-blue">{score.source_type}</span>
                    <span className="badge bg-edsync-surface text-edsync-subtle">{score.category_name || "uncategorized"}</span>
                  </div>
                  <h3 className="truncate font-display text-lg font-bold">{score.title}</h3>
                  <p className="mt-1 text-sm text-edsync-subtle">
                    {score.points_earned} / {score.points_possible} points
                  </p>
                  {score.feedback && (
                    <p className="mt-3 rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm leading-6">
                      {score.feedback}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-center">
                  <p className="font-display text-2xl font-bold">{percentText(score.percent)}</p>
                  <p className="mt-1 text-xs text-edsync-subtle">
                    {new Date(score.updated_at).toLocaleDateString()}
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

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-edsync-border bg-edsync-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-edsync-subtle">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-current/10 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
