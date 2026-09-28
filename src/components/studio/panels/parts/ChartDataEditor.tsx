"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CHART_KINDS } from "@/lib/studio/library";
import type { ChartElement } from "@/lib/studio/scene";
import { useStudio } from "../../store";

export default function ChartDataEditor({ chart }: { chart: ChartElement }) {
  const updateElement = useStudio((state) => state.updateElement);
  const [draft, setDraft] = useState(() => chart.data.map((datum) => ({ label: datum.label, value: String(datum.value) })));
  const [error, setError] = useState("");

  const save = () => {
    const data = draft.map(({ label, value }) => ({ label: label.trim(), value: Number(value) }));
    if (!data.length || data.some((datum) => !datum.label || !Number.isFinite(datum.value))) {
      setError("Add a label and number to every row.");
      return;
    }
    updateElement(chart.id, { data } as Partial<ChartElement>);
    setError("");
  };

  return <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3" aria-label="Chart data editor">
    <label className="block text-xs font-medium text-fg">Chart type
      <select aria-label="Chart type" className="select mt-1 w-full" value={chart.chart} onChange={(event) => updateElement(chart.id, { chart: event.target.value as ChartElement["chart"] } as Partial<ChartElement>)}>
        {CHART_KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.name}</option>)}
      </select>
    </label>
    <div className="space-y-1.5">{draft.map((datum, index) => <div key={index} className="flex min-w-0 items-center gap-1.5">
      <input aria-label={`Row ${index + 1} label`} className="input min-w-0 flex-1" value={datum.label} onChange={(event) => setDraft((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} />
      <input aria-label={`Row ${index + 1} value`} type="number" step="any" className="input w-20 shrink-0" value={datum.value} onChange={(event) => setDraft((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))} />
      <button type="button" className="icon-btn shrink-0" aria-label={`Remove row ${index + 1}`} disabled={draft.length <= 1} onClick={() => setDraft((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} /></button>
    </div>)}</div>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <div className="flex justify-between gap-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft((rows) => [...rows, { label: `Item ${rows.length + 1}`, value: "0" }])}><Plus size={14} /> Row</button><button type="button" className="btn btn-secondary btn-sm" onClick={save}>Apply data</button></div>
  </div>;
}
