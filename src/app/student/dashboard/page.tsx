"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { listPracticeReviews, type PracticeReviewCardRow } from "@/lib/practice/reviews";
import { summarizePracticeReviewCards } from "@/lib/practice/review-recommendations";
import { MetricTile } from "@/components/WorkspacePrimitives";
import type {
  LearningGoal,
  LearningReflection,
  Lesson,
  Announcement,
  Profile,
  ScheduleEvent,
  StudentProgress,
} from "@/types";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Compass,
  GraduationCap,
  Megaphone,
  Plus,
  ShoppingBag,
  Timer,
  Target,
} from "lucide-react";

type AssignedLesson = Lesson & {
  progress?: StudentProgress;
  sectionCount?: number;
};

type StudentPlannerData = {
  announcements: (Announcement & { class_name?: string | null })[];
  events: (ScheduleEvent & { class_name?: string | null; lesson_title?: string | null })[];
};

type EnrollmentRow = { class_id: string };
type AssignmentRow = { lesson_id: string };
type SectionLessonRow = { lesson_id: string };
type EntitlementRow = {
  id: string;
  product_id: string | null;
  source_type: string;
  status: "active" | "expired" | "revoked";
};
type BillingProductRow = {
  id: string;
  title: string;
  description: string | null;
  product_type: string;
  course_id: string | null;
  metadata: Record<string, unknown> | string | null;
};
type IndividualCourse = {
  id: string;
  title: string;
  description: string;
  courseId: string | null;
  sourceType: string;
};
type CatalogSuggestion = {
  id: string;
  title: string;
  description: string | null;
  price?: { label?: string; isFree?: boolean };
  metadata?: { category?: string | null; difficulty?: string | null };
};
type DashboardVisibility = {
  assignments: boolean;
  deadlines: boolean;
  feedback: boolean;
  grades: boolean;
  newContent: boolean;
  notifications: boolean;
  practice: boolean;
};

const defaultVisibility: DashboardVisibility = {
  assignments: true,
  deadlines: true,
  feedback: true,
  grades: true,
  newContent: true,
  notifications: true,
  practice: true,
};

const ACTIVE_TIME_WEEKLY_TARGET_MINUTES = 240;

const notificationToggleOptions: Array<{ key: keyof DashboardVisibility; label: string }> = [
  { key: "notifications", label: "Master" },
  { key: "assignments", label: "Assignments" },
  { key: "deadlines", label: "Deadlines" },
  { key: "newContent", label: "New content" },
  { key: "practice", label: "Practice + AI" },
  { key: "grades", label: "Grades" },
  { key: "feedback", label: "Feedback" },
];

const notificationTypeKeys: Array<keyof DashboardVisibility> = [
  "assignments",
  "deadlines",
  "newContent",
  "practice",
  "grades",
  "feedback",
];

function formatPlannerDate(value: string | null) {
  if (!value) return "No time set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${Math.max(0, Math.round(totalMinutes))}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function parseProductMetadata(value: BillingProductRow["metadata"]) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function productDescription(product: BillingProductRow) {
  const metadata = parseProductMetadata(product.metadata);
  return (
    product.description ||
    String(metadata.previewSummary ?? "") ||
    String(metadata.category ?? "") ||
    "Personal catalog course"
  );
}

export default function StudentDashboard() {
  const edsync = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<AssignedLesson[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [reflections, setReflections] = useState<LearningReflection[]>([]);
  const [reviewCards, setReviewCards] = useState<PracticeReviewCardRow[]>([]);
  const [individualCourses, setIndividualCourses] = useState<IndividualCourse[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [planner, setPlanner] = useState<StudentPlannerData>({
    announcements: [],
    events: [],
  });
  const [studyTitle, setStudyTitle] = useState("Focused study block");
  const [studyAt, setStudyAt] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);
  const [savingStudy, setSavingStudy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<DashboardVisibility>(defaultVisibility);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) {
        setLessons([]);
        return;
      }

      const [profileRes, enrollmentsRes, goalsRes, reflectionsRes, plannerRes, reviewsRes, entitlementsRes, catalogRes] =
        await Promise.all([
          edsync.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          edsync
            .from("class_enrollments")
            .select("class_id")
            .eq("student_id", user.id)
            .eq("is_active", true),
          edsync
            .from("learning_goals")
            .select("*")
            .eq("student_id", user.id)
            .order("created_at", { ascending: false })
            .limit(4),
          edsync
            .from("learning_reflections")
            .select("*")
            .eq("student_id", user.id)
            .order("created_at", { ascending: false })
            .limit(4),
          fetch("/api/planner", { credentials: "include", cache: "no-store" }).then((res) =>
            res.json(),
          ),
          listPracticeReviews().catch(() => []),
          edsync
            .from("entitlements")
            .select("id, product_id, source_type, status")
            .eq("user_id", user.id)
            .eq("status", "active"),
          fetch("/api/catalog", { cache: "no-store" })
            .then((res) => res.json())
            .catch(() => ({ data: { items: [] } })),
        ]);

      setProfile(profileRes.data);
      setGoals(goalsRes.data || []);
      setReflections(reflectionsRes.data || []);
      setPlanner(plannerRes.data || { announcements: [], events: [] });
      setReviewCards(reviewsRes ?? []);
      setCatalogSuggestions((catalogRes.data?.items ?? []).slice(0, 3));

      const entitlements = (entitlementsRes.data || []) as EntitlementRow[];
      const productIds = Array.from(
        new Set(entitlements.map((entitlement) => entitlement.product_id).filter(Boolean) as string[]),
      );
      if (productIds.length > 0) {
        const { data: products } = await edsync
          .from("billing_products")
          .select("id, title, description, product_type, course_id, metadata")
          .in("id", productIds)
          .eq("status", "active");
        const productById = new Map(((products || []) as BillingProductRow[]).map((product) => [product.id, product]));
        setIndividualCourses(
          entitlements.flatMap((entitlement) => {
            if (!entitlement.product_id) return [];
            const product = productById.get(entitlement.product_id);
            if (!product) return [];
            return [
              {
                id: entitlement.id,
                title: product.title,
                description: productDescription(product),
                courseId: product.course_id,
                sourceType: entitlement.source_type,
              },
            ];
          }),
        );
      } else {
        setIndividualCourses([]);
      }

      const classIds = ((enrollmentsRes.data || []) as EnrollmentRow[]).map(
        (row) => row.class_id,
      );
      if (classIds.length === 0) {
        setLessons([]);
        return;
      }

      const { data: assignments } = await edsync
        .from("lesson_assignments")
        .select("lesson_id")
        .in("class_id", classIds)
        .eq("is_active", true);

      const lessonIds = Array.from(
        new Set(((assignments || []) as AssignmentRow[]).map((assignment) => assignment.lesson_id)),
      );

      if (lessonIds.length === 0) {
        setLessons([]);
        return;
      }

      const [lessonRes, sectionRes, progressRes] = await Promise.all([
        edsync
          .from("lessons")
          .select("*")
          .in("id", lessonIds)
          .eq("status", "published")
          .order("updated_at", { ascending: false }),
        edsync.from("lesson_sections").select("lesson_id").in("lesson_id", lessonIds),
        edsync
          .from("student_progress")
          .select("*")
          .eq("student_id", user.id)
          .in("lesson_id", lessonIds),
      ]);

      const sectionCounts = new Map<string, number>();
      ((sectionRes.data || []) as SectionLessonRow[]).forEach((section) => {
        sectionCounts.set(section.lesson_id, (sectionCounts.get(section.lesson_id) || 0) + 1);
      });
      const progressByLesson = new Map(
        ((progressRes.data || []) as StudentProgress[]).map((progress) => [
          progress.lesson_id,
          progress,
        ]),
      );

      setLessons(
        ((lessonRes.data || []) as Lesson[]).map((lesson) => ({
          ...lesson,
          progress: progressByLesson.get(lesson.id),
          sectionCount: sectionCounts.get(lesson.id) || 0,
        })),
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const raw = window.localStorage.getItem("edsync-student-dashboard-visibility");
    if (!raw) return;
    try {
      setVisibility({ ...defaultVisibility, ...(JSON.parse(raw) as Partial<DashboardVisibility>) });
    } catch {
      setVisibility(defaultVisibility);
    }
  }, []);

  const toggleVisibility = (key: keyof DashboardVisibility) => {
    setVisibility((current) => {
      const nextValue = { ...current, [key]: !current[key] };
      window.localStorage.setItem("edsync-student-dashboard-visibility", JSON.stringify(nextValue));
      return nextValue;
    });
  };

  const joinClass = async () => {
    if (!joinCode.trim()) return;
    setJoiningClass(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setJoiningClass(false);
      return;
    }

    const { data: cls, error: clsError } = await edsync
      .from("classes")
      .select("id, name")
      .eq("join_code", joinCode.trim().toUpperCase())
      .maybeSingle();

    if (clsError) {
      toast.error(`Could not look up class: ${clsError.message}`);
      setJoiningClass(false);
      return;
    }

    if (!cls) {
      toast.error("Invalid join code. Ask your teacher for the current code.");
      setJoiningClass(false);
      return;
    }

    const { error } = await edsync.from("class_enrollments").upsert(
      { class_id: cls.id, student_id: user.id, is_active: true },
      { onConflict: "class_id,student_id" },
    );

    if (error) {
      toast.error(`Could not join class: ${error.message}`);
    } else {
      toast.success(`Joined ${cls.name}.`);
      setJoinCode("");
      await loadDashboard();
    }
    setJoiningClass(false);
  };

  const createGoal = async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;
    const { data, error } = await edsync
      .from("learning_goals")
      .insert({
        student_id: user.id,
        title: "Complete one focused lesson",
        target_type: "weekly_lessons",
        target_value: 1,
        current_value: lessons.filter((lesson) => lesson.progress?.status === "completed")
          .length,
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) {
      toast.error(`Could not create goal: ${error.message}`);
      return;
    }
    setGoals((current) => [data, ...current]);
    toast.success("Learning goal created.");
  };

  const createStudyBlock = async () => {
    if (!studyTitle.trim()) {
      toast.error("Name the study block first.");
      return;
    }
    setSavingStudy(true);
    const response = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: studyTitle,
        description: "Personal study time",
        startsAt: studyAt || null,
      }),
    });
    const payload = await response.json();
    setSavingStudy(false);
    if (!response.ok) {
      toast.error(payload.error?.message || "Could not add study block.");
      return;
    }
    toast.success("Study block added.");
    setStudyTitle("Focused study block");
    setStudyAt("");
    await loadDashboard();
  };

  const { completed, active, next } = useMemo(() => {
    const completedLessons: AssignedLesson[] = [];
    const activeLessons: AssignedLesson[] = [];
    const nextLessons: AssignedLesson[] = [];

    for (const lesson of lessons) {
      const status = lesson.progress?.status;
      if (status === "completed") {
        completedLessons.push(lesson);
      } else if (status === "in_progress") {
        activeLessons.push(lesson);
      } else {
        nextLessons.push(lesson);
      }
    }

    return {
      completed: completedLessons,
      active: activeLessons,
      next: nextLessons,
    };
  }, [lessons]);

  const recommendation = active[0] || next[0] || completed[0];
  const totalTimeSpent = useMemo(
    () => lessons.reduce((sum, lesson) => sum + Number(lesson.progress?.time_spent ?? 0), 0),
    [lessons],
  );
  const activeTimePct = Math.min(100, Math.round((totalTimeSpent / ACTIVE_TIME_WEEKLY_TARGET_MINUTES) * 100));
  const reviewRecommendation = useMemo(
    () => summarizePracticeReviewCards(reviewCards),
    [reviewCards],
  );
  const visibleReviewRecommendation = visibility.practice ? reviewRecommendation : null;
  const assignmentEvents = useMemo(
    () => planner.events.filter((event) => event.event_type === "deadline"),
    [planner.events],
  );
  const otherEvents = useMemo(
    () => planner.events.filter((event) => event.event_type !== "deadline"),
    [planner.events],
  );
  const visibleEvents = [
    ...(visibility.deadlines ? assignmentEvents : []),
    ...(visibility.assignments ? otherEvents : []),
  ];
  const notificationTypesPaused = notificationTypeKeys.every((key) => !visibility[key]);
  const notificationsPaused = !visibility.notifications || notificationTypesPaused;

  return (
    <div className="page-shell space-y-5">
      <header className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">
              Student home
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Learner"}
            </h1>
          </div>
          <TimeSpentGauge minutes={totalTimeSpent} percent={activeTimePct} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Time spent",
              value: formatMinutes(totalTimeSpent),
              icon: Timer,
              tone: "text-edsync-cyan",
            },
            {
              label: "Active",
              value: active.length,
              icon: BookOpenCheck,
              tone: "text-edsync-blue",
            },
            {
              label: "Done",
              value: completed.length,
              icon: CheckCircle2,
              tone: "text-edsync-emerald",
            },
            {
              label: "Reviews",
              value: reviewRecommendation?.count ?? 0,
              icon: GraduationCap,
              tone: "text-edsync-amber",
            },
          ].map((item) => (
            <MetricTile
              key={item.label}
              label={item.label}
              value={loading ? "..." : item.value}
              icon={item.icon}
              tone={item.tone}
            />
          ))}
        </div>
      </header>

      <section className="premium-surface rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Individual learning</p>
            <h2 className="font-display text-xl font-bold">Your catalog courses</h2>
          </div>
          <Link href="/catalog" className="btn-secondary w-fit px-3 py-2 text-sm">
            <Compass className="h-4 w-4" />
            Browse catalog
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {individualCourses.length > 0
            ? individualCourses.slice(0, 3).map((course) => (
                <Link
                  key={course.id}
                  href={course.courseId ? `/student/lessons/${course.courseId}` : "/catalog"}
                  className="rounded-2xl border border-edsync-border bg-edsync-surface p-4 transition hover:-translate-y-0.5 hover:border-edsync-blue/40 hover:bg-edsync-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-edsync-text">{course.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-edsync-subtle">{course.description}</p>
                      <span className="mt-3 inline-flex text-xs font-bold uppercase tracking-wide text-edsync-blue">
                        {course.sourceType.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            : catalogSuggestions.map((item) => (
                <Link
                  key={item.id}
                  href={`/catalog/${item.id}`}
                  className="rounded-2xl border border-edsync-border bg-edsync-surface p-4 transition hover:-translate-y-0.5 hover:border-edsync-emerald/40 hover:bg-edsync-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-edsync-emerald/10 text-edsync-emerald">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-edsync-text">{item.title}</p>
                        <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                          {item.price?.label ?? "Catalog"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-edsync-subtle">
                        {item.description || "Start a public EdSync course."}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
          {individualCourses.length === 0 && catalogSuggestions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-5 md:col-span-3">
              <p className="font-semibold text-edsync-text">No personal courses yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">
                Browse the catalog to enroll in free courses or start checkout for paid courses.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Continue learning</h2>
              <p className="text-sm text-edsync-subtle">Your next recommended step.</p>
            </div>
            {visibility.practice && (
              <Link href="/practice" className="btn-secondary justify-center text-sm">
                Practice + AI
              </Link>
            )}
          </div>
          {recommendation ? (
            <div className="space-y-3">
              {visibleReviewRecommendation && (
                <Link
                  href={visibleReviewRecommendation.href}
                  className="group block rounded-2xl border border-edsync-amber/30 bg-edsync-amber/10 p-4 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-amber/15 text-edsync-amber">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge bg-edsync-amber/15 text-edsync-amber">
                          {visibleReviewRecommendation.label}
                        </span>
                        <p className="font-semibold text-edsync-text">{visibleReviewRecommendation.title}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-edsync-subtle">
                        {visibleReviewRecommendation.subtitle}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-edsync-amber">
                        Review now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              )}
              <Link
                href={`/student/lessons/${recommendation.id}`}
                className="premium-card group block rounded-2xl p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
                    <BookOpenCheck className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl font-bold text-edsync-text">
                      {recommendation.title}
                    </p>
                    <p className="mt-1 text-sm text-edsync-subtle">
                      {recommendation.subject || "General"} - {recommendation.estimated_duration} min
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {recommendation.progress?.status?.replace("_", " ") || "not started"}
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                        Open lesson <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
              <Target className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No lesson assigned yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">Join a class to get started.</p>
            </div>
          )}
        </section>

        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Join a class</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && joinClass()}
              placeholder="EDSYNC8"
              className="edsync-input min-w-0 flex-1 py-2 font-mono uppercase"
            />
            <button
              type="button"
              onClick={joinClass}
              disabled={joiningClass || !joinCode.trim()}
              className="btn-primary flex-none justify-center px-4 py-2"
            >
              Join
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="premium-surface rounded-2xl p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Learning path</h2>
              <p className="text-sm text-edsync-subtle">Grouped by what needs attention.</p>
            </div>
          </div>

          {!visibility.newContent ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
              <p className="font-semibold text-edsync-text">Learning path hidden</p>
              <p className="mt-1 text-sm text-edsync-subtle">Turn on New content in Notifications to show lessons here.</p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-edsync-surface" />
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-10 text-center">
              <Target className="mx-auto mb-4 h-9 w-9 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No lessons yet</p>
              <p className="mt-1 text-sm text-edsync-subtle">
                Join a class or ask your teacher to assign a lesson.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.length > 0 && (
                <LessonGroup title="Continue now" lessons={active} />
              )}
              {next.length > 0 && <LessonGroup title="Up next" lessons={next} />}
              {completed.length > 0 && (
                <LessonGroup title="Completed" lessons={completed} />
              )}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="premium-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">Notifications</h2>
                <p className="text-sm text-edsync-subtle">Choose what appears on your dashboard.</p>
              </div>
              <Megaphone className="h-5 w-5 text-edsync-amber" />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {notificationToggleOptions.map(({ key, label }) => {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleVisibility(key)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      visibility[key]
                        ? "border-edsync-blue/35 bg-edsync-blue/10 text-edsync-blue"
                        : "border-edsync-border bg-edsync-surface text-edsync-subtle"
                    }`}
                    aria-pressed={visibility[key]}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              {notificationsPaused ? (
                <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-surface p-3">
                  <p className="text-sm font-semibold text-edsync-text">Notifications are paused</p>
                  <p className="mt-1 text-xs text-edsync-subtle">
                    Turn on Master or any notification type to show updates here again.
                  </p>
                </div>
              ) : planner.announcements.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  New class notifications will appear here.
                </p>
              ) : (
                planner.announcements.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-edsync-text">{item.title}</p>
                      <span className="text-xs text-edsync-subtle">
                        {item.class_name || "Class"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-edsync-subtle">{item.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {(visibility.practice || visibility.grades || visibility.feedback) && (
            <section className="premium-surface rounded-2xl p-4 sm:p-5">
              <h2 className="font-display text-xl font-bold">Support shortcuts</h2>
              <div className="mt-4 grid gap-2">
                {visibility.practice && (
                  <Link href="/practice" className="btn-secondary justify-between px-3 py-2 text-sm">
                    Practice + AI <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {visibility.grades && (
                  <Link href="/student/grades" className="btn-secondary justify-between px-3 py-2 text-sm">
                    Grades <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {visibility.feedback && (
                  <Link href="/student/notes" className="btn-secondary justify-between px-3 py-2 text-sm">
                    Feedback notes <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </section>
          )}

          <section className="premium-surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Schedule</h2>
              </div>
              <CalendarClock className="h-5 w-5 text-edsync-blue" />
            </div>
            <div className="mb-4 grid gap-2">
              <input
                value={studyTitle}
                onChange={(event) => setStudyTitle(event.target.value)}
                className="edsync-input py-2"
                placeholder="Study block title"
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={studyAt}
                  onChange={(event) => setStudyAt(event.target.value)}
                  className="edsync-input py-2"
                />
                <button
                  type="button"
                  onClick={createStudyBlock}
                  disabled={savingStudy}
                  className="btn-secondary px-3"
                  aria-label="Add study block"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {visibleEvents.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Deadlines and personal study blocks will appear here.
                </p>
              ) : (
                visibleEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-edsync-text">{event.title}</p>
                        <p className="mt-1 text-xs text-edsync-subtle">
                          {event.class_name || "Personal"} -{" "}
                          {formatPlannerDate(event.due_at || event.starts_at)}
                        </p>
                      </div>
                      <span className="badge bg-edsync-blue/10 text-edsync-blue">
                        {event.event_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <details className="premium-surface rounded-2xl p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <div>
                <h2 className="font-display text-xl font-bold">Goals</h2>
                <p className="text-sm text-edsync-subtle">{goals.length} active</p>
              </div>
              <button
                type="button"
                onClick={createGoal}
                className="rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2 text-sm font-semibold text-edsync-text hover:border-edsync-blue/50"
              >
                New
              </button>
            </summary>
            <div className="mt-4 space-y-3">
              {goals.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Create a goal to make your next study session concrete.
                </p>
              ) : (
                goals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round((goal.current_value / Math.max(1, goal.target_value)) * 100),
                  );
                  return (
                    <div
                      key={goal.id}
                      className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-edsync-text">
                          {goal.title}
                        </p>
                        <span className="text-xs font-semibold text-edsync-emerald">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-3 progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      {goal.due_date && (
                        <p className="mt-2 text-xs text-edsync-subtle">
                          Due {new Date(goal.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </details>

          <details className="premium-surface rounded-2xl p-4 sm:p-5">
            <summary className="cursor-pointer list-none marker:hidden">
              <h2 className="font-display text-xl font-bold">Reflections</h2>
              <p className="mt-1 text-sm text-edsync-subtle">{reflections.length} recent notes</p>
            </summary>
            <div className="mt-4 space-y-3">
              {reflections.length === 0 ? (
                <p className="rounded-lg border border-edsync-border bg-edsync-surface p-4 text-sm text-edsync-subtle">
                  Reflection notes will appear after lessons.
                </p>
              ) : (
                reflections.map((reflection) => (
                  <div
                    key={reflection.id}
                    className="rounded-lg border border-edsync-border bg-edsync-surface p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-edsync-blue">
                        Confidence {reflection.confidence ?? "N/A"}/5
                      </span>
                      <span className="text-xs text-edsync-subtle">
                        {new Date(reflection.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-edsync-text">
                      {reflection.reflection}
                    </p>
                    {reflection.next_step && (
                      <p className="mt-3 text-xs leading-5 text-edsync-subtle">
                        Next: {reflection.next_step}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

function TimeSpentGauge({ minutes, percent }: { minutes: number; percent: number }) {
  return (
    <div className="rounded-2xl border border-edsync-border bg-edsync-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--blue) ${percent}%, color-mix(in srgb, var(--border) 72%, transparent) 0)`,
          }}
          aria-label={`${percent}% of weekly active learning target`}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-edsync-card">
            <Timer className="h-5 w-5 text-edsync-blue" />
          </div>
        </div>
        <div>
          <p className="font-display text-2xl font-bold">{formatMinutes(minutes)}</p>
          <p className="text-xs text-edsync-subtle">active learning time</p>
          <p className="mt-1 text-[11px] font-semibold text-edsync-blue">{percent}% weekly focus</p>
        </div>
      </div>
    </div>
  );
}

function LessonGroup({
  title,
  lessons,
}: {
  title: string;
  lessons: AssignedLesson[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-edsync-subtle">
        {title}
      </h3>
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: AssignedLesson }) {
  const progress = lesson.progress;
  const totalSections = Math.max(1, lesson.sectionCount || 1);
  const pct =
    progress?.status === "completed"
      ? 100
      : progress?.status === "in_progress"
        ? Math.min(
            100,
            Math.round(((progress.sections_completed?.length || 0) / totalSections) * 100),
          )
        : 0;

  return (
    <Link
      href={`/student/lessons/${lesson.id}`}
      className="flex items-center gap-4 rounded-2xl border border-edsync-border bg-edsync-surface p-4 transition hover:border-edsync-blue/50 hover:bg-edsync-card"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
        <BookOpenCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-edsync-text">{lesson.title}</p>
        <p className="mt-1 text-xs text-edsync-subtle">
          {lesson.subject || "General"} - {lesson.estimated_duration} min -
          {lesson.difficulty}
        </p>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-edsync-subtle">
            <span>{progress?.status?.replace("_", " ") || "not started"}</span>
            <span className="font-semibold text-edsync-blue">{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-edsync-subtle" />
    </Link>
  );
}
