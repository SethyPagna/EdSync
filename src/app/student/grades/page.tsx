"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Check, Eye, EyeOff, MessageSquareText, TrendingUp } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Skeleton, StatTile, usePersistentState } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import { chunks } from "@/components/student-home/data";

type Score = { id: string; title: string; source_type: string; status: string; class_id: string | null; points_earned: number; points_possible: number; percent: number | null; feedback: string | null; category_name?: string | null; updated_at: string };
type GradeData = { scores: Score[]; overall: number | null; overallByClass: Record<string, number | null> };
type Visibility = { overall: boolean; scores: boolean; feedback: boolean };
const DEFAULT_VISIBILITY: Visibility = { overall: true, scores: true, feedback: true };

function percent(value: number | null) { return value === null ? "Pending" : `${Math.round(value)}%`; }

export default function StudentGradesPage() {
  const client = useMemo(() => createClient(), []);
  const [data, setData] = useState<GradeData>({ scores: [], overall: null, overallByClass: {} });
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [selectedClass, setSelectedClass] = useState("all");
  const [visibility, setVisibility] = usePersistentState<Visibility>("edsync-student-grade-visibility", DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/grades", { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null) as { data?: GradeData; error?: string | { message?: string } } | null;
      if (!response.ok || !payload?.data) throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? "Progress could not load.");
      const gradeData = payload.data;
      setData(gradeData);
      const ids = Object.keys(gradeData.overallByClass ?? {});
      if (ids.length) {
        const results = await Promise.all(chunks(ids).map((group) => client.from("classes").select("id, name").in("id", group)));
        const failed = results.find((result) => result.error);
        if (failed?.error) throw new Error(failed.error.message);
        setClassNames(Object.fromEntries(results.flatMap((result) => (result.data ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name])));
      } else setClassNames({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Progress could not load."); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const scores = data.scores.filter((score) => selectedClass === "all" || score.class_id === selectedClass);
  const gradedCount = data.scores.filter((score) => score.percent !== null).length;
  const feedbackCount = data.scores.filter((score) => Boolean(score.feedback)).length;
  const toggle = (key: keyof Visibility) => setVisibility((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="page">
      <PageHeader title="Progress" actions={<details className="relative"><summary className="btn btn-secondary btn-sm cursor-pointer list-none"><Eye className="size-4" />Visibility</summary><div className="absolute right-0 z-10 mt-2 min-w-44 rounded-lg border border-line bg-elevated p-2 shadow-soft">{(["overall", "scores", "feedback"] as const).map((key) => <button key={key} type="button" aria-pressed={visibility[key]} onClick={() => toggle(key)} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-fg hover:bg-surface-2">{visibility[key] ? <Eye className="size-4" /> : <EyeOff className="size-4" />}{key[0].toUpperCase() + key.slice(1)}</button>)}</div></details>} />
      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"><span>{error}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>}
      {loading ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}</div><Skeleton className="h-48 rounded-xl" /></div> : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3"><StatTile icon={TrendingUp} label="Overall" value={visibility.overall ? percent(data.overall) : "Hidden"} /><StatTile icon={Award} label="Results" value={gradedCount} /><StatTile icon={MessageSquareText} label="Feedback" value={feedbackCount} /></div>
          {Object.keys(data.overallByClass ?? {}).length > 0 && <section className="mb-6"><h2 className="mb-3 text-sm font-medium text-fg">By class</h2><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={selectedClass === "all"} onClick={() => setSelectedClass("all")} className="chip" data-active={selectedClass === "all"}>All</button>{Object.entries(data.overallByClass).map(([id, average]) => <button key={id} type="button" aria-pressed={selectedClass === id} onClick={() => setSelectedClass(id)} className="chip" data-active={selectedClass === id}>{classNames[id] ?? "Class"} · {visibility.overall ? percent(average) : "Hidden"}</button>)}</div></section>}
          <section><h2 className="mb-3 text-sm font-medium text-fg">Results</h2>{scores.length ? <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{scores.map((score) => <article key={score.id} className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 truncate text-sm font-medium text-fg">{score.title}</h3><Badge tone={score.status === "graded" ? "success" : "warning"}>{score.status === "graded" ? "Graded" : "To review"}</Badge></div><p className="mt-1 text-xs text-fg-muted">{classNames[score.class_id ?? ""] ?? score.category_name ?? score.source_type} · {new Date(score.updated_at).toLocaleDateString()}</p>{visibility.feedback && score.feedback && <p className="mt-2 text-sm text-fg-muted">{score.feedback}</p>}</div><div className="text-right"><p className="text-lg font-semibold tabular-nums text-fg">{visibility.scores ? percent(score.percent) : "Hidden"}</p>{visibility.scores && <p className="text-xs tabular-nums text-fg-muted">{score.points_earned}/{score.points_possible} pts</p>}</div></article>)}</div> : <EmptyState icon={Check} title="No results yet" compact />}</section>
        </>
      )}
    </div>
  );
}
