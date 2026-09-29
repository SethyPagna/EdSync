"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, Settings2, Sparkles, Trash2 } from "lucide-react";
import { outlineFromText, type LessonOutline } from "@/lib/compose";
import { moveOutlineSection, removeOutlineSection } from "./model";
import { requestOutline, type OutlineSource } from "./api";

export type OutlineComposerProps = {
  useLabel: string;
  onUse: (outline: LessonOutline, source: OutlineSource) => void | Promise<void>;
  initialTopic?: string;
  initialText?: string;
  defaultMode?: "topic" | "notes";
  busy?: boolean;
  compact?: boolean;
};

type SourceMode = "topic" | "notes" | "file";
type ExtractedFile = { text?: string; fileName?: string; warning?: string; error?: string };

export default function OutlineComposer({ useLabel, onUse, initialTopic = "", initialText = "", defaultMode = "topic", busy = false, compact = false }: OutlineComposerProps) {
  const [mode, setMode] = useState<SourceMode>(defaultMode);
  const [topic, setTopic] = useState(initialTopic);
  const [text, setText] = useState(initialText);
  const [fileName, setFileName] = useState("");
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [language, setLanguage] = useState("en");
  const [sectionCount, setSectionCount] = useState(5);
  const [questionCount, setQuestionCount] = useState(5);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [outline, setOutline] = useState<LessonOutline | null>(null);
  const [source, setSource] = useState<OutlineSource>("local");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (mode === "topic") return;
    if (!text.trim()) return;
    const timer = window.setTimeout(() => {
      setOutline(outlineFromText(text, { title: topic.trim() || undefined, language, fileName: fileName || undefined }));
      setSource("local");
      setError(null);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [mode, text, topic, language, fileName]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async (regenerate = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    setError(null);
    try {
      const result = await requestOutline({
        topic: topic.trim(),
        sourceText: mode === "topic" ? undefined : text,
        audience: audience.trim() || undefined,
        level,
        language,
        sectionCount,
        questionCount,
        mode: regenerate ? "ai" : "auto",
      }, controller.signal);
      setOutline(result.outline);
      setSource(result.source);
      setWarnings(result.warnings);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not generate an outline.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };

  const upload = async (file: File) => {
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/content/extract", { method: "POST", body: form });
      const result = await response.json() as ExtractedFile;
      if (!response.ok || !result.text) throw new Error(result.error || "No readable text was found in this file.");
      setFileName(result.fileName || file.name);
      setText(result.text);
      setWarnings(result.warning ? [result.warning] : []);
      setMode("file");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this file.");
    } finally {
      setPending(false);
    }
  };

  const use = async () => {
    if (!outline) return;
    setPending(true);
    setError(null);
    try {
      await onUse(outline, source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not use this outline.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`min-w-0 space-y-3 ${compact ? "text-sm" : ""}`}>
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-edsync-border bg-edsync-surface p-1" role="tablist" aria-label="Outline source">
        {(["topic", "notes", "file"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => { setMode(item); if (item !== "topic" && !text.trim()) setOutline(null); }} className={`rounded-lg px-3 py-1.5 font-medium capitalize transition ${mode === item ? "bg-edsync-card text-edsync-text shadow-sm" : "text-edsync-subtle hover:text-edsync-text"}`}>{item}</button>
        ))}
        <button type="button" aria-label="Outline options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)} className="ml-auto rounded-lg p-2 text-edsync-subtle hover:bg-edsync-card hover:text-edsync-text"><Settings2 className="h-4 w-4" /></button>
      </div>

      <input className="edsync-input w-full" aria-label="Topic" placeholder="What are we learning?" value={topic} onChange={(event) => setTopic(event.target.value)} />
      {mode !== "topic" && <textarea className="edsync-input min-h-32 w-full resize-y" aria-label="Notes" placeholder="Paste notes or an article. Your outline appears as you type." value={text} onChange={(event) => { setText(event.target.value); if (!event.target.value.trim()) setOutline(null); }} />}
      {mode === "file" && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-edsync-border bg-edsync-surface px-3 py-3 text-edsync-subtle hover:border-edsync-blue hover:text-edsync-text"><FileText className="h-4 w-4" /><span className="truncate">{fileName || "Choose PDF, DOCX, or PPTX"}</span><input type="file" accept=".pdf,.docx,.pptx" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>}

      {optionsOpen && <div className="grid gap-2 rounded-xl border border-edsync-border bg-edsync-card p-3 sm:grid-cols-2">
        <label className="text-xs text-edsync-subtle">Audience<input className="edsync-input mt-1 w-full" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Grade 7" /></label>
        <label className="text-xs text-edsync-subtle">Level<select className="edsync-input mt-1 w-full" value={level} onChange={(event) => setLevel(event.target.value as typeof level)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label className="text-xs text-edsync-subtle">Language<input className="edsync-input mt-1 w-full" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en" /></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-edsync-subtle">Sections<input className="edsync-input mt-1 w-full" type="number" min={1} max={12} value={sectionCount} onChange={(event) => setSectionCount(Number(event.target.value))} /></label><label className="text-xs text-edsync-subtle">Questions<input className="edsync-input mt-1 w-full" type="number" min={0} max={12} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} /></label></div>
      </div>}

      {mode === "topic" && <button type="button" className="btn-secondary w-full justify-center" disabled={pending || busy || !topic.trim()} onClick={() => void generate()}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{pending ? "Generating…" : "Generate outline"}</button>}

      {outline && <section className="min-w-0 space-y-2 rounded-xl border border-edsync-border bg-edsync-card p-3" aria-label="Outline preview">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><input aria-label="Outline title" className="w-full bg-transparent font-semibold text-edsync-text outline-none focus:ring-2 focus:ring-edsync-blue" value={outline.title} onChange={(event) => setOutline({ ...outline, title: event.target.value })} /><p className="text-xs text-edsync-subtle">{outline.objectives.length} objectives · {outline.questions.length} questions · {outline.glossary.length} terms</p></div><span className="rounded-full bg-edsync-surface px-2 py-0.5 text-[11px] text-edsync-subtle">{source === "ai" ? "AI" : "Local"}</span></div>
        <div className="max-h-56 space-y-1 overflow-y-auto">{outline.sections.map((section, index) => <div key={`${index}-${section.kind}`} className="flex min-w-0 items-center gap-1 rounded-lg bg-edsync-surface px-2 py-1.5"><span className="w-6 shrink-0 text-center text-xs font-semibold text-edsync-blue" title={section.kind}>{index + 1}</span><input aria-label={`Section ${index + 1} heading`} className="min-w-0 flex-1 bg-transparent text-sm outline-none focus:ring-2 focus:ring-edsync-blue" value={section.heading} onChange={(event) => setOutline({ ...outline, sections: outline.sections.map((entry, position) => position === index ? { ...entry, heading: event.target.value } : entry) })} /><span className="hidden shrink-0 text-[11px] capitalize text-edsync-subtle sm:inline">{section.kind}</span><button type="button" aria-label={`Move section ${index + 1} up`} disabled={index === 0} className="rounded p-1 text-edsync-subtle disabled:opacity-30" onClick={() => setOutline(moveOutlineSection(outline, index, index - 1))}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label={`Move section ${index + 1} down`} disabled={index === outline.sections.length - 1} className="rounded p-1 text-edsync-subtle disabled:opacity-30" onClick={() => setOutline(moveOutlineSection(outline, index, index + 1))}><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" aria-label={`Remove section ${index + 1}`} disabled={outline.sections.length <= 1} className="rounded p-1 text-edsync-subtle disabled:opacity-30" onClick={() => setOutline(removeOutlineSection(outline, index))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
      </section>}
      {warnings.length > 0 && <p className="text-xs text-edsync-subtle" role="status">{warnings.join(" ")}</p>}
      {error && <p className="text-sm text-edsync-red" role="alert">{error}</p>}
      {outline && <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary flex-1 justify-center" disabled={pending || busy} onClick={() => void use()}>{pending ? "Working…" : useLabel}</button>{source === "ai" && <button type="button" className="btn-secondary" disabled={pending || busy} onClick={() => void generate(true)}>Regenerate</button>}</div>}
    </div>
  );
}
