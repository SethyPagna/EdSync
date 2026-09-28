"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import type { Lesson, LessonSection } from "@/types";

type Advice = {
  strengths: string[];
  likelyGaps: string[];
  nextSteps: string[];
  guidingQuestion: string;
  encouragement: string;
};

function textOf(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Coaching is unavailable. Try again.";
}

export default function ReflectionTool({ lesson, sections, section }: { lesson: Lesson; sections: LessonSection[]; section: LessonSection | undefined }) {
  const [reflection, setReflection] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const coach = async () => {
    if (!reflection.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/reflection-coach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reflection: reflection.trim(),
          confidence,
          lessonTitle: lesson.title,
          lessonObjectives: lesson.objectives,
          currentSection: section?.title ?? "Whole lesson",
          lectureContext: sections.map((item) => `${item.title}: ${textOf(item.content || "")}`).join("\n\n").slice(0, 7000),
        }),
      });
      const payload = await response.json().catch(() => null) as { advice?: Advice; error?: unknown } | null;
      if (!response.ok || !payload?.advice) throw new Error(errorMessage(payload?.error));
      setAdvice(payload.advice);
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        const { error: saveError } = await client.from("learning_reflections").insert({
          student_id: user.id,
          lesson_id: lesson.id,
          confidence,
          reflection: reflection.trim(),
          ai_feedback: payload.advice.encouragement,
          next_step: payload.advice.nextSteps[0] ?? payload.advice.guidingQuestion,
        });
        if (saveError) setError("Coaching is ready, but your reflection was not saved.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Coaching is unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <label htmlFor="reflection-text" className="block text-sm font-medium text-fg">What did you learn?</label>
      <textarea id="reflection-text" className="textarea min-h-28 w-full" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="A concept that clicked, or something still unclear" />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Confidence</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={`flex size-9 cursor-pointer items-center justify-center rounded-lg border text-sm ${confidence === value ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted"}`}>
              <input type="radio" className="sr-only" name="confidence" value={value} checked={confidence === value} onChange={() => setConfidence(value)} />{value}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <Button icon={Sparkles} variant="primary" loading={busy} disabled={!reflection.trim()} onClick={() => void coach()}>Get coaching</Button>
      {advice && (
        <div className="space-y-4 border-t border-line pt-4 text-sm">
          <p className="text-fg">{advice.encouragement}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-success-soft p-3"><h3 className="mb-1 font-medium text-fg">Strengths</h3><ul className="list-inside list-disc text-fg-muted">{advice.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div className="rounded-lg bg-warning-soft p-3"><h3 className="mb-1 font-medium text-fg">Revisit</h3><ul className="list-inside list-disc text-fg-muted">{advice.likelyGaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
          <div><h3 className="mb-1 font-medium text-fg">Next steps</h3><ul className="list-inside list-disc text-fg-muted">{advice.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <p className="rounded-lg bg-accent-soft p-3 text-fg">{advice.guidingQuestion}</p>
        </div>
      )}
    </div>
  );
}
