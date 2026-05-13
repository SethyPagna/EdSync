"use client";

import { useEffect, useState } from "react";

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

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Grades</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Track feedback, points, and graded work.</p>
      </div>

      <div className="edsync-card p-5">
        <p className="text-sm font-semibold text-edsync-subtle">Current overall</p>
        <p className="mt-2 text-5xl font-bold">{overall ?? "—"}{overall !== null ? "%" : ""}</p>
      </div>

      <div className="grid gap-3">
        {scores.map((score) => (
          <article key={score.id} className="edsync-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">{score.title}</h2>
                <p className="mt-1 text-sm capitalize text-edsync-subtle">{score.source_type} · {score.category_name || "uncategorized"}</p>
              </div>
              <p className="text-2xl font-bold">{score.percent ?? "—"}{score.percent !== null ? "%" : ""}</p>
            </div>
            <p className="mt-2 text-sm text-edsync-subtle">{score.points_earned} / {score.points_possible} points</p>
            {score.feedback && <p className="mt-3 text-sm leading-6">{score.feedback}</p>}
          </article>
        ))}
        {scores.length === 0 && <p className="edsync-card p-4 text-sm text-edsync-subtle">No grades yet.</p>}
      </div>
    </div>
  );
}
