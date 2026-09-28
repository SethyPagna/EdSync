"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, Plus, UsersRound } from "lucide-react";
import { Button, EmptyState, LinkButton, PageHeader, Sheet, Skeleton } from "@/components/ui";
import { chunks } from "@/components/student-home/data";
import { createClient } from "@/lib/edsync/client";
import type { Class, Profile } from "@/types";

type ClassCard = Class & { teacherName: string; lessonCount: number };

export default function StudentClassesPage() {
  const client = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in to view your access.");
      const enrollments = await client.from("class_enrollments").select("class_id").eq("student_id", user.id).eq("is_active", true);
      if (enrollments.error) throw new Error(enrollments.error.message);
      const ids = ((enrollments.data ?? []) as { class_id: string }[]).map((item) => item.class_id);
      if (!ids.length) { setClasses([]); return; }
      const classResults = await Promise.all(chunks(ids).map((group) => client.from("classes").select("*").in("id", group).eq("is_active", true)));
      const classFailure = classResults.find((result) => result.error);
      if (classFailure?.error) throw new Error(classFailure.error.message);
      const rows = classResults.flatMap((result) => (result.data ?? []) as Class[]).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const teacherIds = Array.from(new Set(rows.map((row) => row.teacher_id)));
      const [teachers, assignments] = await Promise.all([
        Promise.all(chunks(teacherIds).map((group) => client.from("profiles").select("id, full_name, email").in("id", group))),
        Promise.all(chunks(ids).map((group) => client.from("lesson_assignments").select("class_id, lesson_id").in("class_id", group).eq("is_active", true))),
      ]);
      const detailFailure = [...teachers, ...assignments].find((result) => result.error);
      if (detailFailure?.error) throw new Error(detailFailure.error.message);
      const teacherNames = new Map(teachers.flatMap((result) => (result.data ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map((item) => [item.id, item.full_name || item.email]));
      const lessonIds = new Map<string, Set<string>>();
      assignments.flatMap((result) => (result.data ?? []) as { class_id: string; lesson_id: string }[]).forEach((item) => {
        const current = lessonIds.get(item.class_id) ?? new Set<string>();
        current.add(item.lesson_id);
        lessonIds.set(item.class_id, current);
      });
      setClasses(rows.map((row) => ({ ...row, teacherName: teacherNames.get(row.teacher_id) ?? "Teacher", lessonCount: lessonIds.get(row.id)?.size ?? 0 })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not load."); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const join = async () => {
    const joinCode = code.trim().toUpperCase();
    if (!joinCode || joining) return;
    setJoining(true);
    setJoinError("");
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sign in to join a class.");
      const lookup = await client.from("classes").select("id, name").eq("join_code", joinCode).maybeSingle();
      if (lookup.error) throw new Error(lookup.error.message);
      if (!lookup.data) throw new Error("Code not found. Check with your teacher.");
      const result = await client.from("class_enrollments").upsert({ class_id: lookup.data.id, student_id: user.id, join_code: joinCode, is_active: true }, { onConflict: "class_id,student_id" });
      if (result.error) throw new Error(result.error.message);
      setCode("");
      setOpen(false);
      await load();
    } catch (cause) { setJoinError(cause instanceof Error ? cause.message : "Could not join this class."); }
    finally { setJoining(false); }
  };

  return (
    <div className="page">
      <PageHeader title="Access" count={classes.length} actions={<Button icon={Plus} variant="primary" size="sm" onClick={() => setOpen(true)}>Join code</Button>} />
      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger"><span>{error}</span><Button size="sm" onClick={() => void load()}>Retry</Button></div>}
      {loading ? <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}</div> : classes.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{classes.map((item) => <article key={item.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3"><div aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><GraduationCap className="size-5" /></div><div className="min-w-0 flex-1"><h2 className="truncate text-base font-medium text-fg">{item.name}</h2><p className="mt-0.5 truncate text-xs text-fg-muted">{item.subject ?? "Course"}{item.grade_level ? ` · ${item.grade_level}` : ""}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-fg-muted"><span className="inline-flex items-center gap-1"><UsersRound className="size-3.5" />{item.teacherName}</span><span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" />{item.lessonCount} courses</span></div>
        </article>)}</div>
      ) : !error ? <EmptyState icon={UsersRound} title="No class access yet" action={<Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>Join with code</Button>} /> : null}
      {!loading && <div className="mt-6"><LinkButton href="/student/lessons" variant="secondary">View courses</LinkButton></div>}
      <Sheet open={open} onClose={() => { setOpen(false); setJoinError(""); }} title="Join a class" description="Enter the code from your teacher." footer={<Button variant="primary" loading={joining} disabled={!code.trim()} onClick={() => void join()}>Join class</Button>}>
        <label htmlFor="class-code" className="mb-2 block text-sm font-medium text-fg">Access code</label>
        <input id="class-code" className="input w-full font-mono uppercase" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void join(); } }} placeholder="e.g. BIOLOGY8" />
        {joinError && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{joinError}</p>}
      </Sheet>
    </div>
  );
}
