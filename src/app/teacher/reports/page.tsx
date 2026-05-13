"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/edsync/client";
import type { Lesson, Profile, StudentProgress } from "@/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface StudentReport {
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
}

export default function TeacherReports() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string>("");
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const edsync = createClient();

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) return;
      const { data } = await edsync
        .from("lessons")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      const list: Lesson[] = data || [];
      setLessons(list);
      if (list.length > 0) setSelectedLesson(list[0].id);
      setLoadingLessons(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedLesson) return;
    loadReport(selectedLesson);
  }, [selectedLesson]);

  const loadReport = async (lessonId: string) => {
    setLoading(true);

    const { data: progressRows } = await edsync
      .from("student_progress")
      .select("*")
      .eq("lesson_id", lessonId);

    if (!progressRows || progressRows.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    const progressList: StudentProgress[] = progressRows;
    const studentIds = progressList.map((p: StudentProgress) => p.student_id);

    const { data: profileRows } = await edsync
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentIds);

    const profileMap = new Map(
      ((profileRows || []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
        (p) => [p.id, p],
      ),
    );

    const built: StudentReport[] = progressList.map((p: StudentProgress) => {
      const profile = profileMap.get(p.student_id);
      return {
        id: p.student_id,
        name: profile?.full_name || "Unknown",
        email: profile?.email || "",
        status: p.status,
        score: p.score,
        diagnosticScore: p.diagnostic_score,
        finalScore: p.final_quiz_score,
        timeSpent: p.time_spent || 0,
        sectionsCompleted: (p.sections_completed || []).length,
        knowledgeGaps: p.knowledge_gaps || [],
      };
    });

    setReports(built.sort((a, b) => (b.score || 0) - (a.score || 0)));
    setLoading(false);
  };

  const exportCSV = () => {
    if (reports.length === 0) {
      return;
    }
    const lessonTitle =
      lessons.find((l) => l.id === selectedLesson)?.title || "Report";
    const rows = [
      "Student,Email,Status,Final Score,Diagnostic,Time (min),Sections Done,Knowledge Gaps",
      ...reports.map(
        (r) =>
          `"${r.name}","${r.email}","${r.status}","${r.score !== null ? r.score + "%" : "N/A"}","${r.diagnosticScore !== null ? r.diagnosticScore + "%" : "N/A"}","${Math.round(r.timeSpent / 60)}","${r.sectionsCompleted}","${r.knowledgeGaps.join("; ")}"`,
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edsync_report_${lessonTitle.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completed = reports.filter((r) => r.status === "completed");
  const inProgress = reports.filter((r) => r.status === "in_progress");
  const notStarted = reports.filter((r) => r.status === "not_started");
  const avgScore =
    completed.filter((r) => r.score !== null).length > 0
      ? Math.round(
          completed
            .filter((r) => r.score !== null)
            .reduce((a, r) => a + (r.score || 0), 0) /
            completed.filter((r) => r.score !== null).length,
        )
      : null;

  // Build a simple completion-over-time approximation from real completed_at data
  // (for now show a summary bar chart instead of time-series since we'd need historical snapshots)

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-edsync-text">
            Reports
          </h1>
          <p className="text-edsync-subtle">
            Detailed insights for grading and parent conferences
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={reports.length === 0}
          className="btn-secondary disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      {/* Lesson selector */}
      <div className="mb-6">
        {loadingLessons ? (
          <div className="h-10 w-64 bg-edsync-card rounded-xl shimmer" />
        ) : lessons.length === 0 ? (
          <p className="text-edsync-subtle">
            No lessons yet. Create a lesson to see reports.
          </p>
        ) : (
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
            className="edsync-input max-w-sm py-2"
          >
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-edsync-card rounded-2xl shimmer" />
          ))}
        </div>
      ) : reports.length === 0 && selectedLesson ? (
        <div className="edsync-card text-center py-16">
          <h3 className="font-display font-bold text-xl text-edsync-text mb-2">
            No student data yet
          </h3>
          <p className="text-edsync-subtle">
            Assign this lesson to a class and wait for students to start working
            on it.
          </p>
        </div>
      ) : reports.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Total Students",
                value: reports.length,
                icon: "STU",
                color: "blue",
              },
              {
                label: "Completed",
                value: completed.length,
                icon: "DONE",
                color: "emerald",
              },
              {
                label: "In Progress",
                value: inProgress.length,
                icon: "LIVE",
                color: "blue",
              },
              {
                label: "Avg Score",
                value: avgScore !== null ? `${avgScore}%` : "N/A",
                icon: "AVG",
                color:
                  avgScore !== null && avgScore >= 70 ? "emerald" : "amber",
              },
            ].map((s, i) => (
              <div key={i} className="edsync-card">
                <span className="text-xs font-semibold tracking-wide text-edsync-subtle block mb-2">
                  {s.icon}
                </span>
                <p className="font-display font-bold text-2xl text-edsync-text">
                  {s.value}
                </p>
                <p className="text-edsync-subtle text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Student Report Table */}
          <div className="edsync-card">
            <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
              {" "}
              Individual Student Report
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-edsync-border">
                    {[
                      "Student",
                      "Status",
                      "Final Score",
                      "Diagnostic",
                      "Time (min)",
                      "Sections",
                      "Knowledge Gaps",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs text-edsync-subtle font-medium pb-3 pr-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-edsync-border/50 hover:bg-edsync-surface/50"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-edsync-text text-sm">
                          {r.name}
                        </p>
                        <p className="text-xs text-edsync-subtle">{r.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`badge text-xs ${
                            r.status === "completed"
                              ? "bg-edsync-emerald/10 text-edsync-emerald border-edsync-emerald/20"
                              : r.status === "in_progress"
                                ? "bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20"
                                : "bg-edsync-muted/30 text-edsync-subtle"
                          }`}
                        >
                          {r.status === "not_started"
                            ? "Not started"
                            : r.status === "in_progress"
                              ? "In progress"
                              : "Completed"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {r.score !== null ? (
                          <span
                            className={`font-bold text-sm ${r.score >= 80 ? "text-edsync-emerald" : r.score >= 60 ? "text-edsync-amber" : "text-edsync-red"}`}
                          >
                            {Math.round(r.score)}%
                          </span>
                        ) : (
                          <span className="text-edsync-subtle text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-edsync-subtle">
                        {r.diagnosticScore !== null
                          ? `${Math.round(r.diagnosticScore)}%`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-edsync-subtle">
                        {r.timeSpent > 0 ? Math.round(r.timeSpent / 60) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-edsync-subtle">
                        {r.sectionsCompleted}
                      </td>
                      <td className="py-3 pr-4 text-sm text-edsync-subtle">
                        {r.knowledgeGaps.length > 0 ? (
                          r.knowledgeGaps.join(", ")
                        ) : (
                          <span className="text-edsync-emerald/70">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
