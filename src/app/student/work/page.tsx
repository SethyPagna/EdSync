"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleAlert, Clock3, MessageSquareText, Send } from "lucide-react";
import toast from "react-hot-toast";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams } from "@/lib/classes/class-scope";
import { normalizeWorkGradingSettings, workGradingLabel } from "@/lib/work/grading";
import { evaluateWorkSubmission, normalizeWorkSubmissionPolicy } from "@/lib/work/policy";
import { Button, EmptyState, PageHeader, Segmented, Sheet, Skeleton } from "@/components/ui";

type WorkItem = {
  id: string; title: string; work_type: string; instructions: string | null; due_at: string | null;
  allow_late: number | null; points_possible: number; settings: unknown; class_name: string | null;
  submission_status: string | null; submission_percent: number | null; submission_feedback: string | null;
  questions: WorkQuestion[];
};
type WorkQuestion = { id: string; prompt: string; kind: "choice" | "short" | "long"; options: string[]; points: number };
type Submission = { work_item_id: string; attempt_count: number | null; is_late: number | null };
type ApiResponse<T> = { data?: T; error?: string | { message?: string } | null };
type WorkFilter = "open" | "dueSoon" | "submitted" | "feedback" | "discussions" | "all";
const FILTERS: { value: WorkFilter; label: string }[] = [
  { value: "open", label: "To do" }, { value: "dueSoon", label: "Due soon" },
  { value: "submitted", label: "Submitted" }, { value: "feedback", label: "Feedback" },
  { value: "discussions", label: "Discuss" }, { value: "all", label: "All" },
];
function apiError(value: ApiResponse<unknown>["error"], fallback: string) {
  return typeof value === "string" ? value : value?.message || fallback;
}
function dueLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Due date" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function dueSoon(value: string | null, now: number) {
  if (!value || !now) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= now + 7 * 24 * 60 * 60 * 1000;
}
function submitted(item: WorkItem) { return item.submission_status === "submitted" || item.submission_status === "graded"; }

export default function StudentWorkPage() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [filter, setFilter] = useState<WorkFilter>("open");
  const [requestedClassId, setRequestedClassId] = useState(ALL_CLASSES_SCOPE);
  const [scopeReady, setScopeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [active, setActive] = useState<WorkItem | null>(null);
  const [responseText, setResponseText] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setRequestedClassId(classScopeFromSearchParams(params));
      const selected = params.get("filter");
      if (FILTERS.some((option) => option.value === selected)) setFilter(selected as WorkFilter);
      setScopeReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = requestedClassId === ALL_CLASSES_SCOPE ? "" : `?classId=${encodeURIComponent(requestedClassId)}`;
      const [workResponse, submissionResponse] = await Promise.all([
        fetch(`/api/work${query}`, { cache: "no-store", credentials: "include" }),
        fetch("/api/work/submissions", { cache: "no-store", credentials: "include" }),
      ]);
      const work = (await workResponse.json()) as ApiResponse<WorkItem[]>;
      const attempts = (await submissionResponse.json()) as ApiResponse<Submission[]>;
      if (!workResponse.ok || work.error) throw new Error(apiError(work.error, "Assessments could not load."));
      if (!submissionResponse.ok || attempts.error) throw new Error(apiError(attempts.error, "Submission status could not load."));
      setItems(work.data ?? []);
      setSubmissions(Object.fromEntries((attempts.data ?? []).map((item) => [item.work_item_id, item])));
      setNow(Date.now());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Assessments could not load."); }
    finally { setLoading(false); }
  }, [requestedClassId]);

  useEffect(() => {
    if (!scopeReady) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, scopeReady]);

  const chooseFilter = (next: WorkFilter) => {
    setFilter(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "open") params.delete("filter"); else params.set("filter", next);
    router.replace(`/student/work${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };
  const filtered = useMemo(() => {
    if (filter === "submitted") return items.filter(submitted);
    if (filter === "dueSoon") return items.filter((item) => !submitted(item) && dueSoon(item.due_at, now));
    if (filter === "open") return items.filter((item) => !submitted(item));
    if (filter === "feedback") return items.filter((item) => Boolean(item.submission_feedback));
    if (filter === "discussions") return items.filter((item) => item.work_type === "discussion");
    return items;
  }, [filter, items, now]);
  const decisionFor = (item: WorkItem) => evaluateWorkSubmission({
    now, dueAt: item.due_at, allowLate: Number(item.allow_late ?? 1) !== 0,
    policy: normalizeWorkSubmissionPolicy(item.settings),
    existing: item.submission_status ? { status: item.submission_status, attempts: Number(submissions[item.id]?.attempt_count ?? 0) } : null,
  });
  const openComposer = (item: WorkItem) => { setActive(item); setResponseText(""); setQuestionAnswers({}); setSubmitError(""); };
  const submit = async () => {
    if (!active) return;
    const questions = active.questions ?? [];
    if (questions.length > 0 && questions.some((question) => !questionAnswers[question.id]?.trim())) {
      setSubmitError("Answer every question before submitting."); return;
    }
    if (questions.length === 0 && !responseText.trim()) { setSubmitError("Write a response first."); return; }
    setSaving(true); setSubmitError("");
    try {
      const response = await fetch("/api/work/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          workItemId: active.id,
          response: questions.length > 0
            ? { answers: questions.map((question) => ({ questionId: question.id, answer: questionAnswers[question.id].trim() })) }
            : { text: responseText },
        }),
      });
      const payload = (await response.json()) as ApiResponse<{ attemptNumber: number; late: boolean }>;
      if (!response.ok || payload.error) { setSubmitError(apiError(payload.error, "Submission was not saved.")); return; }
      toast.success(payload.data?.late ? "Submitted late." : "Submitted.");
      setActive(null); setResponseText(""); setQuestionAnswers({}); await load();
    } catch { setSubmitError("Submission was not saved. Try again."); }
    finally { setSaving(false); }
  };
  const openCount = items.filter((item) => !submitted(item)).length;
  const activeDecision = active ? decisionFor(active) : null;

  return <div className="page-shell max-w-5xl">
    <PageHeader title="Assessments" icon={CheckCircle2} count={items.length}>
      <p className="text-sm text-fg-muted">{openCount} to do · {items.length - openCount} submitted</p>
    </PageHeader>
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Segmented<WorkFilter> value={filter} onChange={chooseFilter} ariaLabel="Assessment filter" size="sm" options={FILTERS} className="max-w-full overflow-x-auto" />
      {requestedClassId !== ALL_CLASSES_SCOPE && <Link href="/student/work" className="text-sm font-medium text-accent hover:underline">All classes</Link>}
    </div>
    {loading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-28" />)}</div> :
      error ? <EmptyState icon={CircleAlert} title="Assessments unavailable" hint={error} action={<Button onClick={() => void load()}>Try again</Button>} /> :
      filtered.length === 0 ? <EmptyState icon={CheckCircle2} title={filter === "open" ? "All caught up" : "Nothing in this view"} hint="Your assessments will appear here." /> :
      <div className="space-y-2.5">{filtered.map((item) => {
        const attempt = submissions[item.id];
        const policy = normalizeWorkSubmissionPolicy(item.settings);
        const decision = decisionFor(item);
        const grading = normalizeWorkGradingSettings(item.settings);
        return <article key={item.id} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-fg-muted">
                <span className="rounded-full bg-surface-2 px-2 py-1 capitalize">{item.work_type}</span>
                <span>{item.class_name || "Independent course"}</span>
                {attempt?.is_late === 1 && <span className="rounded-full bg-warning-soft px-2 py-1 text-warning">Submitted late</span>}
              </div>
              <h2 className="truncate text-base font-semibold text-fg">{item.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{dueLabel(item.due_at)}</span>
                <span>{workGradingLabel(grading, item.points_possible)}</span>
                {Number(attempt?.attempt_count ?? 0) > 0 && <span>{attempt?.attempt_count} {Number(attempt?.attempt_count) === 1 ? "attempt" : "attempts"}{policy.maxAttempts ? ` / ${policy.maxAttempts}` : ""}</span>}
              </p>
              {item.submission_feedback && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-fg"><MessageSquareText size={14} className="mr-1 inline text-accent" />{item.submission_feedback}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${item.submission_status === "graded" ? "bg-success-soft text-success" : submitted(item) ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-muted"}`}>
                {submitted(item) ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                {item.submission_status === "graded" ? (item.submission_percent === null ? "Graded" : `${item.submission_percent}%`) : submitted(item) ? "Submitted" : "To do"}
              </span>
              {decision.ok && <Button size="sm" onClick={() => openComposer(item)}>{submitted(item) ? "Resubmit" : "Open"}</Button>}
            </div>
          </div>
        </article>;
      })}</div>}
    <Sheet open={active !== null} onClose={() => { if (!saving) setActive(null); }} title={active?.title ?? "Submit work"} description={active ? `${active.class_name || "Independent course"} · ${dueLabel(active.due_at)}` : undefined} footer={<><Button onClick={() => setActive(null)} disabled={saving}>Cancel</Button><Button variant="primary" icon={Send} loading={saving} onClick={() => void submit()} disabled={!activeDecision?.ok}>Submit response</Button></>}>
      {active && <div className="space-y-5">
        {active.instructions && <div className="rounded-lg bg-surface-2 p-4"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Instructions</p><p className="whitespace-pre-wrap text-sm leading-6 text-fg">{active.instructions}</p></div>}
        {(active.questions ?? []).length > 0 ? <div className="space-y-5">
          {(active.questions ?? []).map((question, index) => <fieldset key={question.id} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-fg">{index + 1}. {question.prompt}</legend>
            {question.kind === "choice" ? <div className="mt-3 space-y-2">{question.options.map((option, optionIndex) => <label key={`${question.id}-${optionIndex}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm text-fg hover:bg-surface-2">
              <input type="radio" name={`work-question-${question.id}`} value={option} checked={questionAnswers[question.id] === option} onChange={() => setQuestionAnswers((current) => ({ ...current, [question.id]: option }))} className="mt-0.5 accent-accent" />
              <span>{option}</span>
            </label>)}</div> : question.kind === "long" ? <textarea aria-label={`Answer to question ${index + 1}`} className="input mt-3 min-h-28 w-full" maxLength={4000} value={questionAnswers[question.id] ?? ""} onChange={(event) => setQuestionAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Write your answer…" /> : <input aria-label={`Answer to question ${index + 1}`} className="input mt-3 w-full" maxLength={4000} value={questionAnswers[question.id] ?? ""} onChange={(event) => setQuestionAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Your answer" />}
          </fieldset>)}
        </div> : <label className="block text-sm font-semibold text-fg">Your response<textarea autoFocus className="input mt-2 min-h-48 w-full" value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Write your answer or reflection…" /></label>}
        {activeDecision && !activeDecision.ok && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{activeDecision.error}</p>}
        {submitError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{submitError}</p>}
        {submissions[active.id] && <p className="text-xs text-fg-muted">Attempt {Number(submissions[active.id].attempt_count ?? 0) + 1}{normalizeWorkSubmissionPolicy(active.settings).maxAttempts ? ` of ${normalizeWorkSubmissionPolicy(active.settings).maxAttempts}` : ""}</p>}
      </div>}
    </Sheet>
  </div>;
}
