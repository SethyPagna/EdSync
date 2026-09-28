"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import OutlineComposer from "@/components/compose/OutlineComposer";
import { createCourseFromOutline } from "@/components/compose/api";
import { useConfirm } from "@/components/ui/Confirm";
import type { LessonOutline } from "@/lib/compose/types";
import { useStudio } from "../store";
import { PanelSection } from "./parts/PanelControls";

export default function MagicPanel() {
  const deck = useStudio((state) => state.deck);
  const composeFromOutline = useStudio((state) => state.composeFromOutline);
  const confirm = useConfirm();
  const [mode, setMode] = useState<"replace" | "append">("append");
  const [outline, setOutline] = useState<LessonOutline | null>(null);
  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", { credentials: "include" }).then(async (response) => {
      const payload = await response.json() as { data?: { user?: { user_metadata?: { role?: string } } | null } };
      const nextRole = payload.data?.user?.user_metadata?.role;
      if (!cancelled && (nextRole === "teacher" || nextRole === "admin" || nextRole === "student")) setRole(nextRole);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const design = async (next: LessonOutline) => {
    if (!deck) return;
    if (mode === "replace" && deck.pages.some((page) => page.elements.length)) {
      if (!await confirm({ title: "Replace this design?", body: "The current pages will be replaced.", confirmLabel: "Replace pages" })) return;
    }
    composeFromOutline(next, mode);
    setOutline(next);
    setCourseId("");
    setNotice(mode === "append" ? "Pages added." : "Design created.");
  };

  const makeCourse = async () => {
    if (!outline || (role !== "teacher" && role !== "admin")) return;
    setBusy(true);
    setError("");
    try {
      const documentId = new URLSearchParams(window.location.search).get("doc") ?? deck?.id ?? null;
      const created = await createCourseFromOutline({ outline, studioDocumentId: documentId });
      if (!created.lessonId) throw new Error("Course was not created.");
      setCourseId(created.lessonId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Course could not be created."); }
    finally { setBusy(false); }
  };

  return <div role="tabpanel" aria-label="Magic" className="pb-4">
    <PanelSection title="Create with an outline" action={<Sparkles size={16} className="text-accent" />} />
    <div className="px-3"><div className="segmented mb-3" role="radiogroup" aria-label="Where to place new pages"><button type="button" role="radio" aria-checked={mode === "append"} data-active={mode === "append"} onClick={() => setMode("append")} className="segmented-item">Add pages</button><button type="button" role="radio" aria-checked={mode === "replace"} data-active={mode === "replace"} onClick={() => setMode("replace")} className="segmented-item">Replace</button></div><OutlineComposer useLabel="Design it" onUse={(next) => design(next)} compact busy={busy} /></div>
    {notice && <p role="status" className="px-3 pt-3 text-xs text-success">{notice}</p>}
    {(role === "teacher" || role === "admin") && outline && <><PanelSection title="Use in a course" /><div className="px-3"><button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={() => void makeCourse()}><BookOpen size={16} /> {busy ? "Creating…" : "Make a course"}</button></div></>}
    {error && <p role="alert" className="px-3 pt-3 text-xs text-danger">{error}</p>}
    {courseId && <div role="status" className="mx-3 mt-3 rounded-lg border border-success bg-success-soft p-2.5 text-xs text-success"><span>Course created.</span><Link href={`/teacher/lessons/${encodeURIComponent(courseId)}`} className="ml-2 inline-flex items-center gap-1 font-semibold underline">Open course <ArrowUpRight size={13} /></Link></div>}
  </div>;
}
