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
  body: "Body paragraph\nWrite the explanation, example, or student-facing direction here.",
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

  return (
    <div className="overflow-hidden rounded-2xl border border-edsync-border bg-edsync-surface shadow-sm">
      <div className="border-b border-edsync-border bg-edsync-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
            <Sparkles className="h-4 w-4" />
          </span>
            <div>
              <p className="text-sm font-bold text-edsync-text">{contentTypeLabel} canvas</p>
              <p className="text-xs text-edsync-subtle">Compose with blocks, media cues, game modes, and design markers. No HTML needed.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {insertTools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => appendTool(tool)}
                className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5 text-xs font-bold text-edsync-subtle transition hover:border-edsync-blue/50 hover:text-edsync-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edsync-blue"
                title={tool.description}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-edsync-subtle">
              <Type className="h-3.5 w-3.5" />
              Text styles
            </div>
            <div className="flex flex-wrap gap-2">
              {CREATOR_TEXT_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => appendBlock(textStyleInsertById[style.id] ?? style.label)}
                  className="rounded-xl border border-edsync-border bg-edsync-card px-3 py-2 text-left text-xs font-bold text-edsync-text transition hover:border-edsync-blue/50"
                  title={style.description}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-edsync-subtle">
              <Timer className="h-3.5 w-3.5" />
              Practice cards
            </div>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_GAME_STYLE_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => appendBlock(`${preset.label}\n${preset.description}\nPoints: 100\nTarget time: 60 seconds\nExplain missed answers.`)}
                  className="rounded-xl border border-edsync-border bg-edsync-card px-3 py-2 text-left text-xs font-bold text-edsync-text transition hover:border-edsync-amber/60"
                  title={preset.tags.join(", ")}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-edsync-border bg-edsync-surface p-2">
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-edsync-subtle">
              <Palette className="h-3.5 w-3.5" />
              Palette
            </div>
            <div className="grid grid-cols-5 gap-1">
              {CREATOR_PALETTE_SWATCHES.slice(0, 10).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => appendBlock(`Design note\nAccent color: ${color}\nUse this color for emphasis, badges, or the practice state.`)}
                  className="h-7 w-7 rounded-full border border-edsync-border shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edsync-blue"
                  style={{ background: color }}
                  aria-label={`Use accent ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-3">
          <div
            ref={editorRef}
            role="textbox"
            aria-label={`${contentTypeLabel} lesson content`}
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
            className="min-h-[260px] rounded-xl border border-edsync-border bg-edsync-card p-4 text-sm leading-7 text-edsync-text outline-none transition empty:before:text-edsync-subtle empty:before:content-[attr(data-placeholder)] focus:border-edsync-blue focus:ring-2 focus:ring-edsync-blue/20"
            data-placeholder={placeholder}
          />
        </div>

        <aside className="border-t border-edsync-border bg-edsync-card p-3 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Structure</p>
            <span className="rounded-full bg-edsync-blue/10 px-2 py-1 text-[11px] font-bold text-edsync-blue">
              {lines.length || 0} blocks
            </span>
          </div>
          <button
            type="button"
            onClick={() => appendBlock("Media cue\nType: image or video\nSource: HTTPS, YouTube, Vimeo, or uploaded R2 asset\nCaption:\nStudent action:")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edsync-border bg-edsync-surface px-3 py-2 text-xs font-bold text-edsync-subtle transition hover:border-edsync-blue/50 hover:text-edsync-blue"
          >
            <ImageIcon className="h-4 w-4" />
            Add media cue
          </button>
          <div className="mt-3 space-y-2">
            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-surface p-4 text-center text-xs text-edsync-subtle">
                <MousePointer2 className="mx-auto mb-2 h-4 w-4" />
                Add a block or type directly on the canvas.
              </div>
            ) : (
              lines.map((line, index) => {
                const Icon = line.startsWith("##") || line.startsWith("###") ? Heading2 : line.startsWith("[") || line.startsWith("-") || /^\d+\./.test(line) ? ListChecks : Type;
                return (
                  <div key={`${line}-${index}`} className="rounded-xl border border-edsync-border bg-edsync-surface p-3">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-edsync-subtle">
                      <Icon className="h-3.5 w-3.5 text-edsync-blue" />
                      Block {index + 1}
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-edsync-text">{line.replace(/^#+\s*/, "")}</p>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
