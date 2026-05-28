"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/edsync/client";
import type { Profile, Class, Lesson } from "@/types";
import { generateInitials, formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import { BookOpenCheck, Plus, Trash2, UsersRound } from "lucide-react";

interface Assignment {
  id: string;
  lesson_id: string;
  lesson_title: string;
  created_at: string;
  due_date: string | null;
}

type EnrollmentRow = { student_id: string; class_id?: string };
type AssignmentRow = {
  id: string;
  lesson_id: string;
  created_at: string;
  due_date: string | null;
  lessons?: { title?: string | null } | null;
};

const CLASS_CARD_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
];

export default function TeacherStudents() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [students, setStudents] = useState<Profile[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [myLessons, setMyLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Create class modal
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);

  // Assign lesson modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignLessonId, setAssignLessonId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  const edsync = useMemo(() => createClient(), []);
  const assignedLessonIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.lesson_id)),
    [assignments],
  );
  const activeClass = useMemo(
    () => classes.find((classItem) => classItem.id === selectedClass),
    [classes, selectedClass],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await edsync.auth.getUser();
      if (!user) return;

      const [classRes, lessonsRes] = await Promise.all([
        edsync
          .from("classes")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_active", true)
          .order("name"),
        edsync
          .from("lessons")
          .select("id, title, status")
          .eq("teacher_id", user.id)
          .order("title"),
      ]);

      if (classRes.error) {
        toast.error("Could not load classes: " + classRes.error.message);
        return;
      }

      const myClasses: Class[] = classRes.data || [];
      setClasses(myClasses);
      setMyLessons((lessonsRes.data || []) as Lesson[]);

      if (myClasses.length === 0) {
        setAllStudents([]);
        setStudents([]);
        return;
      }
      const classIds = myClasses.map((classItem) => classItem.id);

      const { data: enrollments } = await edsync
        .from("class_enrollments")
        .select("student_id, class_id")
        .in("class_id", classIds)
        .eq("is_active", true);

      const studentIds = Array.from(
        new Set(((enrollments || []) as EnrollmentRow[]).map((enrollment) => enrollment.student_id)),
      );
      if (studentIds.length === 0) {
        setAllStudents([]);
        setStudents([]);
        return;
      }

      const { data: profileData } = await edsync
        .from("profiles")
        .select("*")
        .in("id", studentIds);
      setAllStudents(profileData || []);
      setStudents(profileData || []);
    } finally {
      setLoading(false);
    }
  }, [edsync]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAssignments = useCallback(async (classId: string) => {
    const { data } = await edsync
      .from("lesson_assignments")
      .select("id, lesson_id, created_at, due_date, lessons(title)")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setAssignments(
      ((data || []) as AssignmentRow[]).map((assignment) => ({
        id: assignment.id,
        lesson_id: assignment.lesson_id,
        lesson_title: assignment.lessons?.title || "Unknown lesson",
        created_at: assignment.created_at,
        due_date: assignment.due_date,
      })),
    );
  }, [edsync]);

  const selectClass = async (classId: string) => {
    setSelectedClass(classId);
    if (classId === "all") {
      setStudents(allStudents);
      setAssignments([]);
      return;
    }
    const { data } = await edsync
      .from("class_enrollments")
      .select("student_id")
      .eq("class_id", classId)
      .eq("is_active", true);
    const ids = new Set(((data || []) as EnrollmentRow[]).map((enrollment) => enrollment.student_id));
    setStudents(allStudents.filter((student) => ids.has(student.id)));
    await loadAssignments(classId);
  };

  const createClass = async () => {
    if (!newClassName.trim()) {
      toast.error("Class name is required");
      return;
    }
    setCreating(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const { data, error } = await edsync
      .from("classes")
      .insert({
        teacher_id: user.id,
        name: newClassName.trim(),
        subject: newSubject.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed: " + error.message);
      setCreating(false);
      return;
    }
    setClasses((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setNewClassName("");
    setNewSubject("");
    setShowAddClass(false);
    setCreating(false);
    toast.success(`Class "${data.name}" created. Join code: ${data.join_code}`);
  };

  const assignLesson = async () => {
    if (!assignLessonId) {
      toast.error("Pick a lesson first");
      return;
    }
    if (selectedClass === "all") {
      toast.error("Select a specific class first");
      return;
    }
    setAssigning(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setAssigning(false);
      return;
    }

    if (assignedLessonIds.has(assignLessonId)) {
      toast.error("Already assigned");
      setAssigning(false);
      return;
    }

    const { error } = await edsync.from("lesson_assignments").insert({
      lesson_id: assignLessonId,
      class_id: selectedClass,
      assigned_by: user.id,
      due_date: assignDueDate || null,
      is_active: true,
    });

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      await fetch("/api/notifications/lesson-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lessonId: assignLessonId,
          classId: selectedClass,
          dueDate: assignDueDate || null,
        }),
      });
      toast.success("Lesson assigned!");
      await loadAssignments(selectedClass);
      setAssignLessonId("");
      setAssignDueDate("");
      setShowAssign(false);
    }
    setAssigning(false);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Remove this assignment from the class?")) return;
    await edsync
      .from("lesson_assignments")
      .update({ is_active: false })
      .eq("id", id);
    setAssignments((a) => a.filter((x) => x.id !== id));
    toast.success("Assignment removed");
  };

  const deleteClass = async (classId: string) => {
    if (
      !confirm("Delete this class? Students will lose access to its lessons.")
    )
      return;
    await edsync
      .from("classes")
      .update({ is_active: false })
      .eq("id", classId);
    setClasses((c) => c.filter((cls) => cls.id !== classId));
    if (selectedClass === classId) {
      setSelectedClass("all");
      setStudents(allStudents);
    }
    toast.success("Class deleted");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
            Classroom
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-edsync-text">
            Students
          </h1>
          <p className="mt-1 text-sm text-edsync-subtle">
            {allStudents.length} enrolled · {classes.length} class
            {classes.length !== 1 ? "es" : ""}
          </p>
        </div>
        <button onClick={() => setShowAddClass(true)} className="btn-primary justify-center">
          <Plus className="h-4 w-4" />
          New class
        </button>
      </div>
      </section>

      {/* Create Class Modal */}
      {showAddClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="edsync-card w-full max-w-md animate-slide-up p-8">
            <h2 className="font-display font-bold text-xl text-edsync-text mb-6">
              Create class
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-edsync-subtle mb-2">
                  Class Name *
                </label>
                <input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Biology 10A"
                  className="edsync-input"
                  onKeyDown={(e) => e.key === "Enter" && createClass()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-edsync-subtle mb-2">
                  Subject (optional)
                </label>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Biology"
                  className="edsync-input"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddClass(false);
                  setNewClassName("");
                  setNewSubject("");
                }}
                className="btn-secondary flex-1 justify-center"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={creating || !newClassName.trim()}
                className="btn-primary flex-1 justify-center"
              >
                {creating ? "Creating..." : "Create Class"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Lesson Modal */}
      {showAssign && selectedClass !== "all" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="edsync-card w-full max-w-md animate-slide-up p-8">
            <h2 className="font-display font-bold text-xl text-edsync-text mb-1">
              Assign lesson
            </h2>
            <p className="text-edsync-subtle text-sm mb-6">
              To:{" "}
              <span className="text-edsync-text font-medium">
                {activeClass?.name}
              </span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-edsync-subtle mb-2">
                  Lesson *
                </label>
                <select
                  value={assignLessonId}
                  onChange={(e) => setAssignLessonId(e.target.value)}
                  className="edsync-input"
                >
                  <option value="">— Choose a lesson —</option>
                  {myLessons
                    .filter(
                      (lesson) => !assignedLessonIds.has(lesson.id),
                    )
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                        {l.status !== "published" ? " (draft)" : ""}
                      </option>
                    ))}
                </select>
                {myLessons.filter(
                  (lesson) => !assignedLessonIds.has(lesson.id),
                ).length === 0 && (
                  <p className="text-xs text-edsync-subtle mt-1">
                    All your lessons are already assigned to this class.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-edsync-subtle mb-2">
                  Due Date (optional)
                </label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="edsync-input"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssign(false);
                  setAssignLessonId("");
                  setAssignDueDate("");
                }}
                className="btn-secondary flex-1 justify-center"
                disabled={assigning}
              >
                Cancel
              </button>
              <button
                onClick={assignLesson}
                disabled={assigning || !assignLessonId}
                className="btn-primary flex-1 justify-center"
              >
                {assigning ? "Assigning..." : "Assign Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classes Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-edsync-card rounded-2xl shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {/* All Classes card */}
          <div
            onClick={() => selectClass("all")}
            className={`edsync-card cursor-pointer transition-all border-dashed ${selectedClass === "all" ? "border-edsync-blue shadow-glow-blue" : "hover:border-edsync-muted"}`}
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
              <UsersRound className="h-5 w-5" />
            </div>
            <h3 className="font-display font-bold text-edsync-text">
              All Classes
            </h3>
            <p className="text-xs text-edsync-subtle">
              {allStudents.length} students total
            </p>
          </div>

          {classes.map((cls, i) => (
            <div
              key={cls.id}
              onClick={() => selectClass(cls.id)}
              className={`edsync-card cursor-pointer transition-all relative group ${selectedClass === cls.id ? "border-edsync-blue shadow-glow-blue" : "hover:border-edsync-muted"}`}
            >
              <div
                className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${CLASS_CARD_COLORS[i % CLASS_CARD_COLORS.length]}`}
              >
                <span className="text-white text-sm font-semibold">
                  {cls.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase() || "CL"}
                </span>
              </div>
              <h3 className="font-display font-bold text-edsync-text truncate">
                {cls.name}
              </h3>
              <p className="text-xs text-edsync-subtle">
                {cls.subject || "No subject"}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-edsync-border pt-3">
                <span className="text-xs text-edsync-subtle">Join code</span>
                <span className="font-mono text-edsync-amber font-bold text-sm">
                  {cls.join_code}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteClass(cls.id);
                }}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-[0] text-edsync-subtle opacity-0 transition-opacity hover:bg-edsync-red/10 hover:text-edsync-red group-hover:opacity-100"
                title="Delete class"
                aria-label={`Delete ${cls.name}`}
              >
                <Trash2 className="h-4 w-4" />
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students table */}
        <div className="lg:col-span-2 edsync-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-edsync-text">
              {selectedClass === "all"
                ? "All Students"
                : activeClass?.name || "Class"}
            </h2>
            <span className="badge bg-edsync-blue/10 text-edsync-blue border-edsync-blue/20">
              {students.length} students
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-edsync-surface rounded-xl shimmer"
                />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-semibold text-edsync-text mb-1">
                No students yet
              </p>
              <p className="text-edsync-subtle text-sm">
                {selectedClass === "all"
                  ? "Share a class join code with your students so they can enroll."
                  : `Share the join code ${activeClass ? `"${activeClass.join_code}"` : ""} with your students.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edsync-border">
                    <th className="text-left text-xs text-edsync-subtle font-medium pb-3 pr-4">
                      Student
                    </th>
                    <th className="text-left text-xs text-edsync-subtle font-medium pb-3 pr-4">
                      Grade
                    </th>
                    <th className="text-left text-xs text-edsync-subtle font-medium pb-3 pr-4">
                      Interests
                    </th>
                    <th className="text-left text-xs text-edsync-subtle font-medium pb-3">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-edsync-border/50 hover:bg-edsync-surface/50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-edsync-blue to-edsync-purple flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {generateInitials(
                              student.full_name || student.email,
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-edsync-text text-sm">
                              {student.full_name || "—"}
                            </p>
                            <p className="text-xs text-edsync-subtle">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-edsync-subtle">
                        {student.grade_level || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1 flex-wrap">
                          {(student.interests || [])
                            .slice(0, 2)
                            .map((int, ii) => (
                              <span
                                key={ii}
                                className="badge bg-edsync-muted/30 text-edsync-subtle text-xs"
                              >
                                {int}
                              </span>
                            ))}
                          {!student.interests?.length && (
                            <span className="text-xs text-edsync-subtle/50">
                              Not set
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-edsync-subtle">
                        {formatRelativeTime(student.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assignments panel for selected class */}
        <div className="space-y-4">
          {selectedClass !== "all" ? (
            <>
              {/* Class info */}
              {activeClass && (
                <div className="edsync-card">
                  <h3 className="font-semibold text-edsync-text mb-3">
                    Class Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-edsync-subtle">Join Code</span>
                      <span className="font-mono font-bold text-edsync-amber">
                        {activeClass.join_code}
                      </span>
                    </div>
                    {activeClass.subject && (
                      <div className="flex justify-between">
                        <span className="text-edsync-subtle">Subject</span>
                        <span className="text-edsync-text">
                          {activeClass.subject}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-edsync-subtle">Students</span>
                      <span className="text-edsync-text">{students.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lesson assignments */}
              <div className="edsync-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-edsync-text">
                    Assigned Lessons
                  </h3>
                  <button
                    onClick={() => setShowAssign(true)}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    <BookOpenCheck className="h-3.5 w-3.5" />
                    Assign
                  </button>
                </div>
                {assignments.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-edsync-subtle text-sm mb-3">
                      No lessons assigned yet.
                    </p>
                    <button
                      onClick={() => setShowAssign(true)}
                      className="btn-secondary text-sm py-2"
                    >
                      Assign a Lesson
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-2 p-3 bg-edsync-surface rounded-xl border border-edsync-border"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/teacher/lessons/${a.lesson_id}`}
                            className="text-sm font-medium text-edsync-text hover:text-edsync-blue truncate block"
                          >
                            {a.lesson_title}
                          </Link>
                          {a.due_date && (
                            <p className="text-xs text-edsync-amber mt-0.5">
                              Due {new Date(a.due_date).toLocaleDateString()}
                            </p>
                          )}
                          <p className="text-xs text-edsync-subtle">
                            Assigned {formatRelativeTime(a.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="text-edsync-subtle hover:text-edsync-red text-sm flex-shrink-0"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="edsync-card text-center py-8">
              <p className="font-medium text-edsync-text mb-1">Select a class</p>
              <p className="text-edsync-subtle text-sm">
                Click a class card to see its details, students, and manage
                lesson assignments.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
