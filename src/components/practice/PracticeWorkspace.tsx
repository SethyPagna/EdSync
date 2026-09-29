"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Layers3, RotateCcw, Sparkles, Zap } from "lucide-react";
import OutlineComposer from "@/components/compose/OutlineComposer";
import { deriveFlashcards, derivePracticeItems, outlineFromText, type LessonOutline } from "@/lib/compose";
import { createClient } from "@/lib/edsync/client";
import { isPracticeItemCorrect, missedPracticeItems, summarizePracticeAttempt, type PracticeItem } from "@/lib/practice/engine";
import { normalizePracticeMode } from "@/lib/practice/modes";
import { listPracticeReviews, type PracticeReviewCardRow } from "@/lib/practice/reviews";
import type { Lesson, LessonSection, PracticeAttemptSummary, PracticeMode } from "@/types";

type PracticeWorkspaceProps = { initialAiOpen?: boolean; initialAiTask?: string; initialMode?: PracticeMode };
type Mode = "quiz" | "flashcards" | "sprint";
type LessonOption = Pick<Lesson, "id" | "title">;

function modeFromParam(mode?: PracticeMode): Mode {
  const value = normalizePracticeMode(mode);
  return value === "flashcards" ? "flashcards" : value === "sprint" || value === "exam" ? "sprint" : "quiz";
}

export default function PracticeWorkspace({ initialAiOpen = false, initialAiTask, initialMode }: PracticeWorkspaceProps) {
  const client = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>(() => modeFromParam(initialMode));
  const [creatorOpen, setCreatorOpen] = useState(initialAiOpen || !!initialAiTask);
  const [outline, setOutline] = useState<LessonOutline | null>(null);
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("");
  const [sourceId, setSourceId] = useState("local-practice");
  const [sourceType, setSourceType] = useState("local");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardRatings, setCardRatings] = useState<Record<number, boolean>>({});
  const [flipped, setFlipped] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<PracticeAttemptSummary | null>(null);
  const [reviews, setReviews] = useState<PracticeReviewCardRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  const cards = useMemo(() => outline ? deriveFlashcards(outline) : [], [outline]);
  const flashcardItems: PracticeItem[] = cards.map((card, index) => ({ id: `flashcard-${index + 1}`, prompt: card.front, answer: card.back, response: cardRatings[index] === undefined ? undefined : cardRatings[index] ? card.back : "", points: 1 }));
  const activeItems = mode === "flashcards" ? flashcardItems : items;
  const targetSeconds = mode === "sprint" ? 300 : null;
  const liveSummary = summarizePracticeAttempt({ mode, items: activeItems, elapsedSeconds: elapsed, targetSeconds });

  useEffect(() => {
    let active = true;
    client.from("lessons").select("id,title").eq("status", "published").limit(50).then(({ data }) => { if (active) setLessons((data ?? []) as LessonOption[]); });
    listPracticeReviews().then((data) => { if (active) setReviews(data ?? []); }).catch(() => undefined);
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const next = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(mode === "sprint" ? Math.min(300, next) : next);
      if (mode === "sprint" && next >= 300) setRunning(false);
    }, 500);
    return () => window.clearInterval(timer);
  }, [running, mode]);

  const applyOutline = (next: LessonOutline, lessonId?: string) => {
    setOutline(next);
    setItems(derivePracticeItems(next).map((item) => ({ ...item, response: undefined })));
    setCardIndex(0);
    setCardRatings({});
    setFlipped(false);
    setSummary(null);
    setElapsed(0);
    setRunning(false);
    setSourceType(lessonId ? "lesson" : "local");
    setSourceId(lessonId || "local-practice");
    setCreatorOpen(false);
    setError("");
  };

  const loadLesson = async (lessonId: string) => {
    setSelectedLesson(lessonId);
    if (!lessonId) return;
    setPending(true);
    setError("");
    try {
      const [lessonResult, sectionsResult] = await Promise.all([
        client.from("lessons").select("id,title").eq("id", lessonId).single(),
        client.from("lesson_sections").select("title,content").eq("lesson_id", lessonId).order("order_index"),
      ]);
      if (lessonResult.error || sectionsResult.error || !lessonResult.data) throw new Error("This lesson is unavailable.");
      const lesson = lessonResult.data as LessonOption;
      const sections = (sectionsResult.data ?? []) as Pick<LessonSection, "title" | "content">[];
      const source = `${lesson.title}\n\n${sections.map((section) => `## ${section.title}\n${section.content || ""}`).join("\n\n")}`;
      applyOutline(outlineFromText(source, { title: lesson.title }), lessonId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this lesson.");
    } finally {
      setPending(false);
    }
  };

  const answer = (itemId: string, value: string | boolean) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, response: value } : item));
    setSummary(null);
  };

  const start = () => {
    startedAt.current = Date.now() - elapsed * 1000;
    setRunning(true);
  };

  const submit = async (submittedItems = activeItems) => {
    if (!submittedItems.length) return;
    setRunning(false);
    setSummary(summarizePracticeAttempt({ mode, items: submittedItems, elapsedSeconds: elapsed, targetSeconds }));
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/practice/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sourceType, sourceId, items: submittedItems, elapsedSeconds: elapsed, targetSeconds }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Attempt could not be saved.");
      setReviews(await listPracticeReviews() ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Attempt could not be saved.");
    } finally {
      setPending(false);
    }
  };

  const retry = () => {
    if (mode === "flashcards") {
      setCardRatings({});
      setCardIndex(0);
    } else {
      setItems(missedPracticeItems(items).map((item) => ({ ...item, response: undefined })));
    }
    setSummary(null);
    setElapsed(0);
    setRunning(false);
  };

  const gradeFlashcard = (known: boolean) => {
    const card = cards[cardIndex];
    if (!card) return;
    setCardRatings((current) => ({ ...current, [cardIndex]: known }));
    setFlipped(false);
    setCardIndex((index) => Math.min(cards.length - 1, index + 1));
  };

  return <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 text-edsync-text sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-edsync-blue">Learn by doing</p><h1 className="font-display text-2xl font-bold">Practice</h1></div><button type="button" className="btn-secondary" onClick={() => setCreatorOpen((open) => !open)}><Sparkles className="h-4 w-4" />Create practice</button></header>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px]"><div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Practice mode">{([ ["quiz", BookOpen], ["flashcards", Layers3], ["sprint", Zap] ] as const).map(([value, Icon]) => <button key={value} type="button" role="tab" aria-selected={mode === value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${mode === value ? "border-edsync-blue bg-edsync-blue/10 text-edsync-blue" : "border-edsync-border bg-edsync-card text-edsync-subtle"}`} onClick={() => { setMode(value); setSummary(null); setElapsed(0); setRunning(false); }}><Icon className="h-4 w-4" />{value}</button>)}</div>
      {creatorOpen && <section className="rounded-2xl border border-edsync-border bg-edsync-card p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">From a topic, notes, or file</h2><button type="button" className="text-xs text-edsync-subtle" onClick={() => setCreatorOpen(false)}>Close</button></div><OutlineComposer useLabel="Use for practice" compact onUse={(next) => applyOutline(next)} /></section>}
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-edsync-border bg-edsync-card p-3"><label className="min-w-0 flex-1 text-xs text-edsync-subtle">Or use a lesson<select aria-label="Choose lesson" className="edsync-input mt-1 w-full" value={selectedLesson} onChange={(event) => void loadLesson(event.target.value)}><option value="">Choose an accessible lesson</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>{outline && <span className="max-w-44 truncate text-xs text-edsync-subtle">{outline.title}</span>}</section>
      {!outline && !creatorOpen && <div className="rounded-2xl border border-dashed border-edsync-border bg-edsync-card p-8 text-center"><Sparkles className="mx-auto mb-3 h-8 w-8 text-edsync-blue" /><h2 className="font-semibold">Start with something to learn</h2><p className="mt-1 text-sm text-edsync-subtle">Choose a lesson or create practice from a topic.</p></div>}
      {outline && mode !== "flashcards" && <div className="space-y-2">{items.length === 0 ? <p className="rounded-xl border border-edsync-border bg-edsync-card p-4 text-sm text-edsync-subtle">No answerable questions yet. Add notes with facts or generate a richer topic outline.</p> : items.map((item, index) => <section key={item.id} className="rounded-xl border border-edsync-border bg-edsync-card p-4"><div className="mb-2 flex justify-between text-xs text-edsync-subtle"><span>Question {index + 1}</span><span>{item.points ?? 1} point</span></div><h2 className="font-semibold">{item.prompt}</h2>{typeof item.answer === "boolean" ? <div className="mt-3 flex gap-2">{[true, false].map((value) => <button key={String(value)} type="button" onClick={() => answer(item.id, value)} className={`btn-secondary ${item.response === value ? "border-edsync-blue text-edsync-blue" : ""}`}>{value ? "True" : "False"}</button>)}</div> : "choices" in item && Array.isArray(item.choices) && item.choices.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{item.choices.map((choice) => <button key={choice} type="button" className={`rounded-lg border p-2 text-left text-sm ${item.response === choice ? "border-edsync-blue bg-edsync-blue/10" : "border-edsync-border"}`} onClick={() => answer(item.id, choice)}>{choice}</button>)}</div> : <input className="edsync-input mt-3 w-full" aria-label={`Answer question ${index + 1}`} value={typeof item.response === "string" ? item.response : ""} onChange={(event) => answer(item.id, event.target.value)} placeholder="Your answer" />}{summary && <p className={`mt-3 text-sm ${isPracticeItemCorrect(item) ? "text-edsync-emerald" : "text-edsync-red"}`}>{isPracticeItemCorrect(item) ? "Correct" : `Review: ${Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer)}`}{item.explanation ? ` · ${item.explanation}` : ""}</p>}</section>)}</div>}
      {outline && mode === "flashcards" && (cards.length ? <section className="space-y-3 rounded-2xl border border-edsync-border bg-edsync-card p-4"><div className="flex justify-between text-xs text-edsync-subtle"><span>Card {cardIndex + 1} of {cards.length}</span><span>{flipped ? "Answer" : "Prompt"}</span></div><button type="button" className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl bg-edsync-surface p-6 text-center" onClick={() => setFlipped((value) => !value)}><span className="font-display text-xl font-semibold">{flipped ? cards[cardIndex]?.back : cards[cardIndex]?.front}</span><span className="mt-3 text-xs text-edsync-subtle">Tap to flip</span></button><div className="flex justify-between gap-2"><button type="button" className="btn-secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex((index) => index - 1); setFlipped(false); }}><ChevronLeft className="h-4 w-4" />Previous</button><button type="button" className="btn-secondary" onClick={() => gradeFlashcard(false)}>Again</button><button type="button" className="btn-primary" onClick={() => gradeFlashcard(true)}><Check className="h-4 w-4" />Know it</button><button type="button" className="btn-secondary" disabled={cardIndex >= cards.length - 1} onClick={() => { setCardIndex((index) => index + 1); setFlipped(false); }}><ChevronRight className="h-4 w-4" />Next</button></div></section> : <p className="rounded-xl border border-edsync-border bg-edsync-card p-4 text-sm text-edsync-subtle">No flashcards yet. Add terms or questions to your source.</p>)}
      {outline && <div className="flex flex-wrap items-center gap-2"><button type="button" className="btn-primary" disabled={pending || !activeItems.length} onClick={() => void submit()}>{pending ? "Saving…" : "Finish & save"}</button>{summary && summary.missedItems > 0 && <button type="button" className="btn-secondary" onClick={retry}><RotateCcw className="h-4 w-4" />Retry missed</button>}{mode === "sprint" && <button type="button" className="btn-secondary" onClick={() => running ? setRunning(false) : start()}><Clock3 className="h-4 w-4" />{running ? "Pause" : elapsed ? "Resume" : "Start timer"}</button>}</div>}
      {error && <p role="alert" className="rounded-xl bg-edsync-red/10 p-3 text-sm text-edsync-red">{error}</p>}
    </div><aside className="space-y-3"><section className="rounded-xl border border-edsync-border bg-edsync-card p-4"><h2 className="text-sm font-semibold">Progress</h2><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-edsync-subtle">Answered</p><p className="font-display text-xl font-bold">{activeItems.filter((item) => item.response !== undefined).length}/{activeItems.length}</p></div><div><p className="text-xs text-edsync-subtle">Time</p><p className="font-display text-xl font-bold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</p></div></div>{summary && <div className="mt-3 rounded-lg bg-edsync-blue/10 p-3 text-sm"><p className="font-bold">{summary.percent}% score</p><p>{summary.correctItems} correct · {summary.missedItems} to retry</p></div>}{!summary && activeItems.length > 0 && <p className="mt-3 text-xs text-edsync-subtle">Current answers: {liveSummary.correctItems} correct</p>}</section><section className="rounded-xl border border-edsync-border bg-edsync-card p-4"><h2 className="text-sm font-semibold">Review queue</h2><p className="mt-1 text-xs text-edsync-subtle">Missed answers become review cards.</p><div className="mt-3 space-y-2">{reviews.length ? reviews.slice(0, 3).map((review) => <div key={review.id} className="rounded-lg bg-edsync-surface p-2 text-xs"><p className="line-clamp-2 font-medium">{review.prompt}</p><p className="mt-1 capitalize text-edsync-subtle">{review.mastery}</p></div>) : <p className="text-xs text-edsync-subtle">Nothing to review yet.</p>}</div></section></aside></div>
  </main>;
}
