"use client";

import { Check, CircleHelp, Clock3, X } from "lucide-react";
import type { PlayerQuestion } from "@/lib/lessons/quiz";
import type { Answer, QuestionFeedback } from "./api";

type Props = {
  question: PlayerQuestion;
  index: number;
  answer: Answer | undefined;
  onAnswer(answer: Answer): void;
  feedback?: QuestionFeedback;
  disabled?: boolean;
};

export default function QuestionCard({ question, index, answer, onAnswer, feedback, disabled = false }: Props) {
  const isMulti = question.type === "multi";
  const options = question.type === "true_false" && !question.options.length
    ? [{ id: "true", text: "True" }, { id: "false", text: "False" }]
    : question.options;
  const isChoice = options.length > 0 && (isMulti || question.type === "mcq" || question.type === "true_false");
  const selected = Array.isArray(answer) ? answer : answer === undefined ? [] : [String(answer)];
  const locked = disabled || Boolean(feedback);
  const resultId = `question-${question.id}-result`;
  const status = feedback?.correct === true ? "Correct" : feedback?.correct === false ? "Try again next time" : "Pending review";
  const StatusIcon = feedback?.correct === true ? Check : feedback?.correct === false ? X : Clock3;

  return (
    <fieldset className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-describedby={feedback ? resultId : undefined}>
      <legend className="sr-only">Question {index + 1}: {question.prompt}</legend>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xs font-semibold text-accent">{index + 1}</span>
        <p className="min-w-0 pt-0.5 text-sm font-medium leading-6 text-fg">{question.prompt}</p>
      </div>

      {isChoice ? (
        <div className="space-y-2">
          {options.map((option) => {
            const checked = selected.includes(option.id);
            const correct = feedback?.correctOptionIds.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-focus ${
                  correct ? "border-success bg-success-soft text-fg" : checked ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface-2 text-fg-muted hover:border-line-strong"
                } ${locked ? "cursor-default" : ""}`}
              >
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={checked}
                  disabled={locked}
                  onChange={() => {
                    if (isMulti) onAnswer(checked ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
                    else onAnswer(option.id);
                  }}
                  className="size-4 accent-accent"
                />
                <span className="min-w-0 flex-1">{option.text}</span>
                {correct && <Check aria-label="Correct option" className="size-4 shrink-0 text-success" />}
              </label>
            );
          })}
        </div>
      ) : question.type === "long_answer" || question.type === "matching" ? (
        <textarea
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onAnswer(event.target.value)}
          disabled={locked}
          rows={4}
          maxLength={4000}
          aria-label={`Answer to question ${index + 1}`}
          placeholder={question.type === "matching" ? "Describe the matches" : "Write your response"}
          className="textarea w-full"
        />
      ) : (
        <input
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onAnswer(event.target.value)}
          disabled={locked}
          maxLength={4000}
          aria-label={`Answer to question ${index + 1}`}
          placeholder="Your answer"
          className="input w-full"
        />
      )}

      {feedback && (
        <div id={resultId} role="status" className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-fg-muted">
          <div className="flex items-center gap-2 font-medium text-fg"><StatusIcon className="size-4" />{status}</div>
          {feedback.answerText && <p className="mt-1">Answer: {feedback.answerText}</p>}
          {feedback.explanation && <p className="mt-1">{feedback.explanation}</p>}
          {feedback.correct === null && !feedback.explanation && <p className="mt-1 inline-flex items-center gap-1"><CircleHelp className="size-3.5" />Your teacher can review this answer.</p>}
        </div>
      )}
    </fieldset>
  );
}
