"use client";

import { useEffect, useRef } from "react";
import { Heading2, ImageIcon, ListChecks, MousePointer2, Palette, Sparkles, Timer, Type } from "lucide-react";
import {
  normalizeLessonAuthoringContent,
  type SectionInsertTool,
} from "@/lib/content/section-library";
import {
  CREATOR_PALETTE_SWATCHES,
  CREATOR_TEXT_STYLES,
  PRACTICE_GAME_STYLE_PRESETS,
} from "@/lib/learning/creator-library";

type LessonBlockEditorProps = {
  value: string;
  onChange: (value: string) => void;
  insertTools: SectionInsertTool[];
  placeholder: string;
  contentTypeLabel: string;
};

function previewLines(value: string) {
  return normalizeLessonAuthoringContent(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

const textStyleInsertById: Record<string, string> = {
  heading: "## Heading",
  subheading: "### Subheading",
  body: "Body paragraph\nWrite the explanation, example, or learner-facing direction here.",
  callout: "Callout: Remember\nAdd a key reminder, warning, misconception, or example.",
  citation: "Reference\nSource: https://\nWhy it matters:",
  glossary: "Glossary\nTerm | Definition | Example",
};

function blockPrefix(value: string) {
  return value.trim() ? "\n\n" : "";
}

export default function LessonBlockEditor({
  value,
  onChange,
  insertTools,
  placeholder,
  contentTypeLabel,
}: LessonBlockEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalizeLessonAuthoringContent(value || "");
  const lines = previewLines(normalizedValue);

  useEffect(() => {
    if (normalizedValue !== value) {
      onChange(normalizedValue);
    }
  }, [normalizedValue, onChange, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.innerText !== normalizedValue) {
      editor.innerText = normalizedValue;
    }
  }, [normalizedValue]);

  const syncFromEditor = () => {
    onChange(editorRef.current?.innerText ?? "");
  };

  const appendTool = (tool: SectionInsertTool) => {
    onChange(`${normalizedValue}${blockPrefix(normalizedValue)}${tool.content}`);
  };

  const appendBlock = (content: string) => {
    onChange(`${normalizedValue}${blockPrefix(normalizedValue)}${content}`);
  };

  const formatSelection = (command: "bold" | "insertUnorderedList") => {
    document.execCommand(command);
    window.setTimeout(syncFromEditor, 0);
  };

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-edsync-border bg-edsync-surface shadow-sm">
      <div className="border-b border-edsync-border bg-edsync-card/95 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 px-1">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue/10 text-edsync-blue">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="truncate text-sm font-black text-edsync-text" title="Compose with blocks, media cues, game modes, and design markers.">
              {contentTypeLabel} page
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => formatSelection("bold")}
              className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-edsync-border bg-edsync-surface px-2.5 text-xs font-black text-edsync-text transition hover:border-edsync-blue/50"
              title="Bold selected text"
              aria-label="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => formatSelection("insertUnorderedList")}
              className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-edsync-border bg-edsync-surface px-2.5 text-xs font-black text-edsync-text transition hover:border-edsync-blue/50"
              title="List"
              aria-label="List"
            >
              <ListChecks className="h-4 w-4" />
            </button>
            {insertTools.slice(0, 6).map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => appendTool(tool)}
                className="rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2 text-xs font-black text-edsync-text transition hover:border-edsync-blue/50 hover:bg-edsync-blue/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edsync-blue"
                title={tool.description}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="bg-[radial-gradient(circle_at_top,_rgba(37,87,214,0.10),_transparent_28rem)] p-3 sm:p-4">
          <div className="mx-auto flex min-h-[18rem] max-w-4xl items-center justify-center rounded-[2rem] border border-edsync-border bg-slate-200/60 p-3 shadow-inner dark:bg-slate-950/70 sm:min-h-[23rem] sm:p-4">
            <div
              ref={editorRef}
              role="textbox"
              aria-label={`${contentTypeLabel} course content`}
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              onInput={syncFromEditor}
              onPaste={(event) => {
                event.preventDefault();
                const text = event.clipboardData.getData("text/plain");
                if (!insertPlainText(normalizeLessonAuthoringContent(text))) {
                  onChange(`${normalizedValue}${text}`);
                }
                window.setTimeout(syncFromEditor, 0);
              }}
              className="min-h-[15rem] w-full max-w-[54rem] rounded-[1.5rem] border border-edsync-border bg-edsync-card p-5 text-base leading-8 text-edsync-text shadow-xl outline-none transition empty:before:text-edsync-subtle empty:before:content-[attr(data-placeholder)] focus:border-edsync-blue focus:ring-2 focus:ring-edsync-blue/20 sm:aspect-[16/9] sm:min-h-[19rem] sm:p-7 sm:text-lg"
              data-placeholder={placeholder}
            />
          </div>
        </div>

        <aside className="space-y-3 border-t border-edsync-border bg-edsync-card p-3 xl:border-l xl:border-t-0">
          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-wide text-edsync-subtle">
              <Type className="h-3.5 w-3.5" />
              Text
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CREATOR_TEXT_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => appendBlock(textStyleInsertById[style.id] ?? style.label)}
                  className="rounded-xl border border-edsync-border bg-edsync-card px-2 py-2 text-left text-xs font-black text-edsync-text transition hover:border-edsync-blue/50"
                  title={style.description}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-wide text-edsync-subtle">
              <Timer className="h-3.5 w-3.5" />
              Practice
            </div>
            <div className="grid gap-1.5">
              {PRACTICE_GAME_STYLE_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => appendBlock(`${preset.label}\nPoints: 100\nTarget: 60 seconds\nReview missed answers.`)}
                  className="rounded-xl border border-edsync-border bg-edsync-card px-2 py-2 text-left text-xs font-black text-edsync-text transition hover:border-edsync-amber/60"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-wide text-edsync-subtle">
              <Palette className="h-3.5 w-3.5" />
              Color
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {CREATOR_PALETTE_SWATCHES.slice(0, 10).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => appendBlock(`Design note\nAccent: ${color}`)}
                  className="h-7 w-7 rounded-full border border-edsync-border shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edsync-blue"
                  style={{ background: color }}
                  aria-label={`Use accent ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-edsync-subtle">Layers</p>
              <span className="rounded-full bg-edsync-blue/10 px-2 py-1 text-[11px] font-black text-edsync-blue">
                {lines.length || 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => appendBlock("Media\nSource: HTTPS, YouTube, Vimeo, or uploaded asset\nCaption:\nLearner action:")}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edsync-border bg-edsync-card px-3 py-2 text-xs font-black text-edsync-subtle transition hover:border-edsync-blue/50 hover:text-edsync-blue"
            >
              <ImageIcon className="h-4 w-4" />
              Media
            </button>
            <div className="space-y-1.5">
              {lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-card p-3 text-center text-xs font-semibold text-edsync-subtle">
                  <MousePointer2 className="mx-auto mb-2 h-4 w-4" />
                  Add or type.
                </div>
              ) : (
                lines.map((line, index) => {
                  const Icon = line.startsWith("##") || line.startsWith("###") ? Heading2 : line.startsWith("[") || line.startsWith("-") || /^\d+\./.test(line) ? ListChecks : Type;
                  return (
                    <div key={`${line}-${index}`} className="rounded-xl border border-edsync-border bg-edsync-card p-2">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-edsync-subtle">
                        <Icon className="h-3.5 w-3.5 text-edsync-blue" />
                        Layer {index + 1}
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold leading-5 text-edsync-text">{line.replace(/^#+\s*/, "")}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
