"use client";

import type { QuizQuestion } from "@/types";

export type QType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "long_answer";

export interface QDraft {
  id?: string;
  clientKey: string;
  question_text: string;
  question_type: QType;
  options: { id: string; text: string; is_correct: boolean }[];
  correct_answer: string;
  explanation: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  points: number;
  is_diagnostic: boolean;
  is_micro_check: boolean;
  is_final_quiz: boolean;
  section_id?: string | null;
}

export const emptyQ = (overrides: Partial<QDraft> = {}): QDraft => ({
  clientKey: crypto.randomUUID(),
  question_text: "",
  question_type: "multiple_choice",
  options: [
    { id: "a", text: "", is_correct: false },
    { id: "b", text: "", is_correct: false },
    { id: "c", text: "", is_correct: false },
    { id: "d", text: "", is_correct: false },
  ],
  correct_answer: "",
  explanation: "",
  difficulty: "intermediate",
  points: 1,
  is_diagnostic: false,
  is_micro_check: true,
  is_final_quiz: false,
  ...overrides,
});

export function toQuestionDraft(question: QuizQuestion): QDraft {
  return {
    ...question,
    clientKey: question.id,
    question_type: question.question_type === "matching" ? "multiple_choice" : question.question_type,
    options: question.options || emptyQ().options,
    correct_answer: question.correct_answer || "",
    explanation: question.explanation || "",
  };
}

export function QuestionBuilder({
  q,
  onChange,
  onDelete,
}: {
  q: QDraft;
  onChange: (q: QDraft) => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<QDraft>) => onChange({ ...q, ...patch });

  const setOption = (
    idx: number,
    field: "text" | "is_correct",
    val: string | boolean,
  ) => {
    const opts = q.options.map((o, i) =>
      i === idx
        ? { ...o, [field]: val }
        : field === "is_correct" && val
          ? { ...o, is_correct: false }
          : o,
    );
    set({ options: opts });
  };

  const typeLabel: Record<QType, string> = {
    multiple_choice: " Multiple Choice",
    true_false: " True / False",
    fill_blank: " Fill Blank",
    short_answer: " Short Answer",
    long_answer: " Long Answer",
  };

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={q.question_type}
          onChange={(e) => {
            const t = e.target.value as QType;
            const opts =
              t === "true_false"
                ? [
                    { id: "true", text: "True", is_correct: false },
                    { id: "false", text: "False", is_correct: false },
                  ]
                : q.question_type === "multiple_choice"
                  ? q.options
                  : [
                      { id: "a", text: "", is_correct: false },
                      { id: "b", text: "", is_correct: false },
                      { id: "c", text: "", is_correct: false },
                      { id: "d", text: "", is_correct: false },
                    ];
            set({ question_type: t, options: opts });
          }}
          className="edsync-input py-1.5 text-sm w-52"
        >
          {(Object.keys(typeLabel) as QType[]).map((k) => (
            <option key={k} value={k}>
              {typeLabel[k]}
            </option>
          ))}
        </select>

        <select
          value={q.difficulty}
          onChange={(e) =>
            set({ difficulty: e.target.value as QDraft["difficulty"] })
          }
          className="edsync-input py-1.5 text-sm w-36"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-fg-muted">Purpose
          <select
            className="select w-auto"
            value={q.is_diagnostic ? "diagnostic" : q.is_final_quiz ? "final" : q.is_micro_check ? "check" : "practice"}
            onChange={(event) => set({
              is_diagnostic: event.target.value === "diagnostic",
              is_micro_check: event.target.value === "check",
              is_final_quiz: event.target.value === "final",
            })}
          >
            <option value="diagnostic">Pre-check</option>
            <option value="check" disabled={!q.section_id && !q.is_micro_check}>Section check</option>
            <option value="final">Final quiz</option>
            <option value="practice">Practice</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-fg-muted">Points
          <input type="number" min={1} max={100} className="input w-20" value={q.points} onChange={(event) => set({ points: Number(event.target.value) })} />
        </label>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete question"
          className="text-edsync-subtle hover:text-edsync-red text-lg leading-none ml-2"
        >
          ×
        </button>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Question *
        </label>
        <textarea
          value={q.question_text}
          onChange={(e) => set({ question_text: e.target.value })}
          rows={2}
          className="edsync-textarea text-sm"
          placeholder="Enter your question..."
        />
      </div>

      {/* MC / T-F options */}
      {(q.question_type === "multiple_choice" ||
        q.question_type === "true_false") && (
        <div>
          <label className="block text-xs text-edsync-subtle mb-2">
            Options —{" "}
            {q.question_type === "true_false"
              ? "mark the correct one"
              : "mark correct answer(s)"}
          </label>
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`q-correct-${q.clientKey}`}
                  checked={opt.is_correct}
                  onChange={() => setOption(i, "is_correct", true)}
                  className="flex-shrink-0 accent-edsync-emerald"
                  title="Mark as correct"
                />
                {q.question_type === "true_false" ? (
                  <span
                    className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium ${opt.is_correct ? "border-edsync-emerald/50 bg-edsync-emerald/10 text-edsync-emerald" : "border-edsync-border text-edsync-subtle"}`}
                  >
                    {opt.text}
                  </span>
                ) : (
                  <input
                    value={opt.text}
                    onChange={(e) => setOption(i, "text", e.target.value)}
                    className={`edsync-input py-2 flex-1 text-sm ${opt.is_correct ? "border-edsync-emerald/50 bg-edsync-emerald/5" : ""}`}
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                  />
                )}
                {q.question_type === "multiple_choice" &&
                  q.options.length > 2 && (
                    <button
                      onClick={() =>
                        set({ options: q.options.filter((_, j) => j !== i) })
                      }
                      className="text-edsync-subtle hover:text-edsync-red text-sm"
                    >
                      ×
                    </button>
                  )}
              </div>
            ))}
            {q.question_type === "multiple_choice" && q.options.length < 6 && (
              <button
                onClick={() =>
                  set({
                    options: [
                      ...q.options,
                      {
                        id: ["a", "b", "c", "d", "e", "f"].find((id) => !q.options.some((option) => option.id === id)) || crypto.randomUUID(),
                        text: "",
                        is_correct: false,
                      },
                    ],
                  })
                }
                className="text-edsync-blue text-xs hover:underline"
              >
                + Add option
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fill blank */}
      {q.question_type === "fill_blank" && (
        <div>
          <label className="block text-xs text-edsync-subtle mb-1">
            Correct Answer (exact match, case-insensitive)
          </label>
          <input
            value={q.correct_answer}
            onChange={(e) => set({ correct_answer: e.target.value })}
            className="edsync-input py-2 text-sm"
            placeholder="e.g. photosynthesis"
          />
          <p className="text-xs text-edsync-subtle mt-1">
            Tip: use underscores in question text for blank: "Plants use ___ to
            make food"
          </p>
        </div>
      )}

      {/* Short / Long answer */}
      {(q.question_type === "short_answer" ||
        q.question_type === "long_answer") && (
        <div>
          <label className="block text-xs text-edsync-subtle mb-1">
            {q.question_type === "short_answer"
              ? "Expected Answer / Key Points"
              : "Rubric / Grading Criteria"}
          </label>
          <textarea
            value={q.correct_answer}
            onChange={(e) => set({ correct_answer: e.target.value })}
            rows={q.question_type === "long_answer" ? 4 : 2}
            className="edsync-textarea text-sm"
            placeholder={
              q.question_type === "short_answer"
                ? "Key points students should mention..."
                : "Criteria for a strong response..."
            }
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Explanation (shown after learner answers)
        </label>
        <textarea
          value={q.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          rows={2}
          className="edsync-textarea text-sm"
          placeholder="Why is this the correct answer?"
        />
      </div>
    </div>
  );
}

