"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardList, GraduationCap, Plus, TrendingUp } from "lucide-react";

type ClassRow = { id: string; name: string };
type StudentRow = { id: string; full_name: string | null; email: string; class_id: string };
type GradeRow = {
  studentId: string;
  name: string;
  email: string;
  overall: number | null;
  scores: Array<{ title: string; percent: number | null; status: string; feedback?: string | null }>;
};

function gradeText(value: number | null) {
  return value === null ? "Not graded" : `${value}%`;
}

export default function TeacherGradebookPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [form, setForm] = useState({
    studentId: "",
    title: "",
    earned: "",
    possible: "100",
    feedback: "",
    releaseToStudent: true,
  });
  const [loading, setLoading] = useState(true);

  const filteredStudents = useMemo(
    () => students.filter((student) => !classId || student.class_id === classId),
    [classId, students],
  );

  const classLabel = classes.find((item) => item.id === classId)?.name || "All classes";
  const gradedRows = rows.filter((row) => row.overall !== null);
  const average =
    gradedRows.length > 0
      ? Math.round(gradedRows.reduce((sum, row) => sum + Number(row.overall), 0) / gradedRows.length)
      : null;

  const loadRoster = useCallback(async () => {
    const response = await fetch("/api/teacher/roster", { cache: "no-store" });
    const payload = await response.json();
    setClasses(payload.data?.classes ?? []);
    setStudents(payload.data?.students ?? []);
  }, []);

  const loadGrades = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/grades${classId ? `?classId=${classId}` : ""}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      setRows(payload.data?.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadRoster().catch(() => toast.error("Could not load roster."));
  }, [loadRoster]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  const addScore = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "score",
        classId: classId || null,
        studentId: form.studentId,
        title: form.title,
        pointsEarned: Number(form.earned),
        pointsPossible: Number(form.possible),
        feedback: form.feedback,
        status: form.releaseToStudent ? "graded" : "draft",
      }),
    });
    if (!response.ok) {
      toast.error("Score was not saved.");
      return;
    }
    toast.success("Score saved.");
    setForm({ studentId: "", title: "", earned: "", possible: "100", feedback: "", releaseToStudent: true });
    await loadGrades();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-amber">
              Assessment
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">Gradebook</h1>
            <p className="mt-1 text-sm text-edsync-subtle">
              {classLabel}, {rows.length} learner{rows.length !== 1 ? "s" : ""}
            </p>
          </div>
          <select
            className="edsync-input w-full lg:max-w-xs"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={TrendingUp} label="Class average" value={gradeText(average)} tone="text-edsync-blue" />
          <SummaryTile icon={GraduationCap} label="Graded learners" value={gradedRows.length} tone="text-edsync-emerald" />
          <SummaryTile icon={ClipboardList} label="Open rows" value={Math.max(0, rows.length - gradedRows.length)} tone="text-edsync-amber" />
        </div>
      </section>

      <form
        onSubmit={addScore}
        className="rounded-xl border border-edsync-border bg-edsync-card p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Add score</h2>
            <p className="text-sm text-edsync-subtle">Record a quick manual score.</p>
          </div>
          <Plus className="h-5 w-5 text-edsync-blue" />
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <select
            className="edsync-input"
            value={form.studentId}
            onChange={(event) => setForm({ ...form, studentId: event.target.value })}
            required
          >
            <option value="">Student</option>
            {filteredStudents.map((student) => (
              <option key={`${student.class_id}-${student.id}`} value={student.id}>
                {student.full_name || student.email}
              </option>
            ))}
          </select>
          <input
            className="edsync-input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Score title"
            required
          />
          <input
            className="edsync-input"
            value={form.earned}
            onChange={(event) => setForm({ ...form, earned: event.target.value })}
            placeholder="Earned"
            type="number"
            required
          />
          <input
            className="edsync-input"
            value={form.possible}
            onChange={(event) => setForm({ ...form, possible: event.target.value })}
            placeholder="Possible"
            type="number"
            required
          />
          <button className="btn-primary justify-center" type="submit">
            Save
          </button>
          <div className="md:col-span-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="rounded-xl border border-edsync-border bg-edsync-surface p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                {["Strong evidence:", "Next step:", "Review:", "Great progress:"].map((snippet) => (
                  <button
                    key={snippet}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, feedback: `${current.feedback}${current.feedback ? "\n" : ""}${snippet} ` }))}
                    className="rounded-full border border-edsync-border bg-edsync-card px-3 py-1.5 text-xs font-semibold text-edsync-subtle hover:border-edsync-blue/40 hover:text-edsync-blue"
                  >
                    {snippet}
                  </button>
                ))}
              </div>
              <textarea
                className="edsync-input min-h-24"
                value={form.feedback}
                onChange={(event) => setForm({ ...form, feedback: event.target.value })}
                placeholder="Optional rich feedback summary, next step, or rubric note..."
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-edsync-border bg-edsync-surface p-4">
              <span>
                <span className="block text-sm font-semibold text-edsync-text">Visible to student</span>
                <span className="mt-1 block text-xs text-edsync-subtle">
                  Turn off to save as draft until review is ready.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.releaseToStudent}
                onChange={(event) => setForm({ ...form, releaseToStudent: event.target.checked })}
                className="h-5 w-5 accent-edsync-blue"
              />
            </label>
          </div>
        </div>
      </form>

      <section className="rounded-xl border border-edsync-border bg-edsync-card">
        <div className="border-b border-edsync-border p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold">Learners</h2>
        </div>
        <div className="divide-y divide-edsync-border">
          {loading ? (
            <p className="p-5 text-sm text-edsync-subtle">Loading gradebook...</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-edsync-subtle">No gradebook rows yet.</p>
          ) : (
            rows.map((row) => (
              <article key={row.studentId} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_8rem] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-edsync-text">{row.name}</p>
                  <p className="mt-1 truncate text-xs text-edsync-subtle">{row.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.scores.slice(0, 3).map((score) => (
                      <span
                        key={`${row.studentId}-${score.title}`}
                        className={`badge ${score.status === "draft" ? "bg-edsync-amber/10 text-edsync-amber" : "bg-edsync-surface text-edsync-subtle"}`}
                      >
                        {score.title}: {score.status === "draft" ? "draft" : gradeText(score.percent)}
                      </span>
                    ))}
                    {row.scores.length === 0 && (
                      <span className="text-sm text-edsync-subtle">No scores yet</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-center">
                  <p className="font-display text-2xl font-bold text-edsync-text">{gradeText(row.overall)}</p>
                  <p className="mt-1 text-xs text-edsync-subtle">overall</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-edsync-subtle">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-edsync-text">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-current/10 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
