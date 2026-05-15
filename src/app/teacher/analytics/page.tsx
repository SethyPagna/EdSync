"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/edsync/client";
import type { Lesson } from "@/types";
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

type ReflectionMetadataEntry = {
  id?: string;
  confidence?: unknown;
  notes?: unknown;
  advice?: { guidingQuestion?: unknown };
  created_at?: unknown;
};

type AnalyticsProgressRow = {
  id: string;
  student_id: string;
  lesson_id: string;
  status: string;
  score: number | null;
  knowledge_gaps?: string[] | null;
  metadata?: { reflections?: ReflectionMetadataEntry[] } | null;
  last_active: string;
};

type SocraticRow = {
  id: string;
  student_id: string;
  lesson_id: string;
  student_question: string;
  created_at: string;
};

type AnalyticsProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
};

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
  const edsync = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
        setLessonStats([]);
        setStudentStats([]);
        setSocraticLog([]);
        setReflectionLog([]);
        return;
      }

      const lessonIds = myLessons.map((lesson) => lesson.id);
      const titleMap = new Map(myLessons.map((lesson) => [lesson.id, lesson.title]));

      const [{ data: progressRows }, { data: socraticRows }] = await Promise.all([
        edsync.from("student_progress").select("*").in("lesson_id", lessonIds),
        edsync
          .from("socratic_interactions")
          .select("id, student_question, created_at, student_id, lesson_id")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const progressData = (progressRows || []) as AnalyticsProgressRow[];
      const socraticData = (socraticRows || []) as SocraticRow[];
      const allStudentIds = Array.from(
        new Set([
          ...progressData.map((progress) => progress.student_id),
          ...socraticData.map((entry) => entry.student_id),
        ]),
      );

      const profileMap = new Map<string, { full_name: string | null; email: string }>();
      if (allStudentIds.length > 0) {
        const { data: profileData } = await edsync
          .from("profiles")
          .select("id, full_name, email")
          .in("id", allStudentIds);
        ((profileData || []) as AnalyticsProfileRow[]).forEach((profile) =>
          profileMap.set(profile.id, { full_name: profile.full_name, email: profile.email }),
        );
      }

      const progressByLesson = new Map<string, AnalyticsProgressRow[]>();
      progressData.forEach((progress) => {
        const rows = progressByLesson.get(progress.lesson_id) || [];
        rows.push(progress);
        progressByLesson.set(progress.lesson_id, rows);
      });

      const lStats: LessonStat[] = myLessons.map((lesson) => {
        const lessonProgress = progressByLesson.get(lesson.id) || [];
        const scores = lessonProgress
          .map((progress) => progress.score)
          .filter((score): score is number => typeof score === "number");
        const gapCounts = new Map<string, number>();
        lessonProgress
          .flatMap((progress) => progress.knowledge_gaps || [])
          .forEach((gap) => {
            gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
          });
        const topGaps = Array.from(gapCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([gap]) => gap);
        return {
          id: lesson.id,
          title: lesson.title,
          studentsStarted: lessonProgress.filter((progress) => progress.status !== "not_started")
            .length,
          studentsCompleted: lessonProgress.filter((progress) => progress.status === "completed")
            .length,
          avgScore:
            scores.length > 0
              ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
              : null,
          knowledgeGaps: topGaps,
        };
      });
      setLessonStats(lStats);

      const studentMap = new Map<string, StudentStat>();
      const reflectionEntries: ReflectionEntry[] = [];

      for (const progress of progressData) {
        const profile = profileMap.get(progress.student_id);
        const existing = studentMap.get(progress.student_id) ?? {
          id: progress.student_id,
          name: profile?.full_name || "Unknown",
          email: profile?.email || "",
          lessonsCompleted: 0,
          avgScore: null,
          aiInteractions: 0,
          reflectionCount: 0,
          lowConfidenceReflections: 0,
          status: "on_track" as const,
        };
        if (progress.status === "completed") existing.lessonsCompleted++;
        if (progress.score !== null) {
          existing.avgScore =
            existing.avgScore === null
              ? progress.score
              : Math.round((existing.avgScore + progress.score) / 2);
        }

        const reflections = Array.isArray(progress.metadata?.reflections)
          ? progress.metadata.reflections
          : [];

        if (reflections.length > 0) {
          existing.reflectionCount += reflections.length;

          reflections.forEach((entry, index) => {
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
              id: typeof entry?.id === "string" ? entry.id : `${progress.id}-${index}`,
              student_name: profile?.full_name || "Unknown",
              lesson_title: titleMap.get(progress.lesson_id),
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
                  : progress.last_active,
            });
          });
        }

        studentMap.set(progress.student_id, existing);
      }
      for (const entry of socraticData) {
        const student = studentMap.get(entry.student_id);
        if (student) {
          student.aiInteractions++;
          studentMap.set(entry.student_id, student);
        }
      }
      const students = Array.from(studentMap.values()).map((student) => ({
        ...student,
        status: (student.avgScore === null
          ? "on_track"
          : student.avgScore >= 80
            ? "advanced"
            : student.avgScore < 60
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

      setSocraticLog(
        socraticData.map((entry) => ({
          id: entry.id,
          student_name: profileMap.get(entry.student_id)?.full_name || "Unknown",
          student_question: entry.student_question,
          created_at: entry.created_at,
          lesson_title: titleMap.get(entry.lesson_id),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        "Could not load AI suggestions. Check your AI provider configuration.",
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
                  <div className="space-y-4">
                    {chartData.map((row) => {
                      const max = Math.max(row.Started, row.Completed, 1);
                      return (
                        <div key={row.name} className="rounded-xl border border-edsync-border bg-edsync-surface p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-edsync-text">{row.name}</p>
                            <p className="text-xs text-edsync-subtle">
                              {row.Completed}/{row.Started} complete
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 rounded-full bg-edsync-muted/25">
                              <div
                                className="h-2 rounded-full bg-edsync-blue"
                                style={{ width: `${(row.Started / max) * 100}%` }}
                              />
                            </div>
                            <div className="h-2 rounded-full bg-edsync-muted/25">
                              <div
                                className="h-2 rounded-full bg-edsync-emerald"
                                style={{ width: `${(row.Completed / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
