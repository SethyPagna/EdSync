"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, BookOpenCheck, GraduationCap, UserRound, UsersRound } from "lucide-react";
import { createClient } from "@/lib/edsync/client";
import type { Class, Profile } from "@/types";

type EnrollmentRow = {
  class_id: string;
};

type ClassCard = Class & {
  teacherName?: string;
  lessonCount?: number;
};

export default function StudentClassesPage() {
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) {
        setClasses([]);
        return;
      }

      const { data: enrollments } = await edsync
        .from("class_enrollments")
        .select("class_id")
        .eq("student_id", user.id)
        .eq("is_active", true);
      const classIds = ((enrollments || []) as EnrollmentRow[]).map((row) => row.class_id);
      if (classIds.length === 0) {
        setClasses([]);
        return;
      }

      const { data: classRows } = await edsync
        .from("classes")
        .select("*")
        .in("id", classIds)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });
      const activeClasses = (classRows || []) as Class[];
      const teacherIds = Array.from(new Set(activeClasses.map((row) => row.teacher_id).filter(Boolean)));
      const [teacherRes, assignmentRes] = await Promise.all([
        teacherIds.length
          ? edsync.from("profiles").select("id, full_name, email").in("id", teacherIds)
          : Promise.resolve({ data: [] }),
        edsync.from("lesson_assignments").select("class_id").in("class_id", classIds).eq("is_active", true),
      ]);

      const teacherById = new Map(
        ((teacherRes.data || []) as Pick<Profile, "id" | "full_name" | "email">[]).map((profile) => [
          profile.id,
          profile.full_name || profile.email,
        ]),
      );
      const lessonCounts = new Map<string, number>();
      ((assignmentRes.data || []) as { class_id: string }[]).forEach((assignment) => {
        lessonCounts.set(assignment.class_id, (lessonCounts.get(assignment.class_id) || 0) + 1);
      });

      setClasses(
        activeClasses.map((classItem) => ({
          ...classItem,
          teacherName: teacherById.get(classItem.teacher_id) || "Creator",
          lessonCount: lessonCounts.get(classItem.id) || 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadClasses();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadClasses]);

  const joinClass = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setJoining(false);
      return;
    }

    const { data: classItem, error: classError } = await edsync
      .from("classes")
      .select("id, name")
      .eq("join_code", joinCode.trim().toUpperCase())
      .maybeSingle();

    if (classError) {
      toast.error(`Could not look up class: ${classError.message}`);
      setJoining(false);
      return;
    }

    if (!classItem) {
      toast.error("Invalid join code. Ask for the current access code.");
      setJoining(false);
      return;
    }

    const { error } = await edsync.from("class_enrollments").upsert(
      { class_id: classItem.id, student_id: user.id, is_active: true },
      { onConflict: "class_id,student_id" },
    );

    if (error) {
      toast.error(`Could not join class: ${error.message}`);
    } else {
      toast.success(`Joined ${classItem.name}.`);
      setJoinCode("");
      await loadClasses();
    }
    setJoining(false);
  };

  return (
    <div className="page-shell space-y-5">
      <header className="premium-panel group rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-edsync-emerald">Course access</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Course Access</h1>
            <p className="edsync-hover-detail max-w-2xl">
              Join an organization space, see who manages it, and jump into linked courses without returning to the dashboard.
            </p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && joinClass()}
              placeholder="Access code"
              className="edsync-input min-w-0 flex-1 py-2 font-mono uppercase"
            />
            <button
              type="button"
              onClick={joinClass}
              disabled={joining || !joinCode.trim()}
              className="btn-primary flex-none justify-center px-4 py-2"
            >
              Join
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="metric-card">
          <UsersRound className="h-5 w-5 text-edsync-blue" />
          <span>{classes.length}</span>
          <p>Active spaces</p>
        </div>
        <div className="metric-card">
          <BookOpenCheck className="h-5 w-5 text-edsync-emerald" />
          <span>{classes.reduce((total, classItem) => total + (classItem.lessonCount || 0), 0)}</span>
          <p>Linked courses</p>
        </div>
        <div className="metric-card">
          <GraduationCap className="h-5 w-5 text-edsync-amber" />
          <span>{new Set(classes.map((classItem) => classItem.teacher_id)).size}</span>
          <p>Creators</p>
        </div>
      </section>

      <section className="premium-surface group rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Your access</h2>
            <p className="edsync-hover-detail">Organization spaces, creator context, and linked work.</p>
          </div>
          <Link href="/student/lessons" className="btn-secondary px-3 py-2 text-sm">
            Courses <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-edsync-surface" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-surface p-8 text-center">
            <UsersRound className="mx-auto mb-3 h-8 w-8 text-edsync-subtle" />
            <p className="font-semibold text-edsync-text">No access yet</p>
            <p className="mt-1 text-sm text-edsync-subtle">Use an access code.</p>
            <Link href="/catalog" className="btn-secondary mx-auto mt-4 w-fit px-4 py-2 text-sm">
              Browse catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {classes.map((classItem) => (
              <article key={classItem.id} className="premium-card group rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-xl font-bold text-edsync-text">{classItem.name}</h3>
                    <p className="edsync-hover-detail">
                      {classItem.description || `${classItem.subject || "Course"} learning space`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-edsync-subtle sm:grid-cols-2">
                  <span className="inline-flex items-center gap-2 rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2">
                    <UserRound className="h-4 w-4" />
                    {classItem.teacherName}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2">
                    <BookOpenCheck className="h-4 w-4" />
                    {classItem.lessonCount} courses
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge bg-edsync-emerald/10 text-edsync-emerald">
                    {classItem.subject || "General"}
                  </span>
                  {classItem.grade_level && (
                    <span className="badge bg-edsync-blue/10 text-edsync-blue">{classItem.grade_level}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
