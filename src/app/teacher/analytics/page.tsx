"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/edsync/client";
import { fetchTeacherPracticeReviewSignal, summarizeTeacherPracticeReviews, type TeacherPracticeReviewSignal } from "@/lib/practice/teacher-review-signals";
import { buildInsights, type InsightInteraction, type InsightProfile, type InsightProgress } from "@/components/teacher-home/insights";
import { Badge, Button, Card, EmptyState, InfoPopover, LinkButton, PageHeader, ProgressBar, Section, Skeleton, StatTile, Tabs, Toolbar } from "@/components/ui";
import type { Class, Lesson } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, ArrowRight, BookOpen, ChartNoAxesCombined, CircleHelp, Lightbulb, MessageCircle, ShieldAlert, Sparkles, UsersRound } from "lucide-react";

type AnalyticsData = {
  classes: Class[];
  lessons: Lesson[];
  progress: InsightProgress[];
  interactions: InsightInteraction[];
  profiles: InsightProfile[];
  reviewSignal: TeacherPracticeReviewSignal;
};

const EMPTY_DATA: AnalyticsData = {
  classes: [], lessons: [], progress: [], interactions: [], profiles: [],
  reviewSignal: summarizeTeacherPracticeReviews([]),
};

type View = "overview" | "learners" | "map" | "activity" | "ideas";
type ActivityView = "reflections" | "questions";

function scoreTone(score: number | null): "neutral" | "danger" | "success" | "warning" {
  return score === null ? "neutral" : score < 60 ? "danger" : score >= 80 ? "success" : "warning";
}

export default function TeacherAnalytics() {
  const edsync = useMemo(() => createClient(), []);
  const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classId, setClassId] = useState("all");
  const [view, setView] = useState<View>("overview");
  const [activityView, setActivityView] = useState<ActivityView>("reflections");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to view insights.");
      const [classesRes, lessonsRes, reviewSignal] = await Promise.all([
        edsync.from("classes").select("*").eq("teacher_id", user.id).eq("is_active", true).order("name", { ascending: true }),
        edsync.from("lessons").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
        fetchTeacherPracticeReviewSignal(),
      ]);
      if (classesRes.error || lessonsRes.error) throw new Error("Could not load your courses.");
      const classes = (classesRes.data || []) as Class[];
      const lessons = (lessonsRes.data || []) as Lesson[];
      if (lessons.length === 0) {
        setData({ classes, lessons, progress: [], interactions: [], profiles: [], reviewSignal });
        return;
      }
      const ids = lessons.map((lesson) => lesson.id);
      const [progressRes, interactionsRes] = await Promise.all([
        edsync.from("student_progress").select("*").in("lesson_id", ids),
        edsync.from("socratic_interactions").select("id, student_question, created_at, student_id, lesson_id").in("lesson_id", ids).order("created_at", { ascending: false }).limit(30),
      ]);
      if (progressRes.error || interactionsRes.error) throw new Error("Could not load learning activity.");
      const progress = (progressRes.data || []) as InsightProgress[];
      const interactions = (interactionsRes.data || []) as InsightInteraction[];
      const studentIds = [...new Set([...progress.map((row) => row.student_id), ...interactions.map((row) => row.student_id)])];
      let profiles: InsightProfile[] = [];
      if (studentIds.length) {
        const profilesRes = await edsync.from("profiles").select("id, full_name, email").in("id", studentIds);
        if (profilesRes.error) throw new Error("Could not load learner details.");
        profiles = (profilesRes.data || []) as InsightProfile[];
      }
      setData({ classes, lessons, progress, interactions, profiles, reviewSignal });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const courses = useMemo(
    () => classId === "all" ? data.lessons : data.lessons.filter((lesson) => lesson.class_id === classId),
    [classId, data.lessons],
  );
  const insights = useMemo(
    () => buildInsights(courses, data.progress, data.interactions, data.profiles),
    [courses, data.progress, data.interactions, data.profiles],
  );
  const atRisk = insights.students.filter((student) => student.status === "at_risk");
  const advanced = insights.students.filter((student) => student.status === "advanced");
  const lowConfidence = insights.students.reduce((total, student) => total + student.lowConfidence, 0);

  const getSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestionError("");
    try {
      const response = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentStats: insights.students.map((student, index) => ({
            name: `Learner ${index + 1}`,
            avgScore: student.average,
            reflectionCount: student.reflections,
            lowConfidenceReflections: student.lowConfidence,
          })),
          lessonStats: insights.lessons.map((lesson) => ({ knowledgeGaps: lesson.gaps })),
          reviewSignal: data.reviewSignal,
        }),
      });
      const payload = (await response.json()) as { suggestions?: unknown; error?: string };
      const list = Array.isArray(payload.suggestions)
        ? payload.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      if (!response.ok || payload.error || list.length === 0 || list.some((item) => /^(Could not generate|Unauthorized|Too many analytics requests)/i.test(item))) {
        throw new Error(payload.error || list[0] || "Could not generate insights.");
      }
      setSuggestions(list);
    } catch (reason) {
      setSuggestionError(reason instanceof Error ? reason.message : "Could not generate insights.");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  return (
    <div className="page space-y-6">
      <PageHeader title="Insights" actions={<LinkButton href="/teacher/reports" variant="secondary" size="sm" icon={ArrowRight}>Reports</LinkButton>} />
      <Toolbar>
        <label htmlFor="insights-class" className="sr-only">Class</label>
        <select id="insights-class" value={classId} onChange={(event) => setClassId(event.target.value)} className="select min-w-0 max-w-full sm:w-64">
          <option value="all">All classes</option>
          {data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <InfoPopover>Scores use graded results. A missing score is excluded from the average; 0% counts.</InfoPopover>
      </Toolbar>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
          <span>{error}</span><button type="button" onClick={() => void loadData()} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Learners" value={loading ? "…" : insights.students.length} icon={UsersRound} tone="accent" />
        <StatTile label="Average" value={loading ? "…" : insights.average === null ? "—" : `${insights.average}%`} icon={ChartNoAxesCombined} tone="success" />
        <StatTile label="At risk" value={loading ? "…" : atRisk.length} icon={ShieldAlert} tone="danger" />
        <StatTile label="Practice" value={loading ? "…" : data.reviewSignal.pendingCount} icon={Activity} tone="warning" />
      </div>

      <Tabs<View>
        value={view}
        onChange={setView}
        ariaLabel="Insight views"
        idPrefix="insights"
        items={[
          { value: "overview", label: "Overview" },
          { value: "learners", label: "Learners" },
          { value: "map", label: "Map" },
          { value: "activity", label: "Activity" },
          { value: "ideas", label: "Ideas" },
        ]}
      />

      {loading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        : courses.length === 0 ? <Card><EmptyState icon={BookOpen} title="No courses in this class" action={<LinkButton href="/teacher/lessons" size="sm">Courses</LinkButton>} /></Card>
        : (
          <div role="tabpanel" id={`insights-panel-${view}`} aria-labelledby={`insights-tab-${view}`} className="space-y-6">
            {view === "overview" ? (
              <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(270px,1fr)]">
                <Section title="Course progress" count={insights.lessons.length}>
                  <Card padding="none" className="overflow-hidden">
                    {insights.lessons.map((lesson) => (
                      <div key={lesson.id} className="border-b border-line p-4 last:border-0">
                        <div className="mb-2 flex min-w-0 items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{lesson.title}</span>
                          <Badge tone={scoreTone(lesson.average)}>{lesson.average === null ? "—" : `${lesson.average}%`}</Badge>
                        </div>
                        <ProgressBar value={lesson.completed} max={Math.max(lesson.started, 1)} label={`${lesson.title} completion`} />
                        <p className="mt-1.5 text-xs text-fg-faint">{lesson.completed} of {lesson.started} completed</p>
                        {lesson.gaps.length ? <div className="mt-2 flex flex-wrap gap-1">{lesson.gaps.map((gap) => <Badge key={gap} tone="warning">{gap}</Badge>)}</div> : null}
                      </div>
                    ))}
                  </Card>
                </Section>
                <div className="space-y-6">
                  <Section title="At risk" count={atRisk.length}>
                    <Card padding="none" className="overflow-hidden">
                      {atRisk.length ? atRisk.slice(0, 5).map((student) => (
                        <div key={student.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{student.name}</span>
                          <Badge tone="danger">{student.average}%</Badge>
                        </div>
                      )) : <EmptyState compact icon={ShieldAlert} title="No at-risk learners" />}
                    </Card>
                  </Section>
                  {insights.gaps.length ? (
                    <Section title="Common gaps">
                      <Card className="flex flex-wrap gap-1.5">{insights.gaps.slice(0, 6).map(([gap, count]) => <Badge key={gap} tone="warning">{gap} · {count}</Badge>)}</Card>
                    </Section>
                  ) : null}
                </div>
              </div>
            ) : null}

            {view === "learners" ? (
              <Section title="Learners" count={insights.students.length}>
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-fg-muted">
                  <Badge tone="success">{advanced.length} advanced</Badge>
                  <Badge tone="neutral">{insights.students.length - advanced.length - atRisk.length} on track</Badge>
                  <Badge tone="danger">{atRisk.length} at risk</Badge>
                </div>
                <Card padding="none" className="overflow-hidden">
                  {insights.students.length ? insights.students.map((student) => (
                    <div key={student.id} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-fg">{student.name}</span><span className="block truncate text-xs text-fg-faint">{student.completed} courses · {student.aiInteractions} AI chats · {student.reflections} reflections</span></span>
                      <Badge tone={scoreTone(student.average)}>{student.average === null ? "—" : `${student.average}%`}</Badge>
                    </div>
                  )) : <EmptyState compact icon={UsersRound} title="No learner activity yet" />}
                </Card>
              </Section>
            ) : null}

            {view === "map" ? (
              <Section title="Readiness map" count={insights.students.length}>
                <Card padding="none" className="overflow-x-auto">
                  {insights.students.length ? (
                    <table className="w-full min-w-[520px] text-left text-[13px]">
                      <thead><tr className="border-b border-line text-xs text-fg-muted"><th scope="col" className="px-4 py-3 font-medium">Learner</th>{insights.lessons.slice(0, 5).map((lesson) => <th key={lesson.id} scope="col" title={lesson.title} className="max-w-28 truncate px-2 py-3 text-center font-medium">{lesson.title}</th>)}<th scope="col" className="px-4 py-3 text-right font-medium">Overall</th></tr></thead>
                      <tbody>{insights.students.map((student) => (
                        <tr key={student.id} className="border-b border-line last:border-0">
                          <th scope="row" className="max-w-44 truncate px-4 py-3 font-medium text-fg">{student.name}</th>
                          {insights.lessons.slice(0, 5).map((lesson) => <td key={lesson.id} className="px-2 py-2 text-center"><Badge tone={scoreTone(student.scores[lesson.id] ?? null)}>{student.scores[lesson.id] === null || student.scores[lesson.id] === undefined ? "—" : `${student.scores[lesson.id]}%`}</Badge></td>)}
                          <td className="px-4 py-2 text-right"><Badge tone={scoreTone(student.average)}>{student.average === null ? "—" : `${student.average}%`}</Badge></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : <EmptyState compact icon={ChartNoAxesCombined} title="No scored activity yet" />}
                </Card>
              </Section>
            ) : null}

            {view === "activity" ? (
              <Section title="Learning activity">
                <div className="segmented self-start" role="radiogroup" aria-label="Activity type">
                  <button type="button" role="radio" aria-checked={activityView === "reflections"} data-active={activityView === "reflections"} onClick={() => setActivityView("reflections")} className="segmented-item">Reflections <span className="text-fg-faint">{insights.reflections.length}</span></button>
                  <button type="button" role="radio" aria-checked={activityView === "questions"} data-active={activityView === "questions"} onClick={() => setActivityView("questions")} className="segmented-item">AI questions <span className="text-fg-faint">{insights.socratic.length}</span></button>
                </div>
                <Card padding="none" className="overflow-hidden">
                  {activityView === "reflections"
                    ? insights.reflections.length ? insights.reflections.map((item) => (
                      <details key={item.id} className="border-b border-line px-4 py-3 last:border-0">
                        <summary className="flex cursor-pointer items-center gap-3 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium text-fg">{item.studentName} · {item.lessonTitle}</span><Badge tone={item.confidence <= 2 ? "warning" : "neutral"}>{item.confidence}/5</Badge><span className="text-xs text-fg-faint">{formatRelativeTime(item.createdAt)}</span></summary>
                        <p className="mt-3 text-[13px] text-fg-muted">{item.notes}</p>{item.guidingQuestion ? <p className="mt-2 text-xs text-fg-faint">{item.guidingQuestion}</p> : null}
                      </details>
                    )) : <EmptyState compact icon={MessageCircle} title="No reflections yet" />
                    : insights.socratic.length ? insights.socratic.map((item) => (
                      <details key={item.id} className="border-b border-line px-4 py-3 last:border-0">
                        <summary className="flex cursor-pointer items-center gap-3 text-[13px]"><span className="min-w-0 flex-1 truncate font-medium text-fg">{item.studentName} · {item.lessonTitle}</span><span className="text-xs text-fg-faint">{formatRelativeTime(item.createdAt)}</span></summary>
                        <p className="mt-3 text-[13px] text-fg-muted">{item.question}</p>
                      </details>
                    )) : <EmptyState compact icon={CircleHelp} title="No AI questions yet" />}
                </Card>
              </Section>
            ) : null}

            {view === "ideas" ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
                <Section title="Teaching ideas" action={<Button size="sm" variant="primary" icon={Sparkles} loading={suggestionsLoading} onClick={() => void getSuggestions()}>Generate</Button>}>
                  <Card>
                    {suggestionError ? <div role="alert" className="mb-3 text-[13px] text-danger">{suggestionError}</div> : null}
                    {suggestions.length ? <ol className="space-y-3">{suggestions.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 text-[13px] text-fg"><span className="font-mono text-fg-faint">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}</ol>
                      : <EmptyState compact icon={Lightbulb} title="Generate ideas from class signals" />}
                  </Card>
                </Section>
                <Section title="Signals">
                  <Card className="space-y-3 text-[13px]">
                    <div className="flex justify-between gap-3"><span className="text-fg-muted">At risk</span><strong className="font-medium text-fg">{atRisk.length}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-fg-muted">Advanced</span><strong className="font-medium text-fg">{advanced.length}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-fg-muted">Low confidence</span><strong className="font-medium text-fg">{lowConfidence}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-fg-muted">Practice reviews</span><strong className="font-medium text-fg">{data.reviewSignal.pendingCount}</strong></div>
                    {data.reviewSignal.pendingCount ? <p className="border-t border-line pt-3 text-xs text-fg-muted">{data.reviewSignal.copy}</p> : null}
                  </Card>
                </Section>
              </div>
            ) : null}
          </div>
        )}
    </div>
  );
}
