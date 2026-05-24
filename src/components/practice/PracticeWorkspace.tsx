"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Flame,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Trophy,
  Trash2,
  XCircle,
} from "lucide-react";
import AiPromptBuilder from "@/components/ai/AiPromptBuilder";
import { AI_PROMPT_CONTRACTS, PRACTICE_MODES } from "@/lib/studio/catalog";
import {
  missedPracticeItems,
  summarizePracticeAttempt,
  targetSecondsFromMinutes,
  type PracticeItem,
} from "@/lib/practice/engine";
import { normalizePracticeMode } from "@/lib/practice/modes";
import {
  deletePracticeReview,
  listPracticeReviews,
  updatePracticeReview,
  type PracticeReviewCardRow,
} from "@/lib/practice/reviews";
import type { PracticeAttemptSummary, PracticeMode } from "@/types";

type PracticeWorkspaceProps = {
  initialAiOpen?: boolean;
  initialAiTask?: string;
  initialMode?: PracticeMode;
};

const starterItems: PracticeItem[] = [
  {
    id: "item-1",
    prompt: "What is the first step in an effective learning loop?",
    answer: "import",
    explanation: "Start by importing or writing source content so EdSync can turn it into lesson, practice, and review material.",
    points: 2,
  },
  {
    id: "item-2",
    prompt: "True or false: missed answers should become review cards.",
    answer: true,
    explanation: "Mistakes are useful when they become targeted review prompts.",
    points: 1,
  },
  {
    id: "item-3",
    prompt: "Name one EdSync source that can generate practice.",
    answer: "notes",
    explanation: "Notes, docs, sheets, slides, and lesson sections can all feed generated practice.",
    points: 2,
  },
];

export default function PracticeWorkspace({ initialAiOpen = false, initialAiTask, initialMode }: PracticeWorkspaceProps) {
  const [mode, setMode] = useState<PracticeMode>(normalizePracticeMode(initialMode));
  const [aiOpen, setAiOpen] = useState(initialAiOpen);
  const [items, setItems] = useState<PracticeItem[]>(starterItems);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(() => normalizePracticeMode(initialMode) === "exam" ? 30 : 8);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<PracticeAttemptSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewCards, setReviewCards] = useState<PracticeReviewCardRow[]>([]);
  const startedRef = useRef<number | null>(null);

  const modeConfig = useMemo(
    () => PRACTICE_MODES.find((entry) => entry.mode === mode) ?? PRACTICE_MODES[0],
    [mode],
  );
  const targetSeconds = targetSecondsFromMinutes(targetMinutes || modeConfig.targetMinutes);
  const liveSummary = summarizePracticeAttempt({ mode, items, elapsedSeconds, targetSeconds });
  const missed = missedPracticeItems(items);

  useEffect(() => {
    if (!running) return;
    startedRef.current = Date.now() - elapsedSeconds * 1000;
    const timer = window.setInterval(() => {
      if (startedRef.current) setElapsedSeconds(Math.floor((Date.now() - startedRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [elapsedSeconds, running]);

  useEffect(() => {
    listPracticeReviews()
      .then((cards) => setReviewCards(cards ?? []))
      .catch(() => setReviewCards([]));
  }, []);

  const updateResponse = (itemId: string, response: string | boolean) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, response } : item)),
    );
    setSummary(null);
    setSaveError(null);
  };

  const submit = async () => {
    const nextSummary = summarizePracticeAttempt({ mode, items, elapsedSeconds, targetSeconds });
    setSummary(nextSummary);
    setRunning(false);
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/practice/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          sourceType: "studio",
          sourceId: "local-practice",
          elapsedSeconds,
          targetSeconds,
          items,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Attempt could not be saved.");
      const cards = await listPracticeReviews();
      setReviewCards(cards ?? []);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Attempt could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const retryMissed = () => {
    setItems(missed.map((item) => ({ ...item, response: undefined })));
    setSummary(null);
    setSaveError(null);
    setElapsedSeconds(0);
    setRunning(true);
  };

  const restart = () => {
    setItems(starterItems.map((item) => ({ ...item, response: undefined })));
    setElapsedSeconds(0);
    setSummary(null);
    setSaveError(null);
    setRunning(false);
  };

  const updateReviewMastery = async (id: string, mastery: "again" | "almost" | "mastered") => {
    await updatePracticeReview({ id, mastery });
    setReviewCards((current) => current.map((card) => (card.id === id ? { ...card, mastery } : card)));
  };

  const removeReviewCard = async (id: string) => {
    await deletePracticeReview(id);
    setReviewCards((current) => current.filter((card) => card.id !== id));
  };

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-edsync-border bg-edsync-card p-5">
              <p className="text-sm font-semibold text-edsync-blue">Practice, quizzes, and games</p>
              <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h1 className="font-display text-4xl font-bold">Practice + AI Tutor</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
                    Timed practice with explanations, retry missed, saved mistakes, and review recommendations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setRunning((value) => !value)} className="btn-primary px-3 py-2 text-sm">
                    {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {running ? "Pause" : "Start"}
                  </button>
                  <button type="button" onClick={restart} className="btn-secondary px-3 py-2 text-sm">
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </button>
                  <button type="button" onClick={submit} className="btn-secondary px-3 py-2 text-sm">
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Submit"}
                  </button>
                  <button type="button" onClick={() => setAiOpen((value) => !value)} className="btn-secondary px-3 py-2 text-sm">
                    <Sparkles className="h-4 w-4" />
                    {aiOpen ? "Hide AI" : "AI Tutor"}
                  </button>
                </div>
              </div>
            </div>

            {aiOpen && (
              <section className="rounded-xl border border-edsync-blue/25 bg-edsync-card p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-edsync-blue">Practice + AI</p>
                    <h2 className="mt-1 font-display text-2xl font-bold">Generate, explain, and insert learning support</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-edsync-subtle">
                      Use AI to clean source notes, generate practice, create review cards, and send the result back into the learning loop.
                    </p>
                  </div>
                  <button type="button" onClick={() => setAiOpen(false)} className="btn-ghost px-3 py-2 text-sm">
                    Close
                  </button>
                </div>
                <AiPromptBuilder contracts={AI_PROMPT_CONTRACTS} initialTask={initialAiTask ?? "generate-practice"} />
              </section>
            )}

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              {PRACTICE_MODES.map((entry) => (
                <button
                  key={entry.mode}
                  type="button"
                  onClick={() => {
                    setMode(entry.mode);
                    setTargetMinutes(entry.targetMinutes);
                    setSummary(null);
                    setSaveError(null);
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    mode === entry.mode
                      ? "border-edsync-blue bg-edsync-blue/10 text-edsync-text"
                      : "border-edsync-border bg-edsync-card text-edsync-subtle hover:border-edsync-blue/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{entry.label}</p>
                    <span className="rounded-full bg-edsync-surface px-2 py-0.5 text-[11px] font-bold text-edsync-subtle">
                      {entry.targetMinutes}m
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs">{entry.description}</p>
                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-edsync-blue">
                    {entry.loop.join(" -> ")}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <section key={item.id} className="rounded-lg border border-edsync-border bg-edsync-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-edsync-subtle">Question {index + 1}</p>
                    <span className="rounded-full bg-edsync-blue/10 px-2 py-1 text-xs font-semibold text-edsync-blue">
                      {item.points ?? 1} pts
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold">{item.prompt}</h2>
                  {typeof item.answer === "boolean" ? (
                    <div className="mt-4 flex gap-2">
                      {[true, false].map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => updateResponse(item.id, value)}
                          className={`btn-secondary px-4 py-2 ${item.response === value ? "border-edsync-blue text-edsync-blue" : ""}`}
                        >
                          {value ? "True" : "False"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="edsync-input mt-4"
                      value={typeof item.response === "string" ? item.response : ""}
                      onChange={(event) => updateResponse(item.id, event.target.value)}
                      placeholder="Type your answer"
                    />
                  )}
                  {summary && (
                    <div className={`mt-4 rounded-lg border p-3 text-sm ${
                      summary.reviewCardIds.includes(item.id)
                        ? "border-edsync-amber/30 bg-edsync-amber/10 text-edsync-amber"
                        : "border-edsync-emerald/30 bg-edsync-emerald/10 text-edsync-emerald"
                    }`}>
                      <div className="flex items-start gap-2">
                        {summary.reviewCardIds.includes(item.id) ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        <p>{item.explanation}</p>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-edsync-blue" />
                <h2 className="font-semibold">Timing</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Target" value={`${Math.round(targetSeconds / 60)}m`} />
                <Metric label="Elapsed" value={`${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`} />
              </div>
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-edsync-subtle">Target minutes</span>
                <input
                  className="edsync-input mt-2"
                  type="number"
                  min={1}
                  max={180}
                  value={targetMinutes}
                  onChange={(event) => setTargetMinutes(Math.max(1, Number(event.target.value || 1)))}
                />
              </label>
              <div className="mt-4 rounded-lg border border-edsync-border bg-edsync-surface p-3 text-xs leading-5 text-edsync-subtle">
                <p className="font-semibold text-edsync-text">{modeConfig.bestFor}</p>
                <p className="mt-1">{modeConfig.output}</p>
              </div>
            </section>

            <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-edsync-amber" />
                <h2 className="font-semibold">Attempt Summary</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Score" value={`${liveSummary.percent}%`} />
                <Metric label="Correct" value={`${liveSummary.correctItems}/${liveSummary.totalItems}`} />
                <Metric label="Missed" value={String(liveSummary.missedItems)} />
                <Metric label="Points" value={`${liveSummary.pointsEarned}/${liveSummary.pointsPossible}`} />
              </div>
              <button type="button" onClick={retryMissed} disabled={missed.length === 0} className="btn-primary mt-4 w-full justify-center py-2 text-sm disabled:opacity-50">
                <Flame className="h-4 w-4" />
                Retry missed
              </button>
              {summary && !saveError && (
                <p className="mt-3 rounded-lg border border-edsync-emerald/30 bg-edsync-emerald/10 p-2 text-xs font-semibold text-edsync-emerald">
                  Attempt saved and missed items queued for review.
                </p>
              )}
              {saveError && (
                <p className="mt-3 rounded-lg border border-edsync-red/30 bg-edsync-red/10 p-2 text-xs font-semibold text-edsync-red">
                  {saveError}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-edsync-blue" />
                <h2 className="font-semibold">Learning Loop</h2>
              </div>
              <div className="space-y-2 text-sm text-edsync-subtle">
                {modeConfig.loop.map((step, index) => (
                  <div key={step} className="flex items-center gap-2 rounded-lg border border-edsync-border bg-edsync-surface p-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-edsync-blue/10 text-xs font-bold text-edsync-blue">{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-edsync-border bg-edsync-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-edsync-emerald" />
                <h2 className="font-semibold">Reviews</h2>
              </div>
              <div className="space-y-2">
                {reviewCards.length === 0 && (
                  <p className="text-sm leading-6 text-edsync-subtle">
                    Missed items become review cards after submit. The dashboard can recommend the next retry set from those cards.
                  </p>
                )}
                {reviewCards.slice(0, 5).map((card) => (
                  <div key={card.id} className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold">{card.prompt}</p>
                      {card.mode_label && (
                        <span className="rounded-full bg-edsync-blue/10 px-2 py-0.5 text-[11px] font-bold text-edsync-blue">
                          {card.mode_label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs capitalize text-edsync-subtle">{card.mastery}</p>
                    {card.loop.length > 0 && (
                      <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-edsync-blue">
                        {card.loop.join(" -> ")}
                      </p>
                    )}
                    {card.next_action && (
                      <p className="mt-1 line-clamp-2 text-xs text-edsync-subtle">{card.next_action}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => updateReviewMastery(card.id, "again")}>
                        Again
                      </button>
                      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => updateReviewMastery(card.id, "almost")}>
                        Almost
                      </button>
                      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => updateReviewMastery(card.id, "mastered")}>
                        Mastered
                      </button>
                      <button type="button" className="rounded-lg p-1 text-edsync-red hover:bg-edsync-red/10" onClick={() => removeReviewCard(card.id)} aria-label="Delete review card">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
      <p className="text-xs text-edsync-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
