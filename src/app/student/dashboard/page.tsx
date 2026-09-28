"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Flame, GraduationCap, Plus, Target } from "lucide-react";
import { Button, EmptyState, LinkButton, Menu, Sheet, Skeleton, StatTile, usePersistentState } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import { listPracticeReviews, type PracticeReviewCardRow } from "@/lib/practice/reviews";
import { summarizePracticeReviewCards } from "@/lib/practice/review-recommendations";
import { STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY, defaultStudentDashboardVisibility, mergeStudentDashboardVisibility, type StudentDashboardVisibility } from "@/lib/student/dashboard-preferences";
import type { Announcement, LearningGoal, LearningReflection, Profile, ScheduleEvent } from "@/types";
import CourseCard from "@/components/student-home/CourseCard";
import { courseProgress, loadStudentCourses, type StudentCourse } from "@/components/student-home/data";

type Planner = { announcements: Announcement[]; events: ScheduleEvent[] };
type DashboardData = { profile: Profile | null; courses: StudentCourse[]; personal: { id: string; title: string; courseId: string | null }[]; planner: Planner; goals: LearningGoal[]; reflections: LearningReflection[]; reviews: PracticeReviewCardRow[]; overall: number | null };
type DetailSheet = "study" | "goals" | "reflections" | "announcements" | null;

function displayDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function greeting(now: number) {
  if (!now) return "Welcome";
  const hour = new Date(now).getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function StudentDashboard() {
  const client = useMemo(() => createClient(), []);
  const [data, setData] = useState<DashboardData>({ profile: null, courses: [], personal: [], planner: { announcements: [], events: [] }, goals: [], reflections: [], reviews: [], overall: null });
  const [visibility] = usePersistentState<StudentDashboardVisibility>(STUDENT_DASHBOARD_VISIBILITY_STORAGE_KEY, defaultStudentDashboardVisibility);
  const preferences = mergeStudentDashboardVisibility(visibility);
  const [detail, setDetail] = useState<DetailSheet>(null);
  const [studyTitle, setStudyTitle] = useState("Focused study block");
  const [studyAt, setStudyAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in to view your dashboard.");
      const [profile, courses, goals, reflections, plannerResponse, gradeResponse, reviews] = await Promise.all([
        client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        loadStudentCourses(client, user.id),
        client.from("learning_goals").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(4),
        client.from("learning_reflections").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(4),
        fetch("/api/planner", { credentials: "include", cache: "no-store" }),
        fetch("/api/grades", { credentials: "include", cache: "no-store" }),
        listPracticeReviews().then((items) => items ?? []).catch(() => []),
      ]);
      const failure = profile.error || goals.error || reflections.error;
      if (failure) throw new Error(failure.message);
      const plannerPayload = await plannerResponse.json().catch(() => null) as { data?: Planner; error?: string | { message?: string } } | null;
      if (!plannerResponse.ok || !plannerPayload?.data) throw new Error(typeof plannerPayload?.error === "string" ? plannerPayload.error : plannerPayload?.error?.message ?? "Planner unavailable.");
      const gradePayload = await gradeResponse.json().catch(() => null) as { data?: { overall: number | null }; error?: string | { message?: string } } | null;
      if (!gradeResponse.ok || !gradePayload?.data) throw new Error(typeof gradePayload?.error === "string" ? gradePayload.error : gradePayload?.error?.message ?? "Grades unavailable.");
      setData({ profile: profile.data, courses: courses.lessons, personal: courses.personalCourses, planner: plannerPayload.data, goals: (goals.data ?? []) as LearningGoal[], reflections: (reflections.data ?? []) as LearningReflection[], reviews, overall: gradePayload.data.overall });
      setNow(Date.now());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dashboard could not load."); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const active = data.courses.filter((course) => course.progress?.status === "in_progress");
  const next = data.courses.filter((course) => course.progress?.status !== "completed" && course.progress?.status !== "in_progress");
  const continueCourse = [...active].sort((a, b) => (b.progress?.last_active ?? "").localeCompare(a.progress?.last_active ?? ""))[0] ?? next[0];
  const courseCount = data.courses.length + data.personal.filter((item) => !item.courseId).length;
  const dueEvents = data.planner.events.filter((event) => {
    const at = new Date(event.due_at ?? event.starts_at ?? 0).getTime();
    return Number.isFinite(at) && at >= now - 86400000;
  }).sort((a, b) => new Date(a.due_at ?? a.starts_at ?? 0).getTime() - new Date(b.due_at ?? b.starts_at ?? 0).getTime());
  const inWeek = dueEvents.filter((event) => { const at = new Date(event.due_at ?? event.starts_at ?? 0).getTime(); return at >= now && at <= now + 7 * 86400000; }).length;
  const review = summarizePracticeReviewCards(data.reviews);
  const firstName = data.profile?.full_name?.trim().split(/\s+/)[0] || "Learner";
  const visibleCourses = [...active, ...next, ...data.courses.filter((course) => course.progress?.status === "completed")].slice(0, 4);

  const createGoal = async () => {
    if (saving) return;
    setSaving(true);
    setSheetError("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in to create a goal.");
      const result = await client.from("learning_goals").insert({ student_id: user.id, title: "Complete one focused lesson", target_type: "weekly_lessons", target_value: 1, current_value: data.courses.filter((course) => course.progress?.status === "completed").length, due_date: localDateAfter(7) }).select().single();
      if (result.error) throw new Error(result.error.message);
      setData((current) => ({ ...current, goals: [result.data as LearningGoal, ...current.goals].slice(0, 4) }));
    } catch (cause) { setSheetError(cause instanceof Error ? cause.message : "Goal could not be created."); }
    finally { setSaving(false); }
  };

  const createStudyBlock = async () => {
    if (saving || !studyTitle.trim() || !studyAt) return;
    setSaving(true);
    setSheetError("");
    try {
      const response = await fetch("/api/planner", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: studyTitle.trim(), description: "Personal study time", startsAt: new Date(studyAt).toISOString() }) });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? "Study block could not be saved.");
      setStudyTitle("Focused study block");
      setStudyAt("");
      setDetail(null);
      await load();
    } catch (cause) { setSheetError(cause instanceof Error ? cause.message : "Study block could not be saved."); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <header className="mb-6 flex items-start justify-between gap-3"><h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{greeting(now)}, <span className="font-serif italic font-normal">{firstName}</span></h1><Menu label="Dashboard actions" items={[{ label: "Study block", icon: CalendarDays, onSelect: () => setDetail("study") }, { label: "Learning goals", icon: Target, onSelect: () => setDetail("goals") }, { label: "Reflections", icon: BookOpen, onSelect: () => setDetail("reflections") }, { label: "Announcements", icon: GraduationCap, onSelect: () => setDetail("announcements") }, { separator: true }, { label: "Join a class", href: "/student/classes" }, { label: "Notifications", href: "/student/notifications" }, review ? { label: "Practice review", href: review.href } : null]} /></header>
      {error && <div role="alert" className="mb-5 flex items-center justify-between gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"><span>{error}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>}
      {loading ? <div className="space-y-5"><Skeleton className="h-36 rounded-xl" /><div className="grid gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}</div><Skeleton className="h-48 rounded-xl" /></div> : (
        <>
          <section className="mb-5 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="mb-1 text-xs text-fg-muted">Continue</p><h2 className="truncate text-lg font-medium text-fg">{continueCourse?.title ?? "Choose your next course"}</h2><p className="mt-1 text-xs text-fg-muted">{continueCourse ? `${continueCourse.className ?? continueCourse.subject ?? "Personal course"} · ${courseProgress(continueCourse)}% complete` : "Your learning starts here."}</p></div><LinkButton href={continueCourse ? `/student/lessons/${continueCourse.id}` : "/catalog"} variant="primary" iconRight={ArrowRight}>{continueCourse ? "Resume" : "Explore"}</LinkButton></section>
          <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatTile icon={Flame} label="Streak" value={`${data.profile?.streak_days ?? 0} days`} /><StatTile icon={CalendarDays} label="Due this week" value={inWeek} href="/student/planner" /><StatTile icon={GraduationCap} label="Average" value={data.overall === null ? "—" : `${Math.round(data.overall)}%`} href="/student/grades" /><StatTile icon={BookOpen} label="Courses" value={courseCount} href="/student/lessons" /></div>
          <div className="grid gap-6 lg:grid-cols-2"><section><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-medium text-fg">Due soon</h2><Link href="/student/planner" className="text-xs text-accent">Planner</Link></div>{preferences.deadlines && dueEvents.length ? <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{dueEvents.slice(0, 5).map((event) => <Link key={event.id} href="/student/planner" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><CalendarDays className="size-4" /></span><span className="min-w-0 flex-1 truncate text-sm text-fg">{event.title}</span><span className="shrink-0 text-xs text-fg-muted">{displayDate(event.due_at ?? event.starts_at)}</span></Link>)}</div> : <EmptyState icon={CalendarDays} title={preferences.deadlines ? "Nothing due soon" : "Deadlines hidden"} compact />}</section><section><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-medium text-fg">Your courses</h2><Link href="/student/lessons" className="text-xs text-accent">View all</Link></div>{visibleCourses.length ? <div className="space-y-2">{visibleCourses.map((course) => <CourseCard key={course.id} course={course} compact />)}</div> : <EmptyState icon={BookOpen} title="No courses yet" action={<LinkButton href="/student/classes" variant="secondary" size="sm">Get access</LinkButton>} compact />}</section></div>
        </>
      )}
      <Sheet open={detail !== null} onClose={() => { setDetail(null); setSheetError(""); }} title={detail === "study" ? "Study block" : detail === "goals" ? "Learning goals" : detail === "reflections" ? "Reflections" : "Announcements"} footer={detail === "study" ? <Button variant="primary" icon={Plus} loading={saving} disabled={!studyTitle.trim() || !studyAt} onClick={() => void createStudyBlock()}>Add to planner</Button> : detail === "goals" ? <Button variant="primary" icon={Plus} loading={saving} onClick={() => void createGoal()}>Add goal</Button> : undefined}>
        {detail === "study" && <div className="space-y-3"><label htmlFor="study-title" className="block text-sm font-medium text-fg">Title</label><input id="study-title" className="input w-full" value={studyTitle} onChange={(event) => setStudyTitle(event.target.value)} /><label htmlFor="study-at" className="block text-sm font-medium text-fg">When</label><input id="study-at" type="datetime-local" className="input w-full" value={studyAt} onChange={(event) => setStudyAt(event.target.value)} /></div>}
        {detail === "goals" && (data.goals.length ? <div className="space-y-2">{data.goals.map((goal) => <div key={goal.id} className="rounded-lg border border-line p-3"><p className="text-sm font-medium text-fg">{goal.title}</p><progress aria-label={goal.title} max={Math.max(1, goal.target_value)} value={goal.current_value} className="mt-2 h-2 w-full accent-accent" /><p className="text-xs text-fg-muted">{goal.current_value} / {goal.target_value}</p></div>)}</div> : <EmptyState icon={Target} title="No goals yet" compact />)}
        {detail === "reflections" && (data.reflections.length ? <div className="space-y-2">{data.reflections.map((item) => <div key={item.id} className="rounded-lg border border-line p-3"><p className="text-sm text-fg">{item.reflection}</p>{item.next_step && <p className="mt-1 text-xs text-fg-muted">Next: {item.next_step}</p>}</div>)}</div> : <EmptyState icon={BookOpen} title="No reflections yet" compact />)}
        {detail === "announcements" && (data.planner.announcements.length ? <div className="space-y-2">{data.planner.announcements.map((item) => <div key={item.id} className="rounded-lg border border-line p-3"><p className="text-sm font-medium text-fg">{item.title}</p><p className="mt-1 text-sm text-fg-muted">{item.body}</p></div>)}</div> : <EmptyState icon={GraduationCap} title="No announcements" compact />)}
        {sheetError && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{sheetError}</p>}
      </Sheet>
    </div>
  );
}
