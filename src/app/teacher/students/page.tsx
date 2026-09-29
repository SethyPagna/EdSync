"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowDownUp, BookOpen, ClipboardCopy, Plus, Trash2, UsersRound } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Menu, PageHeader, Sheet, Skeleton, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import type { Class, Lesson, StudentProgress } from "@/types";

type RosterRow = { id: string; full_name: string | null; email: string; grade_level: string | null; class_id: string; class_name: string };
type Assignment = { id: string; lesson_id: string; created_at: string; due_date: string | null; lessons?: { title?: string | null } | null };
type Grade = { id: string; student_id: string; title: string; percent: number | null; status: string; updated_at: string };
type SortKey = "name" | "class" | "grade";

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

function localNow() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function TeacherStudents() {
  const router = useRouter();
  const confirm = useConfirm();
  const edsync = useMemo(() => createClient(), []);
  const [classes, setClasses] = useState<Class[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [reverse, setReverse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [lessonId, setLessonId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [student, setStudent] = useState<RosterRow | null>(null);
  const [studentGrades, setStudentGrades] = useState<Grade[]>([]);
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to see classes.");
      const [classResult, lessonResult, rosterResponse] = await Promise.all([
        edsync.from("classes").select("*").eq("teacher_id", user.id).eq("is_active", true).order("name"),
        edsync.from("lessons").select("id, title, status, class_id").eq("teacher_id", user.id).order("title"),
        fetch("/api/teacher/roster", { cache: "no-store" }),
      ]);
      const payload = await rosterResponse.json();
      if (classResult.error || lessonResult.error || !rosterResponse.ok || payload.error) {
        throw classResult.error || lessonResult.error || new Error(payload.error || "Could not load roster.");
      }
      const ownClasses = (classResult.data || []) as Class[];
      setClasses(ownClasses);
      setLessons((lessonResult.data || []) as Lesson[]);
      setRoster((payload.data?.students || []) as RosterRow[]);
      const requested = new URLSearchParams(window.location.search).get("classId");
      if (requested && ownClasses.some((item) => item.id === requested)) setSelectedClassId(requested);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (selectedClassId === "all") {
      const timer = window.setTimeout(() => setAssignments([]), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    edsync.from("lesson_assignments").select("id, lesson_id, created_at, due_date, lessons(title)")
      .eq("class_id", selectedClassId).eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data, error: assignmentError }) => {
        if (!active) return;
        if (assignmentError) {
          toast.error(assignmentError.message);
          setAssignments([]);
        } else {
          setAssignments((data || []) as Assignment[]);
        }
      });
    return () => { active = false; };
  }, [edsync, selectedClassId]);

  const chosenClass = classes.find((item) => item.id === selectedClassId) || null;
  const visibleRoster = roster.filter((row) => selectedClassId === "all" || row.class_id === selectedClassId)
    .sort((left, right) => {
      const a = sortKey === "name" ? left.full_name || left.email : sortKey === "class" ? left.class_name : left.grade_level || "";
      const b = sortKey === "name" ? right.full_name || right.email : sortKey === "class" ? right.class_name : right.grade_level || "";
      return a.localeCompare(b) * (reverse ? -1 : 1);
    });
  const uniqueStudents = new Set(roster.map((row) => row.id)).size;

  const chooseClass = (id: string) => {
    setSelectedClassId(id);
    router.replace(id === "all" ? "/teacher/students" : "/teacher/students?classId=" + encodeURIComponent(id), { scroll: false });
  };

  const sort = (key: SortKey) => {
    setReverse(sortKey === key ? !reverse : false);
    setSortKey(key);
  };

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!className.trim() || busy) return;
    setBusy(true);
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to create a class.");
      const { data, error: insertError } = await edsync.from("classes").insert({
        teacher_id: user.id,
        name: className.trim(),
        subject: subject.trim() || null,
        is_active: true,
      }).select().single();
      if (insertError || !data) throw insertError || new Error("Class was not created.");
      setClassOpen(false);
      setClassName("");
      setSubject("");
      toast.success("Class created");
      await load();
      chooseClass(data.id);
    } catch (cause) {
      toast.error(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const deleteClass = async (item: Class) => {
    if (!await confirm({ title: "Archive " + item.name + "?", body: "Students will lose access to this class and its shared courses.", confirmLabel: "Archive class", danger: true })) return;
    const { error: updateError } = await edsync.from("classes").update({ is_active: false }).eq("id", item.id);
    if (updateError) return toast.error(updateError.message);
    if (selectedClassId === item.id) chooseClass("all");
    toast.success("Class archived");
    await load();
  };

  const copyCode = async (item: Class) => {
    try {
      await navigator.clipboard.writeText(item.join_code);
      toast.success("Join code copied");
    } catch {
      toast.error("Could not copy join code.");
    }
  };

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosenClass || !lessonId || busy) return;
    if (assignments.some((item) => item.lesson_id === lessonId)) return toast.error("This course is already shared.");
    setBusy(true);
    try {
      const { data: { user } } = await edsync.auth.getUser();
      if (!user) throw new Error("Sign in to share a course.");
      const { error: insertError } = await edsync.from("lesson_assignments").insert({
        lesson_id: lessonId,
        class_id: chosenClass.id,
        assigned_by: user.id,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        is_active: true,
      });
      if (insertError) throw insertError;
      const notification = await fetch("/api/notifications/lesson-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, classId: chosenClass.id, dueDate: dueDate ? new Date(dueDate).toISOString() : null }),
      });
      if (!notification.ok) toast.error("Course shared, but notifications could not be sent.");
      else toast.success("Course shared");
      setAssignOpen(false);
      setLessonId("");
      setDueDate("");
      const { data } = await edsync.from("lesson_assignments").select("id, lesson_id, created_at, due_date, lessons(title)")
        .eq("class_id", chosenClass.id).eq("is_active", true).order("created_at", { ascending: false });
      setAssignments((data || []) as Assignment[]);
    } catch (cause) {
      toast.error(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const removeAssignment = async (item: Assignment) => {
    if (!await confirm({ title: "Remove shared course?", body: "Students in this class will lose access to it.", confirmLabel: "Remove", danger: true })) return;
    const { error: updateError } = await edsync.from("lesson_assignments").update({ is_active: false }).eq("id", item.id);
    if (updateError) return toast.error(updateError.message);
    setAssignments((current) => current.filter((assignment) => assignment.id !== item.id));
    toast.success("Course removed");
  };

  const openStudent = async (row: RosterRow) => {
    setStudent(row);
    setDetailLoading(true);
    setStudentGrades([]);
    setStudentProgress([]);
    try {
      const [gradeResponse, progressResult, assignmentResult] = await Promise.all([
        fetch("/api/grades?classId=" + encodeURIComponent(row.class_id), { cache: "no-store" }),
        edsync.from("student_progress").select("*").eq("student_id", row.id),
        edsync.from("lesson_assignments").select("lesson_id").eq("class_id", row.class_id).eq("is_active", true),
      ]);
      const payload = await gradeResponse.json();
      if (!gradeResponse.ok || payload.error || progressResult.error || assignmentResult.error) throw progressResult.error || assignmentResult.error || new Error(payload.error || "Could not load student details.");
      setStudentGrades(((payload.data?.scores || []) as Grade[]).filter((grade) => grade.student_id === row.id));
      const assignedIds = new Set(((assignmentResult.data || []) as Array<{ lesson_id: string }>).map((item) => item.lesson_id));
      const ownLessonIds = new Set(lessons.filter((lesson) => lesson.class_id === row.class_id || assignedIds.has(lesson.id)).map((lesson) => lesson.id));
      setStudentProgress(((progressResult.data || []) as StudentProgress[]).filter((progress) => ownLessonIds.has(progress.lesson_id)));
    } catch (cause) {
      toast.error(message(cause));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="page">
      <PageHeader title="Classes" icon={UsersRound} count={classes.length} actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => setClassOpen(true)}>New class</Button>} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button type="button" aria-pressed={selectedClassId === "all"} onClick={() => chooseClass("all")} className={"shrink-0 rounded-full border px-3 py-1.5 text-sm " + (selectedClassId === "all" ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg")}>All classes <span className="tabular-nums">{uniqueStudents}</span></button>
        {classes.map((item) => <button key={item.id} type="button" aria-pressed={selectedClassId === item.id} onClick={() => chooseClass(item.id)} className={"shrink-0 rounded-full border px-3 py-1.5 text-sm " + (selectedClassId === item.id ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:text-fg")}>{item.name}</button>)}
      </div>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">{error} <Button size="sm" onClick={() => void load()}>Retry</Button></div> : null}
      {chosenClass ? <section className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-fg">{chosenClass.name}</h2><p className="text-xs text-fg-muted">{chosenClass.subject || "Class"} · Join code <strong className="tracking-wider text-fg">{chosenClass.join_code}</strong></p></div>
        <Button size="sm" icon={ClipboardCopy} onClick={() => void copyCode(chosenClass)}>Copy code</Button>
        <Menu label={"Class actions for " + chosenClass.name} items={[{ label: "Archive class", icon: Trash2, danger: true, onSelect: () => void deleteClass(chosenClass) }]} />
      </section> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Roster</h2><Badge>{visibleRoster.length}</Badge></div>
          {loading ? <div className="space-y-2 p-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div> : visibleRoster.length === 0 ? <EmptyState icon={UsersRound} title="No learners yet" hint={chosenClass ? "Share the join code to invite learners." : "Create a class and invite learners."} compact /> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs text-fg-muted"><tr>
              <th className="px-4 py-2"><button type="button" onClick={() => sort("name")} className="inline-flex items-center gap-1">Learner <ArrowDownUp size={12} /></button></th>
              <th className="hidden px-4 py-2 sm:table-cell"><button type="button" onClick={() => sort("class")} className="inline-flex items-center gap-1">Class <ArrowDownUp size={12} /></button></th>
              <th className="hidden px-4 py-2 sm:table-cell"><button type="button" onClick={() => sort("grade")} className="inline-flex items-center gap-1">Level <ArrowDownUp size={12} /></button></th>
            </tr></thead>
            <tbody>{visibleRoster.map((row) => <tr key={row.class_id + row.id} className="border-t border-line hover:bg-surface-2">
              <td className="px-4 py-2"><button type="button" onClick={() => void openStudent(row)} className="flex min-w-0 items-center gap-2 text-left"><Avatar name={row.full_name || row.email} size={28} decorative /><span className="min-w-0"><span className="block truncate font-medium text-fg">{row.full_name || row.email}</span><span className="block truncate text-xs text-fg-muted">{row.email}</span></span></button></td>
              <td className="hidden px-4 py-2 text-fg-muted sm:table-cell">{row.class_name}</td>
              <td className="hidden px-4 py-2 text-fg-muted sm:table-cell">{row.grade_level || "—"}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold text-fg">Shared courses</h2>{chosenClass ? <Button size="sm" icon={Plus} onClick={() => setAssignOpen(true)}>Share</Button> : null}</div>
          {!chosenClass ? <p className="p-4 text-sm text-fg-muted">Choose a class to manage its courses.</p> :
            assignments.length === 0 ? <EmptyState icon={BookOpen} title="Nothing shared" hint="Share a course with this class." compact /> :
            <div>{assignments.map((item) => <div key={item.id} className="flex items-center gap-2 border-b border-line px-4 py-3 last:border-b-0"><Link href={"/teacher/lessons/" + item.lesson_id} className="min-w-0 flex-1 truncate text-sm font-medium text-fg hover:text-accent">{item.lessons?.title || "Course"}</Link><Menu label="Shared course actions" items={[{ label: "Remove from class", icon: Trash2, danger: true, onSelect: () => void removeAssignment(item) }]} /></div>)}</div>}
        </section>
      </div>
      <Sheet open={classOpen} onClose={() => setClassOpen(false)} title="New class" footer={<Button form="new-class-form" type="submit" variant="primary" loading={busy}>Create class</Button>}>
        <form id="new-class-form" onSubmit={createClass} className="space-y-4">
          <label className="block text-sm font-medium text-fg">Class name<input className="input mt-1 w-full" required maxLength={120} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Biology, Period 2" /></label>
          <label className="block text-sm font-medium text-fg">Subject<input className="input mt-1 w-full" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Optional" /></label>
        </form>
      </Sheet>
      <Sheet open={assignOpen && !!chosenClass} onClose={() => setAssignOpen(false)} title="Share course" footer={<Button form="share-course-form" type="submit" variant="primary" loading={busy}>Share</Button>}>
        <form id="share-course-form" onSubmit={assign} className="space-y-4">
          <label className="block text-sm font-medium text-fg">Course<select className="input mt-1 w-full" required value={lessonId} onChange={(event) => setLessonId(event.target.value)}><option value="">Select a course</option>{lessons.filter((item) => item.status === "published" && !assignments.some((assignment) => assignment.lesson_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="block text-sm font-medium text-fg">Due date<input className="input mt-1 w-full" type="datetime-local" min={localNow()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </form>
      </Sheet>
      <Sheet open={student !== null} onClose={() => setStudent(null)} title={student?.full_name || student?.email || "Learner"} description={student?.class_name}>
        {detailLoading ? <div className="space-y-2">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12" />)}</div> :
          <div className="space-y-6">
            <section><h3 className="mb-2 text-sm font-semibold text-fg">Grades</h3>{studentGrades.length ? studentGrades.map((grade) => <div key={grade.id} className="flex items-center justify-between border-b border-line py-2 text-sm"><span className="truncate text-fg">{grade.title}</span><span className="tabular-nums text-fg-muted">{grade.percent === null ? "—" : Math.round(grade.percent) + "%"}</span></div>) : <p className="text-sm text-fg-muted">No grades yet.</p>}</section>
            <section><h3 className="mb-2 text-sm font-semibold text-fg">Course progress</h3>{studentProgress.length ? studentProgress.map((progress) => <div key={progress.id} className="flex items-center justify-between border-b border-line py-2 text-sm"><span className="truncate text-fg">{lessons.find((item) => item.id === progress.lesson_id)?.title || "Course"}</span><Badge tone={progress.status === "completed" ? "success" : "neutral"}>{progress.status.replaceAll("_", " ")}</Badge></div>) : <p className="text-sm text-fg-muted">No course activity yet.</p>}</section>
          </div>}
      </Sheet>
    </main>
  );
}
