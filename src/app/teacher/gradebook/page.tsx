"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type ClassRow = { id: string; name: string };
type StudentRow = { id: string; full_name: string | null; email: string; class_id: string };
type GradeRow = { studentId: string; name: string; email: string; overall: number | null; scores: Array<{ title: string; percent: number | null; status: string }> };

export default function TeacherGradebookPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [form, setForm] = useState({ studentId: "", title: "", earned: "", possible: "100" });
  const [loading, setLoading] = useState(true);

  const filteredStudents = useMemo(
    () => students.filter((student) => !classId || student.class_id === classId),
    [classId, students],
  );

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
      }),
    });
    if (!response.ok) {
      toast.error("Score was not saved.");
      return;
    }
    toast.success("Score saved.");
    setForm({ studentId: "", title: "", earned: "", possible: "100" });
    await loadGrades();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Gradebook</h1>
          <p className="mt-2 text-sm text-edsync-subtle">Review weighted progress and add manual scores.</p>
        </div>
        <select className="edsync-input max-w-xs" value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <form onSubmit={addScore} className="edsync-card grid gap-3 p-4 md:grid-cols-5">
        <select className="edsync-input" value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })} required>
          <option value="">Student</option>
          {filteredStudents.map((student) => (
            <option key={`${student.class_id}-${student.id}`} value={student.id}>{student.full_name || student.email}</option>
          ))}
        </select>
        <input className="edsync-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Score title" required />
        <input className="edsync-input" value={form.earned} onChange={(event) => setForm({ ...form, earned: event.target.value })} placeholder="Earned" type="number" required />
        <input className="edsync-input" value={form.possible} onChange={(event) => setForm({ ...form, possible: event.target.value })} placeholder="Possible" type="number" required />
        <button className="btn-primary justify-center" type="submit">Add score</button>
      </form>

      <div className="edsync-card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-edsync-border text-xs uppercase text-edsync-subtle">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Overall</th>
              <th className="px-4 py-3">Recent scores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edsync-border">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-edsync-subtle" colSpan={3}>
                  Loading gradebook...
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.studentId}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-edsync-subtle">{row.email}</p>
                </td>
                <td className="px-4 py-3 text-2xl font-bold">{row.overall ?? "—"}{row.overall !== null ? "%" : ""}</td>
                <td className="px-4 py-3 text-edsync-subtle">
                  {row.scores.slice(0, 3).map((score) => `${score.title}: ${score.percent ?? "—"}%`).join(" · ") || "No scores yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className="p-4 text-sm text-edsync-subtle">No gradebook rows yet.</p>}
      </div>
    </div>
  );
}
