"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { writeStudioDraft } from "@/lib/studio/drafts";
import type { AiPromptContract } from "@/types";

type AiPromptBuilderProps = {
  contracts: AiPromptContract[];
  initialTask?: string;
};

type RunState = {
  loading: boolean;
  error: string | null;
  output: unknown;
  inserted: boolean;
};

function defaultValuesForContract(contract: AiPromptContract) {
  return Object.fromEntries(
    contract.fields.map((field) => [field.id, field.defaultValue ?? ""]),
  ) as Record<string, string | number | string[]>;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sectionFromValue(title: string, value: unknown) {
  if (!value) return "";
  const content = typeof value === "string" ? escapeHtml(value) : `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
  return `<section data-edsync-ai-section="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function outputToHtml(output: unknown) {
  const record = getRecord(output);
  if (!record) return `<h2>AI Draft</h2><p>${escapeHtml(output)}</p>`;

  const draft = getRecord(record.draft) ?? record;
  const orderedSections = [
    ["Outline", draft.outline],
    ["Design", draft.design],
    ["Modules", draft.modules],
    ["Practice Plan", draft.practicePlan],
    ["Quiz", draft.quiz],
    ["Rubric", draft.rubric],
    ["Tags", draft.tags],
    ["Teacher Review", draft.review],
  ];

  return [
    "<article data-edsync-ai-draft=\"lesson-workflow\">",
    "<h1>AI Lesson Workflow Draft</h1>",
    ...orderedSections.map(([title, value]) => sectionFromValue(String(title), value)),
    "</article>",
  ].join("");
}

function summarizeOutput(output: unknown) {
  if (!output || typeof output !== "object") return String(output ?? "");
  const record = output as Record<string, unknown>;
  if (record.draft) return record.draft;
  if (record.lesson) return record.lesson;
  return record;
}

function slidesFromOutput(output: unknown, fallbackTitle: string) {
  const summary = summarizeOutput(output);
  const record = getRecord(summary);
  const modules = Array.isArray(record?.modules) ? record.modules : [];
  const outlineModules = getRecord(record?.outline)?.modules;
  const sourceSlides = modules.length > 0 ? modules : Array.isArray(outlineModules) ? outlineModules : [];

  if (sourceSlides.length === 0) {
    return [
      {
        id: "slide-1",
        title: fallbackTitle,
        notes: JSON.stringify(summary, null, 2).slice(0, 700),
        accent: "#2563eb",
      },
    ];
  }

  return sourceSlides.slice(0, 12).map((item, index) => {
    const itemRecord = getRecord(item);
    const title =
      itemRecord?.title ??
      itemRecord?.moduleTitle ??
      itemRecord?.name ??
      `${fallbackTitle} ${index + 1}`;
    return {
      id: `slide-${index + 1}`,
      title: String(title),
      notes: JSON.stringify(item, null, 2).slice(0, 700),
      accent: index % 2 === 0 ? "#2563eb" : "#0e7490",
    };
  });
}

export default function AiPromptBuilder({ contracts, initialTask }: AiPromptBuilderProps) {
  const initialContract = contracts.find((contract) => contract.id === initialTask) ?? contracts[0];
  const [selectedId, setSelectedId] = useState(initialContract.id);
  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedId) ?? contracts[0],
    [contracts, selectedId],
  );
  const [values, setValues] = useState(() => defaultValuesForContract(initialContract));
  const [state, setState] = useState<RunState>({
    loading: false,
    error: null,
    output: null,
    inserted: false,
  });

  const updateContract = (contractId: string) => {
    const nextContract = contracts.find((contract) => contract.id === contractId) ?? contracts[0];
    setSelectedId(nextContract.id);
    setValues(defaultValuesForContract(nextContract));
    setState({ loading: false, error: null, output: null, inserted: false });
  };

  const setFieldValue = (fieldId: string, value: string) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const runWorkflow = async () => {
    const topic = String(values.topic || values.source || values.mode || "Learning draft").slice(0, 160);
    setState({ loading: true, error: null, output: null, inserted: false });

    try {
      const response = await fetch("/api/ai/course-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic,
          audience: values.audience || "mixed learners",
          durationMinutes: Number(values.slideCount || 45),
          tone: values.tone || "clear, student-friendly, professional",
          sourceText: values.source || values.topic || "",
          designTemplateId: values.designTemplate || values.template || "",
          practiceMode: values.mode || values.practiceMode || "",
          outputLength: values.outputLength || "standard",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI workflow failed.");
      setState({ loading: false, error: null, output: payload.data ?? payload, inserted: false });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "AI workflow failed.",
        output: null,
        inserted: false,
      });
    }
  };

  const insertIntoDraft = () => {
    const output = summarizeOutput(state.output);
    const plainText = JSON.stringify(output, null, 2);
    writeStudioDraft({
      kind: selectedContract.feature === "slide_deck" ? "slide" : "doc",
      itemId: "workspace",
      title: selectedContract.title,
      status: "local_draft",
      value: {
        html: outputToHtml(output),
        plainText,
        sheet: [
          ["Field", "Value"],
          ["Workflow", selectedContract.title],
          ["Feature", selectedContract.feature],
          ["Insert targets", selectedContract.insertTargets.join(", ")],
        ],
        slides: slidesFromOutput(state.output, selectedContract.title),
      },
    });
    setState((current) => ({ ...current, inserted: true }));
  };

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-edsync-border bg-edsync-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Workflows</p>
        <div className="mt-3 space-y-2">
          {contracts.map((contract) => (
            <button
              key={contract.id}
              type="button"
              onClick={() => updateContract(contract.id)}
              title={contract.description}
              aria-label={`${contract.title}: ${contract.description}`}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selectedId === contract.id
                  ? "border-edsync-blue bg-edsync-blue/10"
                  : "border-edsync-border bg-edsync-surface hover:border-edsync-blue/40"
              }`}
            >
              <p className="text-sm font-semibold">{contract.title}</p>
              <span className="edsync-hover-detail">{contract.description}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="min-w-0 rounded-xl border border-edsync-border bg-edsync-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="group" tabIndex={0} title={selectedContract.description}>
            <p className="text-sm font-semibold text-edsync-blue">{selectedContract.feature.replaceAll("_", " ")}</p>
            <h2 className="font-display text-2xl font-bold">{selectedContract.title}</h2>
            <p className="edsync-hover-detail max-w-2xl">{selectedContract.description}</p>
          </div>
          <button type="button" onClick={runWorkflow} disabled={state.loading} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {selectedContract.fields.map((field) => (
            <label key={field.id} className={field.type === "textarea" ? "md:col-span-2" : ""}>
              <span className="text-sm font-semibold">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  className="edsync-input mt-2 min-h-32"
                  value={String(values[field.id] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => setFieldValue(field.id, event.target.value)}
                  required={field.required}
                />
              ) : field.type === "select" && field.options ? (
                <select
                  className="edsync-input mt-2"
                  value={String(values[field.id] ?? field.options[0])}
                  onChange={(event) => setFieldValue(field.id, event.target.value)}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="edsync-input mt-2"
                  type={field.type === "number" ? "number" : "text"}
                  value={String(values[field.id] ?? "")}
                  placeholder={field.placeholder}
                  onChange={(event) => setFieldValue(field.id, event.target.value)}
                  required={field.required}
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-edsync-border bg-edsync-surface p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">Output contract</p>
              <p className="text-xs text-edsync-subtle" title={`${Object.keys(selectedContract.outputShape).join(", ")} -> ${selectedContract.insertTargets.join(", ")}`}>
                Shape ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={insertIntoDraft} disabled={!state.output} className="btn-secondary px-3 py-2 text-sm disabled:opacity-50">
                {state.inserted ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {state.inserted ? "Inserted" : "Save draft"}
              </button>
              <Link href="/notes" className="btn-secondary px-3 py-2 text-sm">
                Drafts <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {state.error && (
            <div className="mt-4 rounded-lg border border-edsync-red/30 bg-edsync-red/10 p-3 text-sm font-semibold text-edsync-red">
              {state.error}
            </div>
          )}
          {Boolean(state.output) && (
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              {JSON.stringify(summarizeOutput(state.output), null, 2)}
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}
