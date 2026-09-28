"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/edsync/client";
import { fetchTeacherPracticeReviewSignal, summarizeTeacherPracticeReviews, type TeacherPracticeReviewSignal } from "@/lib/practice/teacher-review-signals";
import { averageScore } from "@/components/teacher-home/metrics";
import { Badge, Card, EmptyState, IconButton, PageHeader, Section, Skeleton, StatTile } from "@/components/ui";
import type { Class, Lesson, Profile, TeacherAlert } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { ArrowRight, BookOpen, ChartNoAxesCombined, ClipboardCheck, Inbox, UsersRound, X } from "lucide-react";

type Submission = {
  id: string;
  status: string;
  title: string;
  full_name: string | null;
  submitted_at: string | null;
  updated_at: string;
};

type DashboardData = {
  profile: Profile | null;
  classes: Class[];
  lessons: Lesson[];
  alerts: TeacherAlert[];
  submissions: Submission[];
  reviewSignal: TeacherPracticeReviewSignal;
  activeStudents: number;
  average: number | null;
  interactions: number;
  lowConfidence: number;
};

const EMPTY_DATA: DashboardData = {
  profile: null, classes: [], lessons: [], alerts: [], submissions: [],
  reviewSignal: summarizeTeacherPracticeReviews([]),
  activeStudents: 0, average: null, interactions: 0, lowConfidence: 0,
};

function timeGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TeacherDashboard() {
  const edsync = useMemo(() => createClient(), []);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [greeting, setGreeting] = useState("Hello");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to view your teaching space.");
      const [profileRes, classesRes, lessonsRes, alertsRes, submissionResponse] = await Promise.all([
        edsync.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        edsync.from("classes").select("*").eq("teacher_id", user.id).eq("is_active", true).order("created_at", { ascending: false }),
        edsync.from("lessons").select("*").eq("teacher_id", user.id).order("updated_at", { ascending: false }),
        edsync.from("teacher_alerts").select("*").eq("teacher_id", user.id).eq("is_dismissed", false).order("created_at", { ascending: false }).limit(6),
        fetch("/api/work/submissions", { cache: "no-store" }),
      ]);
      if (profileRes.error || classesRes.error || lessonsRes.error || alertsRes.error) throw new Error("Could not load your teaching space.");
      if (!submissionResponse.ok) throw new Error("Could not load the review queue.");
      const submissionPayload = (await submissionResponse.json()) as { data?: Submission[]; error?: string | null };
      if (submissionPayload.error) throw new Error(submissionPayload.error);

      const classes = (classesRes.data || []) as Class[];
      const lessons = (lessonsRes.data || []) as Lesson[];
      const classIds = classes.map((row) => row.id);
      const lessonIds = lessons.map((row) => row.id);
      const [enrollmentRes, progressRes, interactionRes, reflectionRes, reviewSignal] = await Promise.all([
        classIds.length
          ? edsync.from("class_enrollments").select("student_id").in("class_id", classIds).eq("is_active", true)
          : Promise.resolve({ data: [], error: null }),
        lessonIds.length
          ? edsync.from("student_progress").select("score").in("lesson_id", lessonIds).not("score", "is", null)
          : Promise.resolve({ data: [], error: null }),
        lessonIds.length
          ? edsync.from("socratic_interactions").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds)
          : Promise.resolve({ count: 0, error: null }),
        lessonIds.length
          ? edsync.from("learning_reflections").select("confidence").in("lesson_id", lessonIds).lte("confidence", 2)
          : Promise.resolve({ data: [], error: null }),
        fetchTeacherPracticeReviewSignal(),
      ]);
      if (enrollmentRes.error || progressRes.error || interactionRes.error || reflectionRes.error) throw new Error("Could not load your teaching metrics.");
      setData({
        profile: profileRes.data as Profile | null,
        classes, lessons,
        alerts: (alertsRes.data || []) as TeacherAlert[],
        submissions: submissionPayload.data || [],
        reviewSignal,
        activeStudents: new Set((enrollmentRes.data || []).map((row: { student_id: string }) => row.student_id)).size,
        average: averageScore((progressRes.data || []).map((row: { score: number | string | null }) => row.score)),
        interactions: interactionRes.count || 0,
        lowConfidence: reflectionRes.data?.length || 0,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your teaching space.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGreeting(timeGreeting(new Date().getHours()));
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const dismissAlert = async (alertId: string) => {
    const { error: dismissError } = await edsync.from("teacher_alerts").update({ is_dismissed: true }).eq("id", alertId);
    if (dismissError) { setError("Could not dismiss the alert. Try again."); return; }
    setData((current) => ({ ...current, alerts: current.alerts.filter((alert) => alert.id !== alertId) }));
  };

  const firstName = data.profile?.full_name?.trim().split(/\s+/)[0] || "teacher";
  const pending = data.submissions.filter((submission) => submission.status === "submitted");
  const activity = [
    ...data.lessons.slice(0, 4).map((lesson) => ({
      id: `lesson-${lesson.id}`, label: lesson.title,
      detail: lesson.status === "published" ? "Course published" : "Course updated",
      time: lesson.updated_at, href: `/teacher/lessons/${lesson.id}`,
    })),
    ...data.submissions.slice(0, 4).map((submission) => ({
      id: `submission-${submission.id}`, label: submission.title,
      detail: submission.status === "graded" ? "Work graded" : "Work submitted",
      time: submission.submitted_at || submission.updated_at, href: "/teacher/work?section=feedback",
    })),
  ].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime()).slice(0, 5);

  return (
    <div className="page space-y-6">
      <PageHeader title={<>{greeting}, <span className="font-serif font-normal italic">{firstName}</span></>} />
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard()} className="font-medium underline underline-offset-2">Retry</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Students" value={loading ? "…" : data.activeStudents} icon={UsersRound} tone="accent" href="/teacher/students" />
        <StatTile label="To review" value={loading ? "…" : pending.length} icon={ClipboardCheck} tone="warning" href="/teacher/work?section=feedback" />
        <StatTile label="Average" value={loading ? "…" : data.average === null ? "—" : `${data.average}%`} icon={ChartNoAxesCombined} tone="success" href="/teacher/analytics" />
        <StatTile label="Courses" value={loading ? "…" : data.lessons.filter((lesson) => lesson.status === "published").length} icon={BookOpen} tone="neutral" href="/teacher/lessons" />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <Section title="Needs review" count={pending.length} action={<Link href="/teacher/work?section=feedback" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">Review <ArrowRight size={14} aria-hidden /></Link>}>
          <Card padding="none" className="overflow-hidden">
            {loading ? <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              : pending.length ? pending.slice(0, 5).map((submission) => (
                <Link key={submission.id} href="/teacher/work?section=feedback" className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning"><ClipboardCheck size={16} aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-fg">{submission.title}</span><span className="block truncate text-xs text-fg-muted">{submission.full_name || "Learner"}</span></span>
                  <span className="shrink-0 text-xs text-fg-faint">{formatRelativeTime(submission.submitted_at || submission.updated_at)}</span>
                </Link>
              )) : data.reviewSignal.pendingCount > 0 ? (
                <Link href="/teacher/analytics" className="flex items-center gap-3 p-4 text-[13px] text-fg hover:bg-surface-2">
                  <Badge tone="warning">{data.reviewSignal.pendingCount}</Badge><span className="min-w-0 flex-1 truncate">Practice items need attention</span><ArrowRight size={15} aria-hidden />
                </Link>
              ) : <EmptyState compact icon={Inbox} title="All caught up" />}
          </Card>
        </Section>

        <Section title="Recent activity" action={<Link href="/teacher/analytics" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">Insights <ArrowRight size={14} aria-hidden /></Link>}>
          <Card padding="none" className="overflow-hidden">
            {loading ? <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              : activity.length ? activity.map((item) => (
                <Link key={item.id} href={item.href} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-fg">{item.label}</span><span className="block truncate text-xs text-fg-muted">{item.detail}</span></span>
                  <span className="shrink-0 text-xs text-fg-faint">{formatRelativeTime(item.time)}</span>
                </Link>
              )) : <EmptyState compact icon={BookOpen} title="No activity yet" />}
          </Card>
        </Section>
      </div>

      {data.alerts.length > 0 ? (
        <Section title="Alerts" count={data.alerts.length}>
          <Card padding="none" className="overflow-hidden">
            {data.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex min-w-0 items-start gap-3 border-b border-line px-4 py-3 last:border-0">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-fg">{alert.title}</p><p className="mt-0.5 text-xs text-fg-muted">{alert.message}</p>{alert.action_suggestion ? <p className="mt-1 text-xs text-fg-faint">{alert.action_suggestion}</p> : null}</div>
                <IconButton icon={X} label="Dismiss alert" size="sm" onClick={() => void dismissAlert(alert.id)} />
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {data.classes.length > 0 || data.interactions > 0 || data.lowConfidence > 0 ? (
        <details className="rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-fg-muted">
          <summary className="cursor-pointer font-medium text-fg">Teaching pulse</summary>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <span>{data.interactions} AI conversations</span><span>{data.lowConfidence} low-confidence reflections</span>
            {data.classes.slice(0, 4).map((cls) => <span key={cls.id} className="min-w-0 truncate">{cls.name} <span className="font-mono text-fg-faint">{cls.join_code}</span></span>)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
