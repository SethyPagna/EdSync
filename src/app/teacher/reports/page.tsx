"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/edsync/client";
import { averageScore, csvCell } from "@/components/teacher-home/metrics";
import { Badge, Button, Card, EmptyState, PageHeader, Section, Skeleton, StatTile, Toolbar } from "@/components/ui";
import type { Lesson, Profile, StudentProgress } from "@/types";
import { BookOpen, CheckCircle2, Clock3, Download, FileSpreadsheet, UsersRound } from "lucide-react";

type StudentReport = {
  id: string;
  name: string;
  email: string;
  status: string;
  score: number | null;
  diagnosticScore: number | null;
  finalScore: number | null;
  timeSpent: number;
  sectionsCompleted: number;
  knowledgeGaps: string[];
};

function statusLabel(status: string) {
  return status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not started";
}

export default function TeacherReports() {
  const edsync = useMemo(() => createClient(), []);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("");
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  const loadLessons = useCallback(async () => {
    setLoadingLessons(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to view reports.");
      const result = await edsync.from("lessons").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
      if (result.error) throw new Error("Could not load courses.");
      const list = (result.data || []) as Lesson[];
      setLessons(list);
      setSelectedLesson((current) => list.some((lesson) => lesson.id === current) ? current : list[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load courses.");
    } finally {
      setLoadingLessons(false);
    }
  }, [edsync]);

  const loadReport = useCallback(async (lessonId: string) => {
    setLoadingReport(true);
    setError("");
    setReports([]);
    try {
      const progressRes = await edsync.from("student_progress").select("*").eq("lesson_id", lessonId);
      if (progressRes.error) throw new Error("Could not load learner results.");
      const progress = (progressRes.data || []) as StudentProgress[];
      if (progress.length === 0) { setReports([]); return; }
      const studentIds = [...new Set(progress.map((row) => row.student_id))];
      const profilesRes = await edsync.from("profiles").select("id, full_name, email").in("id", studentIds);
      if (profilesRes.error) throw new Error("Could not load learner details.");
      const profiles = new Map(((profilesRes.data || []) as Pick<Profile, "id" | "full_name" | "email">[]).map((row) => [row.id, row]));
      const rows = progress.map((row): StudentReport => ({
        id: row.student_id,
        name: profiles.get(row.student_id)?.full_name || "Learner",
        email: profiles.get(row.student_id)?.email || "",
        status: row.status,
        score: row.score,
        diagnosticScore: row.diagnostic_score,
        finalScore: row.final_quiz_score,
        timeSpent: row.time_spent || 0,
        sectionsCompleted: row.sections_completed?.length || 0,
        knowledgeGaps: row.knowledge_gaps || [],
      }));
      setReports(rows.sort((left, right) => (right.score ?? -1) - (left.score ?? -1)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this report.");
    } finally {
      setLoadingReport(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLessons(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLessons]);

  useEffect(() => {
    if (!selectedLesson) return;
    const timer = window.setTimeout(() => { void loadReport(selectedLesson); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReport, selectedLesson]);

  const summary = useMemo(() => {
    const completed = reports.filter((row) => row.status === "completed");
    return {
      completed: completed.length,
      inProgress: reports.filter((row) => row.status === "in_progress").length,
      average: averageScore(completed.map((row) => row.score)),
    };
  }, [reports]);

  const exportCSV = () => {
    if (!reports.length) return;
    const title = lessons.find((lesson) => lesson.id === selectedLesson)?.title || "Course";
    const header = ["Learner", "Email", "Status", "Final result", "Diagnostic", "Final quiz", "Time (min)", "Pages done", "Knowledge gaps"];
    const rows = [
      header.map(csvCell).join(","),
      ...reports.map((row) => [
        row.name, row.email, statusLabel(row.status),
        row.score === null ? "N/A" : `${row.score}%`,
        row.diagnosticScore === null ? "N/A" : `${row.diagnosticScore}%`,
        row.finalScore === null ? "N/A" : `${row.finalScore}%`,
        Math.round(row.timeSpent / 60), row.sectionsCompleted, row.knowledgeGaps.join("; "),
      ].map(csvCell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `edsync-report-${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "course"}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="page space-y-6">
      <PageHeader title="Reports" actions={<Button variant="secondary" size="sm" icon={Download} onClick={exportCSV} disabled={!reports.length || loadingReport}>Export CSV</Button>} />
      <Toolbar>
        <label htmlFor="report-course" className="sr-only">Course</label>
        {loadingLessons ? <Skeleton className="h-9 w-56" /> : (
          <select id="report-course" value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="select min-w-0 max-w-full sm:w-72" disabled={!lessons.length}>
            {lessons.length ? lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>) : <option value="">No courses</option>}
          </select>
        )}
      </Toolbar>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => void (selectedLesson ? loadReport(selectedLesson) : loadLessons())} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      ) : null}
      {!loadingLessons && !lessons.length ? (
        <Card><EmptyState icon={BookOpen} title="No courses yet" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <StatTile label="Learners" value={loadingReport ? "…" : reports.length} icon={UsersRound} tone="accent" />
            <StatTile label="Completed" value={loadingReport ? "…" : summary.completed} icon={CheckCircle2} tone="success" />
            <StatTile label="In progress" value={loadingReport ? "…" : summary.inProgress} icon={Clock3} tone="warning" />
            <StatTile label="Average" value={loadingReport ? "…" : summary.average === null ? "—" : `${summary.average}%`} icon={FileSpreadsheet} tone="neutral" />
          </div>
          <Section title="Learner results" count={reports.length}>
            <Card padding="none" className="overflow-hidden">
              {loadingReport ? <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
                : reports.length ? reports.map((row) => (
                  <details key={row.id} className="border-b border-line px-4 py-3 last:border-0">
                    <summary className="flex min-w-0 cursor-pointer items-center gap-3 text-[13px]">
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium text-fg">{row.name}</span><span className="block truncate text-xs text-fg-faint">{row.email || statusLabel(row.status)}</span></span>
                      <Badge tone={row.status === "completed" ? "success" : row.status === "in_progress" ? "accent" : "neutral"}>{statusLabel(row.status)}</Badge>
                      <span className="w-11 shrink-0 text-right font-semibold tabular-nums text-fg">{row.score === null ? "—" : `${Math.round(row.score)}%`}</span>
                    </summary>
                    <div className="mt-3 grid gap-2 border-t border-line pt-3 text-xs text-fg-muted sm:grid-cols-2 lg:grid-cols-4">
                      <span>Diagnostic <strong className="font-medium text-fg">{row.diagnosticScore === null ? "—" : `${Math.round(row.diagnosticScore)}%`}</strong></span>
                      <span>Final quiz <strong className="font-medium text-fg">{row.finalScore === null ? "—" : `${Math.round(row.finalScore)}%`}</strong></span>
                      <span>Time <strong className="font-medium text-fg">{row.timeSpent ? `${Math.round(row.timeSpent / 60)} min` : "—"}</strong></span>
                      <span>Pages <strong className="font-medium text-fg">{row.sectionsCompleted}</strong></span>
                      {row.knowledgeGaps.length ? <div className="sm:col-span-2 lg:col-span-4"><span className="mr-2">Gaps</span>{row.knowledgeGaps.map((gap) => <Badge key={gap} tone="warning" className="mr-1">{gap}</Badge>)}</div> : null}
                    </div>
                  </details>
                )) : <EmptyState compact icon={FileSpreadsheet} title="No learner data yet" />}
            </Card>
          </Section>
        </>
      )}
    </div>
  );
}
