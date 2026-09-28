"use client";

import { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import type { Lesson } from "@/types";

type ExtraQuestion = { question: string; options: { text: string; is_correct: boolean }[] };
type ExtraLesson = { topic: string; content: string; quiz: ExtraQuestion[] };

function isExtraQuestion(value: unknown): value is ExtraQuestion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ExtraQuestion>;
  return typeof item.question === "string" && Array.isArray(item.options) && item.options.length >= 2 &&
    item.options.every((option) => typeof option?.text === "string" && typeof option?.is_correct === "boolean");
}

function parseExtra(text: string): ExtraLesson {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The tutor returned an unexpected format. Try again.");
  const value: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!value || typeof value !== "object") throw new Error("The tutor returned an unexpected format. Try again.");
  const item = value as Partial<ExtraLesson>;
  if (typeof item.topic !== "string" || typeof item.content !== "string") throw new Error("The tutor returned an incomplete lesson. Try again.");
  return { topic: item.topic, content: item.content, quiz: Array.isArray(item.quiz) ? item.quiz.filter(isExtraQuestion) : [] };
}

export default function ExtendedTool({ lesson, missedPrompts }: { lesson: Lesson; missedPrompts: string[] }) {
  const [extra, setExtra] = useState<ExtraLesson | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/socratic", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Suggest one related topic for this lesson, write a short explanation, then three multiple-choice practice questions. Return only JSON: {"topic":string,"content":string,"quiz":[{"question":string,"options":[{"text":string,"is_correct":boolean}]}]}. ${missedPrompts.length ? `Focus on these missed questions: ${missedPrompts.join("; ").slice(0, 1000)}.` : "Build on the lesson objectives."}`,
          lessonTitle: lesson.title,
          lessonObjectives: lesson.objectives,
          conversationHistory: [],
        }),
      });
      const payload = await response.json().catch(() => null) as { hint?: unknown; error?: string | { message?: string } } | null;
      if (!response.ok || typeof payload?.hint !== "string") {
        const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
        throw new Error(message || "Extended learning is unavailable. Try again.");
      }
      setExtra(parseExtra(payload.hint));
      setAnswers({});
      setSubmitted(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Extended learning is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {!extra && <p className="text-fg-muted">Explore a related idea and try a short practice set.</p>}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">{error}</p>}
      <Button icon={extra ? RotateCcw : Sparkles} variant={extra ? "secondary" : "primary"} loading={busy} onClick={() => void generate()}>{extra ? "Regenerate" : "Generate"}</Button>
      {extra && (
        <div className="space-y-5 border-t border-line pt-4">
          <div><h3 className="mb-2 text-base font-semibold text-fg">{extra.topic}</h3><p className="whitespace-pre-line leading-6 text-fg-muted">{extra.content}</p></div>
          {extra.quiz.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-fg">Practice check</h3>
              {extra.quiz.map((question, index) => (
                <fieldset key={`${question.question}-${index}`} className="rounded-lg border border-line p-3">
                  <legend className="px-1 font-medium text-fg">{question.question}</legend>
                  <div className="mt-2 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={`${option.text}-${optionIndex}`} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 ${submitted && option.is_correct ? "bg-success-soft" : "hover:bg-surface-2"}`}>
                        <input type="radio" name={`extra-${index}`} checked={answers[index] === optionIndex} disabled={submitted} onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} className="accent-accent" />{option.text}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {submitted ? <p role="status" className="rounded-lg bg-surface-2 p-3 font-medium text-fg">{extra.quiz.filter((question, index) => question.options[answers[index]]?.is_correct).length} of {extra.quiz.length} correct</p> :
                <Button variant="primary" disabled={extra.quiz.some((_, index) => answers[index] === undefined)} onClick={() => setSubmitted(true)}>Check practice</Button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
