"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/edsync/client";
import type { Lesson } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatRelativeTime } from "@/lib/utils";

interface StudentStat {
  id: string;
  name: string;
  email: string;
  lessonsCompleted: number;
  avgScore: number | null;
  aiInteractions: number;
  reflectionCount: number;
  lowConfidenceReflections: number;
  status: "on_track" | "at_risk" | "advanced";
}

interface LessonStat {
  id: string;
  title: string;
  studentsStarted: number;
  studentsCompleted: number;
  avgScore: number | null;
  knowledgeGaps: string[];
}

interface SocraticEntry {
  id: string;
  student_name: string;
  student_question: string;
  created_at: string;
  lesson_title?: string;
}

interface ReflectionEntry {
  id: string;
  student_name: string;
  lesson_title?: string;
  notes_preview: string;
  confidence: number;
  guiding_question: string;
  created_at: string;
}

type Tab =
  | "overview"
  | "heatmap"
  | "students"
  | "reflections"
  | "socratic"
  | "interventions";

export default function TeacherAnalytics() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonStats, setLessonStats] = useState<LessonStat[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStat[]>([]);
  const [socraticLog, setSocraticLog] = useState<SocraticEntry[]>([]);
  const [reflectionLog, setReflectionLog] = useState<ReflectionEntry[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedLesson, setSelectedLesson] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [gettingSuggestions, setGettingSuggestions] = useState(false);
  const edsync = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;

    const { data: lessonData } = await edsync
      .from("lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    const myLessons: Lesson[] = lessonData || [];
    setLessons(myLessons);

    if (myLessons.length === 0) {
      setLoading(false);
      return;
    }

    const lessonIds = myLessons.map((l) => l.id);
    const titleMap = new Map(myLessons.map((l) => [l.id, l.title]));

    const { data: progressData } = await edsync
      .from("student_progress")
      .select("*")
      .in("lesson_id", lessonIds);

    const { data: socraticData } = await edsync
      .from("socratic_interactions")
      .select("id, student_question, created_at, student_id, lesson_id")
      .in("lesson_id", lessonIds)
      .order("created_at", { ascending: false })
      .limit(30);

    // Student IDs for profile lookup
    const allStudentIds = Array.from(
      new Set([
        ...(progressData || []).map((p: any) => p.student_id),
        ...(socraticData || []).map((s: any) => s.student_id),
      ]),
    );

    const profileMap = new Map<string, { full_name: string; email: string }>();
    if (allStudentIds.length > 0) {
      const { data: profileData } = await edsync
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allStudentIds);
      (profileData || []).forEach((p: any) =>
        profileMap.set(p.id, { full_name: p.full_name, email: p.email }),
      );
    }

    // Build lesson stats
    const lStats: LessonStat[] = myLessons.map((lesson) => {
      const lp = (progressData || []).filter(
        (p: any) => p.lesson_id === lesson.id,
      );
      const scores = lp
        .filter((p: any) => p.score !== null)
        .map((p: any) => p.score);
      const gaps = lp.flatMap((p: any) => p.knowledge_gaps || []);
      const gapCounts: Record<string, number> = {};
      gaps.forEach((g: string) => {
        gapCounts[g] = (gapCounts[g] || 0) + 1;
      });
      const topGaps = Object.entries(gapCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
      return {
        id: lesson.id,
        title: lesson.title,
        studentsStarted: lp.filter((p: any) => p.status !== "not_started")
          .length,
        studentsCompleted: lp.filter((p: any) => p.status === "completed")
          .length,
        avgScore:
          scores.length > 0
            ? Math.round(
                scores.reduce((a: number, b: number) => a + b, 0) /
                  scores.length,
              )
            : null,
        knowledgeGaps: topGaps,
      };
    });
    setLessonStats(lStats);

    // Build student stats
    const studentMap = new Map<string, StudentStat>();
    const reflectionEntries: ReflectionEntry[] = [];

    for (const p of progressData || []) {
      const prof = profileMap.get(p.student_id);
      const existing = studentMap.get(p.student_id) ?? {
        id: p.student_id,
        name: prof?.full_name || "Unknown",
        email: prof?.email || "",
        lessonsCompleted: 0,
        avgScore: null,
        aiInteractions: 0,
        reflectionCount: 0,
        lowConfidenceReflections: 0,
        status: "on_track" as const,
      };
      if (p.status === "completed") existing.lessonsCompleted++;
      if (p.score !== null) {
        existing.avgScore =
          existing.avgScore === null
            ? p.score
            : Math.round((existing.avgScore + p.score) / 2);
      }

      const reflections = Array.isArray(p?.metadata?.reflections)
        ? p.metadata.reflections
        : [];

      if (reflections.length > 0) {
        existing.reflectionCount += reflections.length;

        reflections.forEach((entry: any, index: number) => {
          const confidenceValue = Number(entry?.confidence);
          const confidence = Number.isFinite(confidenceValue)
            ? Math.min(5, Math.max(1, Math.round(confidenceValue)))
            : 3;

          if (confidence <= 2) {
            existing.lowConfidenceReflections++;
          }

          const notes =
            typeof entry?.notes === "string" && entry.notes.trim()
              ? entry.notes.trim()
              : "No notes provided.";

          reflectionEntries.push({
            id: typeof entry?.id === "string" ? entry.id : `${p.id}-${index}`,
            student_name: prof?.full_name || "Unknown",
            lesson_title: titleMap.get(p.lesson_id),
            notes_preview:
              notes.length > 180 ? `${notes.slice(0, 180)}...` : notes,
            confidence,
            guiding_question:
              typeof entry?.advice?.guidingQuestion === "string"
                ? entry.advice.guidingQuestion
                : "No guiding question captured.",
            created_at:
              typeof entry?.created_at === "string"
                ? entry.created_at
                : p.last_active,
          });
        });
      }

      studentMap.set(p.student_id, existing);
    }
    for (const s of socraticData || []) {
      const e = studentMap.get(s.student_id);
      if (e) {
        e.aiInteractions++;
        studentMap.set(s.student_id, e);
      }
    }
    // Classify status
    const students = Array.from(studentMap.values()).map((s) => ({
      ...s,
      status: (s.avgScore === null
        ? "on_track"
        : s.avgScore >= 80
          ? "advanced"
          : s.avgScore < 60
            ? "at_risk"
            : "on_track") as StudentStat["status"],
    }));
    setStudentStats(students);
    setReflectionLog(
      reflectionEntries
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 40),
    );

    // Socratic log
    setSocraticLog(
      (socraticData || []).map((s: any) => ({
        id: s.id,
        student_name: profileMap.get(s.student_id)?.full_name || "Unknown",
        student_question: s.student_question,
        created_at: s.created_at,
        lesson_title: titleMap.get(s.lesson_id),
      })),
    );

    setLoading(false);
  };

  const getInterventions = async () => {
    setGettingSuggestions(true);
    try {
      const res = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentStats, lessonStats }),
      });
      const data = await res.json();
      if (data.suggestions) setAiSuggestions(data.suggestions);
      else setAiSuggestions(["No specific interventions needed at this time."]);
    } catch {
      setAiSuggestions([
        "Could not load AI suggestions. Check your OpenRouter API key.",
      ]);
    }
    setGettingSuggestions(false);
  };

  const filteredLessonStats =
    selectedLesson === "all"
      ? lessonStats
      : lessonStats.filter((l) => l.id === selectedLesson);
  const atRisk = studentStats.filter((s) => s.status === "at_risk");
  const advanced = studentStats.filter((s) => s.status === "advanced");
  const onTrack = studentStats.filter((s) => s.status === "on_track");
  const totalReflections = reflectionLog.length;
  const lowConfidenceReflections = reflectionLog.filter(
    (entry) => entry.confidence <= 2,
  ).length;
  const avgScore =
    studentStats.filter((s) => s.avgScore !== null).length > 0
      ? Math.round(
          studentStats
            .filter((s) => s.avgScore !== null)
            .reduce((a, s) => a + (s.avgScore || 0), 0) /
            studentStats.filter((s) => s.avgScore !== null).length,
        )
      : 0;
  const allGaps = lessonStats.flatMap((l) => l.knowledgeGaps);
  const gapCounts: Record<string, number> = {};
  allGaps.forEach((g) => {
    gapCounts[g] = (gapCounts[g] || 0) + 1;
  });
  const topGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const chartData = filteredLessonStats.map((l) => ({
    name: l.title.length > 16 ? l.title.slice(0, 14) + "…" : l.title,
    Started: l.studentsStarted,
    Completed: l.studentsCompleted,
    Score: l.avgScore ?? 0,
  }));

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "heatmap", label: "Heat Map" },
    { key: "students", label: "Students" },
    { key: "reflections", label: "Reflections" },
    { key: "interventions", label: "Interventions" },
    { key: "socratic", label: "Socratic Log" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-edsync-text">
            Analytics Dashboard
          </h1>
          <p className="text-edsync-subtle">Real-time classroom insights</p>
        </div>
        <select
          value={selectedLesson}
          onChange={(e) => setSelectedLesson(e.target.value)}
          className="edsync-input w-56 py-2"
        >
          <option value="all">All Lessons</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[
          {
            label: "Total Students",
            value: loading ? "…" : studentStats.length,
            icon: "STU",
            color: "blue",
          },
          {
            label: "Class Avg Score",
            value: loading
              ? "…"
              : studentStats.length === 0
                ? "N/A"
                : `${avgScore}%`,
            icon: "AVG",
            color: "emerald",
          },
          {
            label: "At Risk (<60%)",
            value: loading ? "…" : atRisk.length,
            icon: "RISK",
            color: "red",
          },
          {
            label: "AI Interactions",
            value: loading
              ? "…"
              : studentStats.reduce((a, s) => a + s.aiInteractions, 0),
            icon: "AI",
            color: "purple",
          },
          {
            label: "Reflections Logged",
            value: loading ? "…" : totalReflections,
            icon: "RFL",
            color: "cyan",
          },
          {
            label: "Low Confidence Reflections",
            value: loading ? "…" : lowConfidenceReflections,
            icon: "LC",
            color: "amber",
          },
        ].map((s, i) => (
          <div key={i} className="edsync-card">
            <span className="text-xl block mb-2">{s.icon}</span>
            <p className="font-display font-bold text-2xl text-edsync-text">
              {s.value}
            </p>
            <p className="text-edsync-subtle text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key
                ? "bg-edsync-blue text-white"
                : "bg-edsync-card text-edsync-subtle hover:text-edsync-text border border-edsync-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-edsync-card rounded-2xl shimmer" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <div className="edsync-card text-center py-16">
          <h2 className="font-display font-bold text-xl text-edsync-text mb-2">
            No data yet
          </h2>
          <p className="text-edsync-subtle">
            Create and assign lessons to students to see analytics.
          </p>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div className="animate-fade-in space-y-6">
              <div className="edsync-card">
                <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
                  Lesson Completion
                </h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#8B95A7", fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: "#8B95A7", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#111827",
                          border: "1px solid #1F2937",
                          borderRadius: 8,
                          color: "#E8EDF5",
                        }}
                      />
                      <Bar
                        dataKey="Started"
                        fill="#4F86F7"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Completed"
                        fill="#23D18B"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-edsync-subtle text-sm text-center py-8">
                    No student progress recorded yet.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLessonStats.map((lesson) => (
                  <div key={lesson.id} className="edsync-card">
                    <p className="font-semibold text-edsync-text text-sm mb-3 truncate">
                      {lesson.title}
                    </p>
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-edsync-subtle">Started</span>
                        <span className="text-edsync-blue font-medium">
                          {lesson.studentsStarted}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-edsync-subtle">Completed</span>
                        <span className="text-edsync-emerald font-medium">
                          {lesson.studentsCompleted}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-edsync-subtle">Avg Score</span>
                        <span
                          className={`font-bold ${lesson.avgScore === null ? "text-edsync-subtle" : lesson.avgScore >= 80 ? "text-edsync-emerald" : lesson.avgScore >= 60 ? "text-edsync-amber" : "text-edsync-red"}`}
                        >
                          {lesson.avgScore !== null
                            ? `${lesson.avgScore}%`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    {lesson.knowledgeGaps.length > 0 && (
                      <div className="pt-2 border-t border-edsync-border">
                        <p className="text-xs text-edsync-subtle mb-1">
                          Top Gaps
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {lesson.knowledgeGaps.map((g) => (
                            <span
                              key={g}
                              className="badge bg-edsync-red/10 text-edsync-red border-edsync-red/20 text-xs"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── HEAT MAP ── */}
          {tab === "heatmap" && (
            <div className="animate-fade-in space-y-6">
              {/* Class readiness */}
              <div className="edsync-card">
                <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
                  Classroom Readiness Map
                </h3>
                <p className="text-edsync-subtle text-sm mb-5">
                  Color-coded view of student understanding across concepts
                </p>
                {studentStats.length === 0 ? (
                  <p className="text-edsync-subtle text-sm text-center py-8">
                    No student data yet. Assign lessons to get started.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-edsync-border">
                          <th className="text-left text-xs text-edsync-subtle font-medium pb-3 pr-4">
                            Student
                          </th>
                          {filteredLessonStats.slice(0, 5).map((l) => (
                            <th
                              key={l.id}
                              className="text-center text-xs text-edsync-subtle font-medium pb-3 px-2 max-w-[100px]"
                            >
                              <span className="block truncate">
                                {l.title.slice(0, 14)}
                                {l.title.length > 14 ? "…" : ""}
                              </span>
                            </th>
                          ))}
                          <th className="text-center text-xs text-edsync-subtle font-medium pb-3 px-2">
                            Overall
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentStats.map((student) => (
                          <tr
                            key={student.id}
                            className="border-b border-edsync-border/50 hover:bg-edsync-surface/50"
                          >
                            <td className="py-3 pr-4">
                              <p className="text-sm font-medium text-edsync-text">
                                {student.name}
                              </p>
                              <p className="text-xs text-edsync-subtle">
                                {student.email}
                              </p>
                            </td>
                            {filteredLessonStats.slice(0, 5).map((l) => {
                              const score = l.avgScore;
                              return (
                                <td
                                  key={l.id}
                                  className="py-3 px-2 text-center"
                                >
                                  <div
                                    className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center text-xs font-bold ${
                                      score === null
                                        ? "bg-edsync-muted/20 text-edsync-subtle"
                                        : score >= 80
                                          ? "bg-edsync-emerald/20 text-edsync-emerald border border-edsync-emerald/30"
                                          : score >= 60
                                            ? "bg-edsync-amber/20 text-edsync-amber border border-edsync-amber/30"
                                            : "bg-edsync-red/20 text-edsync-red border border-edsync-red/30"
                                    }`}
                                  >
                                    {score !== null ? `${score}` : "—"}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`font-bold text-sm ${
                                  student.status === "advanced"
                                    ? "text-edsync-emerald"
                                    : student.status === "at_risk"
                                      ? "text-edsync-red"
                                      : "text-edsync-amber"
                                }`}
                              >
                                {student.avgScore !== null
                                  ? `${student.avgScore}%`
                                  : "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex gap-4 mt-4 text-xs text-edsync-subtle">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-edsync-emerald/20 border border-edsync-emerald/30 inline-block" />{" "}
                    ≥80% Mastered
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-edsync-amber/20 border border-edsync-amber/30 inline-block" />{" "}
                    60–79% Developing
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-edsync-red/20 border border-edsync-red/30 inline-block" />{" "}
                    &lt;60% At Risk
                  </span>
                </div>
              </div>

              {/* Knowledge gap summary */}
              {topGaps.length > 0 && (
                <div className="edsync-card">
                  <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
                    Class-Wide Knowledge Gaps
                  </h3>
                  <p className="text-edsync-subtle text-sm mb-4">
                    Concepts where multiple students are struggling
                  </p>
                  <div className="space-y-3">
                    {topGaps.map(([gap, count]) => (
                      <div key={gap} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-edsync-text font-medium">
                              {gap}
                            </span>
                            <span className="text-edsync-red text-xs font-bold">
                              {count} student{count > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="h-2 bg-edsync-muted/20 rounded-full">
                            <div
                              className="h-full bg-edsync-red/50 rounded-full"
                              style={{
                                width: `${Math.min(100, (count / Math.max(1, studentStats.length)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STUDENTS ── */}
          {tab === "students" && (
            <div className="animate-fade-in space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-2">
                {[
                  {
                    label: "Advanced",
                    count: advanced.length,
                    color: "emerald",
                    items: advanced,
                  },
                  {
                    label: "On Track",
                    count: onTrack.length,
                    color: "blue",
                    items: onTrack,
                  },
                  {
                    label: "At Risk",
                    count: atRisk.length,
                    color: "red",
                    items: atRisk,
                  },
                ].map((group, i) => (
                  <div key={i} className="edsync-card py-3 px-4">
                    <p className="text-xs text-edsync-subtle mb-1">
                      {group.label}
                    </p>
                    <p
                      className={`font-display font-bold text-2xl text-edsync-${group.color}`}
                    >
                      {group.count}
                    </p>
                  </div>
                ))}
              </div>
              <div className="edsync-card overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-left border-b border-edsync-border">
                      <th className="text-xs text-edsync-subtle font-medium pb-3 pr-4">
                        Student
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        Status
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        Completed
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        Avg Score
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        AI Chats
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        Reflections
                      </th>
                      <th className="text-xs text-edsync-subtle font-medium pb-3 px-3 text-center">
                        Low Conf.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentStats.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-edsync-subtle text-sm"
                        >
                          No students have started your lessons yet.
                        </td>
                      </tr>
                    ) : (
                      studentStats
                        .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
                        .map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-edsync-border/50 hover:bg-edsync-surface/50"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-medium text-edsync-text text-sm">
                                {s.name}
                              </p>
                              <p className="text-xs text-edsync-subtle">
                                {s.email}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`badge text-xs ${
                                  s.status === "advanced"
                                    ? "bg-edsync-emerald/10 text-edsync-emerald border-edsync-emerald/20"
                                    : s.status === "at_risk"
                                      ? "bg-edsync-red/10 text-edsync-red border-edsync-red/20"
                                      : "bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20"
                                }`}
                              >
                                {s.status === "at_risk"
                                  ? "At Risk"
                                  : s.status === "advanced"
                                    ? "Advanced"
                                    : "On Track"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-sm text-edsync-text font-medium">
                              {s.lessonsCompleted}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {s.avgScore !== null ? (
                                <span
                                  className={`font-bold text-sm ${s.avgScore >= 80 ? "text-edsync-emerald" : s.avgScore >= 60 ? "text-edsync-amber" : "text-edsync-red"}`}
                                >
                                  {s.avgScore}%
                                </span>
                              ) : (
                                <span className="text-edsync-subtle text-xs">
                                  No score
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-sm font-medium ${s.aiInteractions > 0 ? "text-edsync-purple" : "text-edsync-subtle"}`}
                              >
                                {s.aiInteractions}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-sm font-medium ${s.reflectionCount > 0 ? "text-edsync-cyan" : "text-edsync-subtle"}`}
                              >
                                {s.reflectionCount}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-sm font-medium ${s.lowConfidenceReflections > 0 ? "text-edsync-amber" : "text-edsync-subtle"}`}
                              >
                                {s.lowConfidenceReflections}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── REFLECTIONS ── */}
          {tab === "reflections" && (
            <div className="animate-fade-in space-y-6">
              <div className="edsync-card">
                <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
                  Student Reflection Log
                </h3>
                <p className="text-edsync-subtle text-sm mb-4">
                  Captures what students say they learned and where they still
                  feel uncertain.
                </p>

                {reflectionLog.length === 0 ? (
                  <p className="text-edsync-subtle text-sm text-center py-8">
                    No reflections yet. Students will appear here after using
                    the reflection coach in lessons.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reflectionLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 bg-edsync-surface rounded-xl border border-edsync-border"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-edsync-text text-sm">
                              {entry.student_name}
                            </p>
                            {entry.lesson_title && (
                              <p className="text-xs text-edsync-subtle">
                                {entry.lesson_title}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span
                              className={`badge text-xs ${
                                entry.confidence <= 2
                                  ? "bg-edsync-red/10 text-edsync-red border-edsync-red/20"
                                  : entry.confidence === 3
                                    ? "bg-edsync-amber/10 text-edsync-amber border-edsync-amber/20"
                                    : "bg-edsync-emerald/10 text-edsync-emerald border-edsync-emerald/20"
                              }`}
                            >
                              Confidence {entry.confidence}/5
                            </span>
                            <p className="text-xs text-edsync-subtle mt-1">
                              {formatRelativeTime(entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-edsync-text mb-3">
                          {entry.notes_preview}
                        </p>
                        <div className="p-3 rounded-xl bg-edsync-purple/5 border border-edsync-purple/20">
                          <p className="text-xs text-edsync-purple font-medium mb-1">
                            AI Guiding Question
                          </p>
                          <p className="text-sm text-edsync-subtle italic">
                            {entry.guiding_question}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lowConfidenceReflections > 0 && (
                <div className="edsync-card border-edsync-amber/30 bg-edsync-amber/5">
                  <h3 className="font-display font-semibold text-lg text-edsync-text mb-2">
                    Confidence Alert
                  </h3>
                  <p className="text-sm text-edsync-subtle">
                    {lowConfidenceReflections} reflection
                    {lowConfidenceReflections > 1
                      ? "s indicate"
                      : " indicates"}{" "}
                    low confidence (1-2/5). Consider small-group reteaching or
                    one-to-one check-ins for these students.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── INTERVENTIONS ── */}
          {tab === "interventions" && (
            <div className="animate-fade-in space-y-6">
              <div className="edsync-card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-edsync-text">
                      AI Intervention Suggestions
                    </h3>
                    <p className="text-edsync-subtle text-sm mt-1">
                      Personalized action recommendations based on your class
                      data
                    </p>
                  </div>
                  <button
                    onClick={getInterventions}
                    disabled={gettingSuggestions}
                    className="btn-primary text-sm py-2 flex-shrink-0"
                  >
                    {gettingSuggestions ? " Analyzing..." : " Get Suggestions"}
                  </button>
                </div>
                {aiSuggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-edsync-subtle text-sm">
                      Click "Get Suggestions" to have EdSync AI analyze your
                      class data and recommend specific actions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiSuggestions.map((s, i) => (
                      <div
                        key={i}
                        className="flex gap-3 p-4 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl"
                      >
                        <span className="text-edsync-blue font-bold text-sm flex-shrink-0 mt-0.5">
                          {i + 1}.
                        </span>
                        <p className="text-edsync-text text-sm">{s}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* At-risk students quick view */}
              {atRisk.length > 0 && (
                <div className="edsync-card">
                  <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
                    Students Needing Support
                  </h3>
                  <div className="space-y-3">
                    {atRisk.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-4 p-3 bg-edsync-red/5 border border-edsync-red/20 rounded-xl"
                      >
                        <div className="w-9 h-9 rounded-full bg-edsync-red/20 text-edsync-red flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-edsync-text text-sm">
                            {s.name}
                          </p>
                          <p className="text-xs text-edsync-subtle">{s.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-edsync-red">
                            {s.avgScore}%
                          </p>
                          <p className="text-xs text-edsync-subtle">
                            {s.aiInteractions} AI chats
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced students */}
              {advanced.length > 0 && (
                <div className="edsync-card">
                  <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
                    Advanced Students
                  </h3>
                  <p className="text-edsync-subtle text-sm mb-3">
                    Consider enrichment activities or peer tutoring assignments
                    for these students.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {advanced.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-edsync-emerald/5 border border-edsync-emerald/20 rounded-xl text-center"
                      >
                        <p className="font-medium text-edsync-text text-sm">
                          {s.name}
                        </p>
                        <p className="font-bold text-edsync-emerald">
                          {s.avgScore}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SOCRATIC LOG ── */}
          {tab === "socratic" && (
            <div className="animate-fade-in edsync-card">
              <h3 className="font-display font-semibold text-lg text-edsync-text mb-4">
                Student–AI Interactions
              </h3>
              {socraticLog.length === 0 ? (
                <p className="text-edsync-subtle text-sm text-center py-8">
                  No AI interactions yet. Students can use "Ask Socratic" while
                  working through lessons.
                </p>
              ) : (
                <div className="space-y-3">
                  {socraticLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 bg-edsync-surface rounded-xl border border-edsync-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-edsync-text">
                          {entry.student_name}
                        </span>
                        <div className="flex gap-2 items-center">
                          {entry.lesson_title && (
                            <span className="badge bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20 text-xs">
                              {entry.lesson_title.slice(0, 20)}
                              {entry.lesson_title.length > 20 ? "…" : ""}
                            </span>
                          )}
                          <span className="text-xs text-edsync-subtle">
                            {formatRelativeTime(entry.created_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-edsync-subtle italic">
                        "{entry.student_question}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
