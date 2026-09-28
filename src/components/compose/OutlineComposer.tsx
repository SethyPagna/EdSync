"use client";

import { useState } from "react";
import type { LessonOutline } from "@/lib/compose/types";
import { requestOutline, type OutlineSource } from "./api";

export type OutlineComposerProps = {
  /** Label for the primary action, e.g. "Design slides" or "Create course". */
  useLabel: string;
  onUse: (outline: LessonOutline, source: OutlineSource) => void | Promise<void>;
  initialTopic?: string;
  initialText?: string;
  defaultMode?: "topic" | "notes";
  busy?: boolean;
  compact?: boolean;
};

export default function OutlineComposer({
  useLabel,
  onUse,
  initialTopic = "",
  initialText = "",
  defaultMode = "topic",
  busy = false,
}: OutlineComposerProps) {
  const [mode, setMode] = useState(defaultMode);
  const [topic, setTopic] = useState(initialTopic);
  const [text, setText] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await requestOutline({
        topic: topic.trim() || text.trim().split("\n")[0] || "Untitled",
        sourceText: mode === "notes" ? text : undefined,
        mode: mode === "notes" ? "local" : "auto",
      });
      await onUse(result.outline, result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build an outline");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="segmented" role="radiogroup" aria-label="Source">
        {(["topic", "notes"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            data-active={mode === value}
            className="segmented-item"
            onClick={() => setMode(value)}
          >
            {value === "topic" ? "Topic" : "Notes"}
          </button>
        ))}
      </div>
      <input
        className="input"
        aria-label="Topic"
        placeholder="Topic"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
      />
      {mode === "notes" ? (
        <textarea
          className="textarea min-h-40"
          aria-label="Notes"
          placeholder="Paste notes"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || busy || (!topic.trim() && !text.trim())}
        onClick={submit}
      >
        {pending ? "Working…" : useLabel}
      </button>
    </div>
  );
}
