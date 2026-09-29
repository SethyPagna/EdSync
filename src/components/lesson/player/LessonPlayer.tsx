"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, List, MoreHorizontal, NotebookPen, Sparkles } from "lucide-react";
import { Button, EmptyState, IconButton, ProgressBar, Skeleton } from "@/components/ui";
import { isEditableTarget } from "@/components/ui/helpers";
import { createClient } from "@/lib/edsync/client";
import type { PlayerQuestion } from "@/lib/lessons/quiz";
import type { GlossaryTerm, Lesson, LessonSection, StudentProgress } from "@/types";
import { allAnswered, checkAnswer, loadQuestions, loadRecordedFinal, questionsForSection, saveProgress, submitFinal, type Answers, type FinalGrade, type ProgressSnapshot, type QuestionFeedback } from "./api";
import QuestionCard from "./QuestionCard";
import SectionContent from "./SectionContent";
import LessonSheet, { type LessonTool } from "./LessonSheet";

type View = "loading" | "warmup" | "section" | "final" | "finish" | "complete";
type FeedbackMap = Record<string, QuestionFeedback>;
type PageData = { lesson: Lesson; sections: LessonSection[]; questions: PlayerQuestion[]; glossary: GlossaryTerm[] };

const TICK_MS = 15_000;
const IDLE_MS = 45_000;

function errorText(error: unknown, fallback: string) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;
}

function initialSection(sections: LessonSection[], progress: StudentProgress | null) {
  if (!sections.length) return 0;
  const pointed = sections.findIndex((section) => section.id === progress?.current_section_id);
  if (pointed >= 0) return pointed;
  const next = sections.findIndex((section) => !progress?.sections_completed?.includes(section.id));
  return next < 0 ? sections.length - 1 : next;
}

export default function LessonPlayer({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [page, setPage] = useState<PageData | null>(null);
  const [view, setView] = useState<View>("loading");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [tool, setTool] = useState<LessonTool | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [feedback, setFeedback] = useState<FeedbackMap>({});
  const [finalGrade, setFinalGrade] = useState<FinalGrade | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const progressQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingSeconds = useRef(0);
  const lastInteraction = useRef(0);
  const viewRef = useRef<View>("loading");

  const recordProgress = useCallback((update: Parameters<typeof saveProgress>[1]) => {
    const operation = progressQueue.current.catch(() => undefined).then(() => saveProgress(lessonId, update));
    progressQueue.current = operation.then(() => undefined, () => undefined);
    return operation.then((saved) => { setProgress(saved); return saved; });
  }, [lessonId]);

  const load = useCallback(async () => {
    setView("loading");
    setLoadingError("");
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sign in to continue this lesson.");
      const [lessonResponse, sectionsResponse, glossaryResponse, questions, progressResponse] = await Promise.all([
        client.from("lessons").select("*").eq("id", lessonId).single(),
        client.from("lesson_sections").select("*").eq("lesson_id", lessonId).order("order_index"),
        client.from("glossary_terms").select("*").eq("lesson_id", lessonId).order("term"),
        loadQuestions(lessonId),
        client.from("student_progress").select("*").eq("student_id", user.id).eq("lesson_id", lessonId).maybeSingle(),
      ]);
      if (lessonResponse.error || !lessonResponse.data) throw new Error(errorText(lessonResponse.error, "Lesson unavailable."));
      if (sectionsResponse.error) throw new Error(errorText(sectionsResponse.error, "Sections unavailable."));
      if (glossaryResponse.error) throw new Error(errorText(glossaryResponse.error, "Glossary unavailable."));
      if (progressResponse.error) throw new Error(errorText(progressResponse.error, "Progress unavailable."));
      const lesson = lessonResponse.data as Lesson;
      const sections = (sectionsResponse.data ?? []) as LessonSection[];
      const glossary = (glossaryResponse.data ?? []) as GlossaryTerm[];
      const saved = progressResponse.data as StudentProgress | null;
      const snapshot = await recordProgress({});
      const recordedFinal = questions.some((question) => question.isFinal)
        ? await loadRecordedFinal(lessonId)
        : null;
      const index = initialSection(sections, saved);
      setPage({ lesson, sections, questions, glossary });
      setSectionIdx(index);
      setProgress(snapshot);
      setAnswers(recordedFinal?.answers ?? {});
      setFeedback({});
      setFinalGrade(recordedFinal?.grade ?? null);
      if (saved?.status === "completed" || snapshot.completed) setView("complete");
      else if (!saved && questions.some((question) => question.purpose === "diagnostic" && !question.isFinal)) setView("warmup");
      else if (sections.length > 0 && (saved?.sections_completed?.length ?? 0) < sections.length) setView("section");
      else if (questions.some((question) => question.isFinal)) setView("final");
      else setView("finish");
    } catch (cause) {
      setLoadingError(cause instanceof Error ? cause.message : "Lesson could not load.");
    }
  }, [client, lessonId, recordProgress]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { viewRef.current = view; }, [view]);

  const flushTime = useCallback(async () => {
    const seconds = pendingSeconds.current;
    if (seconds < TICK_MS / 1000) return;
    pendingSeconds.current = 0;
    try { await recordProgress({ timeSpentSeconds: seconds }); }
    catch { pendingSeconds.current += seconds; }
  }, [recordProgress]);

  useEffect(() => {
    lastInteraction.current = Date.now();
    const active = () => { lastInteraction.current = Date.now(); };
    const tick = () => {
      if (document.hidden || viewRef.current === "loading" || viewRef.current === "complete" || Date.now() - lastInteraction.current > IDLE_MS) return;
      pendingSeconds.current += TICK_MS / 1000;
      if (pendingSeconds.current >= 60) void flushTime();
    };
    const hidden = () => { if (document.hidden) void flushTime(); };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((name) => window.addEventListener(name, active, { passive: true }));
    document.addEventListener("visibilitychange", hidden);
    const timer = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, active));
      document.removeEventListener("visibilitychange", hidden);
      void flushTime();
    };
  }, [flushTime]);

  const section = page?.sections[sectionIdx];
  const finalQuestions = useMemo(() => page?.questions.filter((question) => question.isFinal) ?? [], [page]);
  const warmupQuestions = useMemo(() => page?.questions.filter((question) => question.purpose === "diagnostic" && !question.isFinal) ?? [], [page]);
  const sectionQuestions = useMemo(() => section && page ? questionsForSection(page.questions, section.id) : [], [page, section]);
  const activeQuestions = view === "warmup" ? warmupQuestions : view === "section" ? sectionQuestions : finalQuestions;
  const checked = activeQuestions.length > 0 && activeQuestions.every((question) => feedback[question.id] !== undefined);
  const completedIds = progress?.sectionsCompleted ?? [];
  const progressPercent = Math.round((progress?.progress ?? 0) * 100);
  const missedPrompts = finalQuestions.filter((question) => finalGrade?.results.some((result) => result.questionId === question.id && result.correct === false)).map((question) => question.prompt);
  const tutorPhase: "diagnostic" | "quiz_section" | "final_quiz" | "learning" = view === "warmup" ? "diagnostic" : view === "final" ? "final_quiz" : view === "section" && sectionQuestions.length > 0 && !checked ? "quiz_section" : "learning";

  const goToSection = useCallback(async (index: number) => {
    if (!page || index < 0 || index >= page.sections.length) return;
    setActionError("");
    try {
      await recordProgress({ currentSectionId: page.sections[index].id });
      setSectionIdx(index);
      setView("section");
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Position could not be saved."); }
  }, [page, recordProgress]);

  const runAction = async (action: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError("");
    try { await action(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Something went wrong. Try again."); }
    finally { actionLock.current = false; setBusy(false); }
  };

  const checkQuestions = () => void runAction(async () => {
    const results = await Promise.all(activeQuestions.map((question) => checkAnswer(lessonId, question.id, answers[question.id])));
    setFeedback((current) => Object.fromEntries([...Object.entries(current), ...activeQuestions.map((question, index) => [question.id, results[index]])]));
  });

  const nextSection = () => void runAction(async () => {
    if (!page || !section) return;
    const next = page.sections[sectionIdx + 1];
    await recordProgress({ completedSectionIds: [section.id], ...(next ? { currentSectionId: next.id } : {}) });
    if (next) { setSectionIdx(sectionIdx + 1); setView("section"); }
    else setView(finalQuestions.length ? "final" : "finish");
  });

  const sendFinal = () => void runAction(async () => {
    if (!allAnswered(finalQuestions, answers)) return;
    const result = await submitFinal(lessonId, Object.fromEntries(finalQuestions.map((question) => [question.id, answers[question.id]])));
    setFinalGrade(result);
  });

  const finish = () => void runAction(async () => {
    await recordProgress({ completed: true });
    setView("complete");
  });

  const nextSectionFromKey = useEffectEvent(() => nextSection());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target) || (event.target instanceof Element && event.target.closest("dialog"))) return;
      if (view !== "section") return;
      if (event.key === "ArrowLeft" && sectionIdx > 0) { event.preventDefault(); void goToSection(sectionIdx - 1); }
      if (event.key === "ArrowRight" && section && (!sectionQuestions.length || checked)) { event.preventDefault(); nextSectionFromKey(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, sectionIdx, section, sectionQuestions.length, checked, goToSection]);

  if (view === "loading" || !page) return (
    <div className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center gap-4 px-4">
      {loadingError ? <div role="alert" className="space-y-4 text-center"><EmptyState icon={BookOpen} title={loadingError} action={<Button onClick={() => void load()}>Retry</Button>} /><Link href="/student/lessons" className="text-sm text-accent">Back to courses</Link></div> : <><Skeleton className="h-8 w-2/3" /><Skeleton className="h-52" /><Skeleton className="h-12" /></>}
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-[52px] max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <IconButton href="/student/lessons" icon={ArrowLeft} label="Back to courses" size="sm" />
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{page.lesson.title}</p><p className="text-[11px] text-fg-muted">{view === "section" ? `Section ${sectionIdx + 1} of ${page.sections.length}` : view === "final" ? "Final quiz" : view === "warmup" ? "Warm-up" : view === "complete" ? "Completed" : "Ready to finish"}</p></div>
          <span className="hidden text-xs tabular-nums text-fg-muted sm:inline">{progressPercent}%</span>
          <IconButton icon={List} label="Sections" size="sm" onClick={() => setTool("outline")} />
          <IconButton icon={NotebookPen} label="Notes" size="sm" onClick={() => setTool("notes")} />
          <IconButton icon={BookOpen} label="Glossary" size="sm" onClick={() => setTool("glossary")} className="hidden sm:inline-flex" />
          <IconButton icon={MoreHorizontal} label="More lesson tools" size="sm" onClick={() => setTool("more")} />
        </div>
        <ProgressBar value={progressPercent} label="Lesson progress" className="h-0.5 rounded-none" />
      </header>

      <main id="lesson-content" className="mx-auto w-full max-w-[720px] px-4 pb-32 pt-7 sm:px-6 sm:pt-10">
        {view === "warmup" && (
          <div className="space-y-5">
            <div><p className="mb-1 text-xs text-fg-muted">Optional</p><h1 className="text-[22px] font-semibold tracking-tight">Warm-up</h1></div>
            {warmupQuestions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} answer={answers[question.id]} onAnswer={(answer) => setAnswers((current) => ({ ...current, [question.id]: answer }))} feedback={feedback[question.id]} />)}
            {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
            <div className="flex justify-end gap-2">{!checked && <Button onClick={() => setView(page.sections.length ? "section" : finalQuestions.length ? "final" : "finish")}>Skip</Button>}{checked ? <Button variant="primary" iconRight={ArrowRight} onClick={() => setView(page.sections.length ? "section" : finalQuestions.length ? "final" : "finish")}>Begin lesson</Button> : <Button variant="primary" loading={busy} disabled={!allAnswered(warmupQuestions, answers)} onClick={checkQuestions}>Check answers</Button>}</div>
          </div>
        )}

        {view === "section" && section && (
          <div className="space-y-6">
            <div className="border-b border-line pb-5"><p className="mb-2 text-xs text-fg-muted">{sectionIdx + 1} / {page.sections.length}{section.duration_minutes ? ` · ${section.duration_minutes} min` : ""}</p><h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{section.title}</h1></div>
            <SectionContent key={section.id} section={section} />
            {sectionQuestions.length > 0 && <div className="space-y-4 border-t border-line pt-6"><h2 className="text-base font-semibold">Check your understanding</h2>{sectionQuestions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} answer={answers[question.id]} onAnswer={(answer) => setAnswers((current) => ({ ...current, [question.id]: answer }))} feedback={feedback[question.id]} />)}</div>}
            {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
          </div>
        )}

        {view === "final" && (
          <div className="space-y-5"><div><p className="mb-1 text-xs text-fg-muted">{finalQuestions.length} questions</p><h1 className="text-[22px] font-semibold tracking-tight">Final quiz</h1></div>
            {finalQuestions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} answer={answers[question.id]} onAnswer={(answer) => setAnswers((current) => ({ ...current, [question.id]: answer }))} feedback={finalGrade?.results.find((result) => result.questionId === question.id)} disabled={Boolean(finalGrade)} />)}
            {finalGrade && <div role="status" className="rounded-xl border border-line bg-surface p-5"><p className="text-sm font-medium text-fg">{finalGrade.status === "submitted" ? "Submitted for review" : "Quiz scored"}</p><p className="mt-1 text-sm text-fg-muted">{finalGrade.percent === null ? `${finalGrade.score} of ${finalGrade.maxScore} points scored so far; your teacher will review the rest.` : `${Math.round(finalGrade.percent)}% · ${finalGrade.score} of ${finalGrade.maxScore} points`}</p>{finalGrade.locked && <p className="mt-1 text-xs text-fg-muted">Your teacher's grade remains on record.</p>}</div>}
            {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
            <div className="flex justify-end">{finalGrade ? <Button variant="primary" iconRight={ArrowRight} onClick={() => setView(progress?.completed ? "complete" : "finish")}>Continue</Button> : <Button variant="primary" loading={busy} disabled={!allAnswered(finalQuestions, answers)} onClick={sendFinal}>Submit quiz</Button>}</div>
          </div>
        )}

        {view === "finish" && (
          <div className="space-y-5 rounded-xl border border-line bg-surface p-6"><div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Sparkles className="size-5" /></div><h1 className="text-[22px] font-semibold tracking-tight">Ready to finish</h1><p className="text-sm text-fg-muted">Your progress is saved.</p>{finalGrade?.percent !== null && finalGrade && <p className="text-2xl font-semibold tabular-nums text-fg">{Math.round(finalGrade.percent)}%</p>}
            {actionError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{actionError}</p>}
            <div className="flex flex-wrap gap-2"><Button variant="primary" icon={Check} loading={busy} onClick={finish}>Finish lesson</Button><Button icon={Sparkles} onClick={() => setTool("reflection")}>Reflect</Button><Button onClick={() => setTool("extended")}>Explore more</Button></div>
          </div>
        )}

        {view === "complete" && (
          <div className="space-y-5 rounded-xl border border-line bg-surface p-6 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><Check className="size-6" /></div><h1 className="text-[22px] font-semibold tracking-tight">Lesson complete</h1><p className="text-sm text-fg-muted">{progress?.streakDays ? `${progress.streakDays}-day learning streak` : "Your progress is saved."}</p>{finalGrade && <div role="status" className="rounded-lg bg-surface-2 p-3"><p className="text-xs font-medium text-fg-muted">Final quiz</p><p className="mt-1 text-lg font-semibold tabular-nums">{finalGrade.status === "submitted" ? "Pending review" : finalGrade.percent === null ? "Score unavailable" : `${Math.round(finalGrade.percent)}%`}</p>{finalGrade.locked && <p className="mt-1 text-xs text-fg-muted">Your teacher's grade remains on record.</p>}<Button className="mt-2" onClick={() => setView("final")}>Review answers</Button></div>}<div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => router.push("/student/lessons")}>More courses</Button><Button onClick={() => void goToSection(0)} disabled={!page.sections.length}>Review lesson</Button><Button icon={CircleHelp} onClick={() => setTool("tutor")}>Ask a question</Button></div></div>
        )}
      </main>

      {view === "section" && section && (
        <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 sm:px-6">
            <Button icon={ChevronLeft} disabled={sectionIdx === 0 || busy} onClick={() => void goToSection(sectionIdx - 1)}>Previous</Button>
            {sectionQuestions.length > 0 && !checked ? <Button variant="primary" iconRight={Check} loading={busy} disabled={!allAnswered(sectionQuestions, answers)} onClick={checkQuestions}>Check answers</Button> : <Button variant="primary" iconRight={ChevronRight} loading={busy} onClick={nextSection}>{sectionIdx === page.sections.length - 1 ? finalQuestions.length ? "Final quiz" : "Continue" : "Next"}</Button>}
          </div>
        </footer>
      )}

      <LessonSheet tool={tool} onClose={() => setTool(null)} onTool={setTool} lesson={page.lesson} sections={page.sections} sectionIdx={sectionIdx} completedIds={completedIds} onSelectSection={(index) => void goToSection(index)} glossary={page.glossary} missedPrompts={missedPrompts} tutorPhase={tutorPhase} />
    </div>
  );
}
