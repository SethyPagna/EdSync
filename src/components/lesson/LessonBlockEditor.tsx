"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Heading2, List, Plus, Quote } from "lucide-react";
import { SECTION_TEMPLATES, normalizeLessonAuthoringContent, type SectionInsertTool } from "@/lib/content/section-library";

type Props = {
  value: string;
  onChange: (value: string) => void;
  insertTools: SectionInsertTool[];
  placeholder: string;
  contentTypeLabel: string;
};

export default function LessonBlockEditor({ value, onChange, insertTools, placeholder, contentTypeLabel }: Props) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const normalized = normalizeLessonAuthoringContent(value || "");
  const suggestions = useMemo(() => slash ? SECTION_TEMPLATES.filter((template) => `${template.title} ${template.category}`.toLowerCase().includes(slash.query.toLowerCase())).slice(0, 6) : [], [slash]);

  useEffect(() => { if (normalized !== value) onChange(normalized); }, [normalized, onChange, value]);

  const replaceSelection = (text: string, start?: number) => {
    const input = editor.current;
    if (!input) { onChange(`${normalized}${normalized ? "\n\n" : ""}${text}`); return; }
    const from = start ?? input.selectionStart;
    const to = input.selectionEnd;
    const prefix = from > 0 && !/\n$/.test(normalized.slice(0, from)) ? "\n\n" : "";
    const result = `${normalized.slice(0, from)}${prefix}${text}${normalized.slice(to)}`;
    const cursor = from + prefix.length + text.length;
    onChange(result); setSlash(null);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(cursor, cursor); });
  };

  const chooseTemplate = (index: number) => {
    const template = suggestions[index];
    if (!template) return;
    replaceSelection(template.content, slash?.start);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const cursor = event.target.selectionStart;
    const left = next.slice(0, cursor);
    const match = left.match(/(^|\s)\/([\w -]{0,30})$/);
    setSlash(match ? { start: cursor - match[2].length - 1, query: match[2] } : null);
    setActiveSuggestion(0);
    onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!slash || suggestions.length === 0) return;
    if (event.key === "Escape") { event.preventDefault(); setSlash(null); }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveSuggestion((index) => (index + 1) % suggestions.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveSuggestion((index) => (index - 1 + suggestions.length) % suggestions.length); }
    if (event.key === "Enter") { event.preventDefault(); chooseTemplate(activeSuggestion); }
  };

  const words = normalized.trim() ? normalized.trim().split(/\s+/).length : 0;
  return <div className="rounded-xl border border-line bg-surface">
    <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
      <button type="button" onClick={() => replaceSelection("## Heading\n")} aria-label="Insert heading" title="Heading" className="btn btn-ghost btn-sm"><Heading2 size={15} /></button>
      <button type="button" onClick={() => replaceSelection("- First point\n- Second point")} aria-label="Insert list" title="List" className="btn btn-ghost btn-sm"><List size={15} /></button>
      <button type="button" onClick={() => replaceSelection("> Key idea\n")} aria-label="Insert quote" title="Quote" className="btn btn-ghost btn-sm"><Quote size={15} /></button>
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      <select aria-label="Insert content block" className="select max-w-44 text-xs" defaultValue="" onChange={(event) => { const tool = insertTools.find((item) => item.label === event.target.value); if (tool) replaceSelection(tool.content); event.target.value = ""; }}><option value="" disabled>Insert block…</option>{insertTools.map((tool) => <option key={tool.label} value={tool.label}>{tool.label}</option>)}</select>
      <span className="ml-auto flex items-center gap-1 text-[11px] text-fg-faint"><Plus size={12} /> Type / for templates</span>
    </div>
    <div className="relative p-3 sm:p-4">
      <textarea ref={editor} value={normalized} onChange={handleChange} onKeyDown={handleKeyDown} aria-label={`${contentTypeLabel} content`} placeholder={placeholder} spellCheck className="min-h-72 w-full resize-y border-0 bg-transparent text-sm leading-7 text-fg outline-none placeholder:text-fg-faint sm:min-h-96" />
      {slash && suggestions.length > 0 && <div role="listbox" aria-label="Block templates" className="absolute bottom-6 left-4 z-20 max-h-56 w-[min(18rem,calc(100%-2rem))] overflow-y-auto rounded-lg border border-line bg-elevated p-1 shadow-lg">{suggestions.map((template, index) => <button key={template.id} type="button" role="option" aria-selected={index === activeSuggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseTemplate(index)} className={`block w-full rounded-md px-3 py-2 text-left text-xs ${index === activeSuggestion ? "bg-accent-soft text-accent" : "text-fg hover:bg-surface-2"}`}><span className="block font-semibold">{template.title}</span><span className="capitalize text-fg-muted">{template.category}</span></button>)}</div>}
    </div>
    <div className="border-t border-line px-4 py-2 text-right text-[11px] text-fg-faint">{words} words</div>
  </div>;
}
