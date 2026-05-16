"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/edsync/client";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/content/section-library";
import { lessonRowsToLearningObject, summarizeLearningObject } from "@/lib/learning/lesson-package";
import { getLearningStateLabel } from "@/lib/learning/objects";
import { sanitizeHtml } from "@/lib/security/html";
import { classifySafeMediaUrl, safeImageUrl } from "@/lib/security/media";
import type {
  Lesson,
  LessonSection,
  QuizQuestion,
  GlossaryTerm,
  Class,
  DifficultyLevel,
  ContentType,
} from "@/types";
import { getStatusBadge, formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

type Tab = "overview" | "sections" | "questions" | "glossary" | "assign";
type EdSyncClient = ReturnType<typeof createClient>;
type AssignmentRow = {
  class_id: string;
  classes?: { name?: string | null } | null;
  created_at: string;
};
type QType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "long_answer";

// ─────────────────────────────────────────
// RICH TEXT EDITOR
// ─────────────────────────────────────────
function RichTextEditor({
  value,
  onChange,
  placeholder = "Write content here...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML || "");
  };

  const insertHtml = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, sanitizeHtml(html));
    onChange(ref.current?.innerHTML || "");
  };

  const toolbarBtn = (
    label: string,
    action: () => void,
    title?: string,
    active?: boolean,
  ) => (
    <button
      key={label}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
      title={title || label}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${active ? "bg-edsync-blue text-white" : "text-edsync-subtle hover:text-edsync-text hover:bg-edsync-muted/30"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="border border-edsync-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-edsync-surface border-b border-edsync-border">
        {/* Format */}
        <select
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => {
            ref.current?.focus();
            document.execCommand("formatBlock", false, e.target.value);
            onChange(ref.current?.innerHTML || "");
            e.target.value = "p";
          }}
          className="text-xs bg-edsync-card border border-edsync-border rounded px-1 py-1 text-edsync-subtle mr-1"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Subheading</option>
          <option value="blockquote">Quote</option>
        </select>

        <select
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => {
            exec("fontName", e.target.value);
            e.target.value = "Inter";
          }}
          className="text-xs bg-edsync-card border border-edsync-border rounded px-1 py-1 text-edsync-subtle mr-1"
        >
          <option value="Inter">Sans</option>
          <option value="Georgia">Serif</option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Mono</option>
        </select>

        {/* Font size */}
        <select
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => {
            exec("fontSize", e.target.value);
            e.target.value = "3";
          }}
          className="text-xs bg-edsync-card border border-edsync-border rounded px-1 py-1 text-edsync-subtle mr-1"
        >
          <option value="1">Tiny</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">XL</option>
          <option value="6">XXL</option>
        </select>

        <div className="w-px h-5 bg-edsync-border mx-1" />

        {/* Text style */}
        {toolbarBtn("Undo", () => exec("undo"), "Undo")}
        {toolbarBtn("Redo", () => exec("redo"), "Redo")}
        {toolbarBtn("B", () => exec("bold"), "Bold", false)}
        {toolbarBtn("I", () => exec("italic"), "Italic", false)}
        {toolbarBtn("U", () => exec("underline"), "Underline", false)}
        {toolbarBtn("S", () => exec("strikeThrough"), "Strikethrough", false)}
        {toolbarBtn("Sub", () => exec("subscript"), "Subscript", false)}
        {toolbarBtn("Sup", () => exec("superscript"), "Superscript", false)}

        <div className="w-px h-5 bg-edsync-border mx-1" />

        {/* Alignment */}
        {toolbarBtn("Left", () => exec("justifyLeft"), "Align Left")}
        {toolbarBtn("Center", () => exec("justifyCenter"), "Center")}
        {toolbarBtn("Right", () => exec("justifyRight"), "Align Right")}
        {toolbarBtn("Justify", () => exec("justifyFull"), "Justify")}
        <div className="w-px h-5 bg-edsync-border mx-1" />

        {/* Lists */}
        {toolbarBtn("Bullets", () => exec("insertUnorderedList"), "Bullet List")}
        {toolbarBtn("Numbers", () => exec("insertOrderedList"), "Numbered List")}
        {toolbarBtn("Indent", () => exec("indent"), "Indent")}
        {toolbarBtn("Outdent", () => exec("outdent"), "Outdent")}

        <div className="w-px h-5 bg-edsync-border mx-1" />

        {/* Colors */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          title="Text color"
          className="text-xs text-edsync-subtle hover:text-edsync-text px-2 py-1 rounded hover:bg-edsync-muted/30 flex items-center gap-1"
        >
          <input
            type="color"
            className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
            onChange={(e) => exec("foreColor", e.target.value)}
          />
          <span>Color</span>
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          title="Highlight color"
          className="text-xs text-edsync-subtle hover:text-edsync-text px-2 py-1 rounded hover:bg-edsync-muted/30 flex items-center gap-1"
        >
          <input
            type="color"
            className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
            onChange={(e) => exec("hiliteColor", e.target.value)}
          />
          <span>Highlight</span>
        </button>

        <div className="w-px h-5 bg-edsync-border mx-1" />

        {/* Misc */}
        {toolbarBtn(
          "Line",
          () => exec("insertHorizontalRule"),
          "Horizontal Line",
        )}
        {toolbarBtn(
          "Link",
          () => {
            const url = prompt("Enter URL:");
            if (url) exec("createLink", url);
          },
          "Insert Link",
        )}
        {toolbarBtn(
          "Table",
          () =>
            insertHtml(
              "<table><tbody><tr><th>Item</th><th>Notes</th></tr><tr><td>Example</td><td>Add details</td></tr></tbody></table>",
            ),
          "Insert Table",
        )}
        {toolbarBtn(
          "Slide",
          () =>
            insertHtml(
              '<div class="lesson-slide"><h2>Slide title</h2><ul><li>Main point</li><li>Evidence</li><li>Student action</li></ul></div>',
            ),
          "Insert Slide Block",
        )}
        {toolbarBtn(
          "Callout",
          () =>
            insertHtml(
              '<aside class="lesson-callout"><strong>Remember</strong><p>Add a key reminder, warning, or example.</p></aside>',
            ),
          "Insert Callout",
        )}
        {toolbarBtn(
          "2 Col",
          () =>
            insertHtml(
              '<div class="lesson-columns"><section><h3>Concept</h3><p>Add explanation.</p></section><section><h3>Example</h3><p>Add application.</p></section></div>',
            ),
          "Insert Two Columns",
        )}
        {toolbarBtn(
          "Checklist",
          () =>
            insertHtml(
              '<ul class="lesson-checklist"><li>Step one or success criterion</li><li>Step two or evidence to submit</li><li>Reflection question</li></ul>',
            ),
          "Insert Checklist",
        )}
        {toolbarBtn(
          "Practice",
          () =>
            insertHtml(
              '<section class="lesson-practice-card"><h3>Practice Sprint</h3><p>Set a timer, answer the prompt, then compare with the model answer.</p><ol><li>Try it alone.</li><li>Check your reasoning.</li><li>Revise one part.</li></ol></section>',
            ),
          "Insert Practice Sprint",
        )}
        {toolbarBtn(
          "Spacer",
          () => insertHtml('<div class="lesson-spacer"></div>'),
          "Add Paragraph Spacing",
        )}
        {toolbarBtn("Clear", () => exec("removeFormat"), "Clear Formatting")}
      </div>

      {/* Editor body */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="rich-editor p-4 min-h-[260px] bg-edsync-card focus:outline-none text-sm"
        onInput={() => onChange(ref.current?.innerHTML || "")}
        onPaste={(e) => {
          // Paste as plain HTML but strip scripts
          const html = e.clipboardData.getData("text/html");
          if (html) {
            e.preventDefault();
            const clean = sanitizeHtml(html);
            document.execCommand("insertHTML", false, clean);
            onChange(ref.current?.innerHTML || "");
          }
        }}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-edsync-surface border-t border-edsync-border text-xs text-edsync-subtle">
        <span>Rich text editor - formatting is saved with the lesson</span>
        <span>{(ref.current?.innerText || "").length} chars</span>
      </div>
    </div>
  );
}

function SectionTemplateLibrary({
  onAdd,
}: {
  onAdd: (template: SectionTemplate) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {SECTION_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onAdd(template)}
          className="group rounded-lg border border-edsync-border bg-edsync-surface p-3 text-left transition hover:border-edsync-blue/50 hover:bg-edsync-blue/5"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-edsync-text">{template.label}</span>
            <span className="rounded-md border border-edsync-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-edsync-subtle">
              {template.contentType}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-edsync-subtle">{template.description}</p>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// QUESTION BUILDER (one question row)
// ─────────────────────────────────────────
interface QDraft {
  id?: string;
  question_text: string;
  question_type: QType;
  options: { id: string; text: string; is_correct: boolean }[];
  correct_answer: string;
  explanation: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  is_diagnostic: boolean;
  is_micro_check: boolean;
  is_final_quiz: boolean;
  section_id?: string | null;
}

const emptyQ = (overrides: Partial<QDraft> = {}): QDraft => ({
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
  is_diagnostic: false,
  is_micro_check: false,
  is_final_quiz: false,
  ...overrides,
});

function toQuestionDraft(question: QuizQuestion): QDraft {
  return {
    ...question,
    question_type: question.question_type === "matching" ? "multiple_choice" : question.question_type,
    options: question.options || emptyQ().options,
    correct_answer: question.correct_answer || "",
    explanation: question.explanation || "",
  };
}

function QuestionBuilder({
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
    fill_blank: " Fill in the Blank",
    short_answer: " Short Answer",
    long_answer: " Long Answer",
  };

  return (
    <div className="edsync-card border border-edsync-border space-y-4">
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

        <div className="flex gap-3 ml-auto text-xs">
          {(["is_diagnostic", "is_micro_check", "is_final_quiz"] as const).map(
            (k) => (
              <label
                key={k}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!q[k]}
                  onChange={(e) => set({ [k]: e.target.checked })}
                  className="rounded border-edsync-border"
                />
                <span className="text-edsync-subtle">
                  {k === "is_diagnostic"
                    ? "Pre-check"
                    : k === "is_micro_check"
                      ? "Micro-check"
                      : "Final quiz"}
                </span>
              </label>
            ),
          )}
        </div>

        <button
          onClick={onDelete}
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
                  name={`q-correct-${q.id || "new"}`}
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
                        id: String.fromCharCode(97 + q.options.length),
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
          Explanation (shown after student answers)
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

// ─────────────────────────────────────────
// SECTION EDITORS
// ─────────────────────────────────────────

// Image section
function ImageSectionEditor({
  section,
  onSave,
  edsync,
  lessonId,
}: {
  section: LessonSection;
  onSave: (id: string, u: Partial<LessonSection>) => Promise<void>;
  edsync: EdSyncClient;
  lessonId: string;
}) {
  const [caption, setCaption] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Parse existing content: "imgUrl|||caption"
    const parts = (section.content || "").split("|||");
    setImgUrl(parts[0] || "");
    setCaption(parts[1] || "");
  }, [section.content, section.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${lessonId}/${section.id}.${ext}`;
    const { data, error } = await edsync.storage
      .from("lesson-thumbnails")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }
    setImgUrl(data?.publicUrl || path);
    setUploading(false);
    toast.success("Image uploaded!");
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    await onSave(section.id, {
      content: `${imgUrl}|||${caption}`,
      metadata: { imgUrl, caption },
    });
  };
  const previewUrl = safeImageUrl(imgUrl);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-edsync-subtle mb-2">
          Image URL
        </label>
        <div className="flex gap-2">
          <input
            value={imgUrl}
            onChange={(e) => setImgUrl(e.target.value)}
            className="edsync-input py-2 flex-1 text-sm"
            placeholder="https://... or upload below"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-sm py-2 flex-shrink-0"
          >
            {uploading ? "" : " Upload"}
          </button>
        </div>
      </div>
      {previewUrl && (
        <div className="rounded-xl overflow-hidden border border-edsync-border">
          <Image
            src={previewUrl}
            alt={caption || "Section image"}
            width={1200}
            height={675}
            sizes="(max-width: 768px) 100vw, 960px"
            className="h-auto max-h-80 w-full object-contain bg-black/20"
          />
        </div>
      )}
      {imgUrl && !previewUrl && (
        <div className="rounded-xl border border-edsync-red/30 bg-edsync-red/10 p-3 text-sm text-edsync-red">
          Use a safe HTTPS image ending in PNG, JPG, JPEG, WEBP, or GIF. SVG, scripts, credentials, and executable links are blocked.
        </div>
      )}
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Caption (optional)
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="edsync-input py-2 text-sm"
          placeholder="Describe this image..."
        />
      </div>
      <button onClick={save} className="btn-primary text-sm py-2">
        ✓ Save Image Section
      </button>
    </div>
  );
}

// Video section
function VideoSectionEditor({
  section,
  onSave,
}: {
  section: LessonSection;
  onSave: (id: string, u: Partial<LessonSection>) => Promise<void>;
}) {
  const [url, setUrl] = useState(section.content || "");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    const parts = (section.content || "").split("|||");
    setUrl(parts[0] || "");
    setCaption(parts[1] || "");
  }, [section.content, section.id]);

  const media = classifySafeMediaUrl(url);
  const embed = media?.embedUrl ?? null;
  const isEmbeddable = Boolean(embed);

  const save = async () => {
    if (!media?.url) {
      toast.error("Use a valid HTTPS YouTube/Vimeo URL or direct video file.");
      return;
    }
    await onSave(section.id, { content: `${media.url}|||${caption}` });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Video URL (YouTube, Vimeo, or direct link)
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="edsync-input py-2 text-sm"
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>
      {url && isEmbeddable && embed && (
        <div className="rounded-xl overflow-hidden border border-edsync-border bg-black aspect-video">
          <iframe
            src={embed}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; encrypted-media; gyroscope"
          />
        </div>
      )}
      {url && media && !isEmbeddable && (
        <div className="p-4 bg-edsync-surface border border-edsync-border rounded-xl">
          {media?.kind === "video" ? (
            <video src={media.url} controls className="aspect-video w-full rounded-lg bg-black" />
          ) : (
            <p className="text-edsync-subtle text-sm">
              Safe HTTPS link set. Embed previews are only available for YouTube, Vimeo, and direct video files.
            </p>
          )}
        </div>
      )}
      {url && !media && (
        <div className="p-4 bg-edsync-red/10 border border-edsync-red/30 rounded-xl">
          <p className="text-edsync-red text-sm">
            This link is blocked. Use HTTPS YouTube/Vimeo URLs or direct MP4, WEBM, or MOV files.
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Caption (optional)
        </label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="edsync-input py-2 text-sm"
          placeholder="Describe this video..."
        />
      </div>
      <button onClick={save} className="btn-primary text-sm py-2">
        ✓ Save Video Section
      </button>
    </div>
  );
}

// Quiz section (inline questions for this section)
function QuizSectionEditor({
  section,
  lessonId,
  edsync,
  onSave,
}: {
  section: LessonSection;
  lessonId: string;
  edsync: EdSyncClient;
  onSave: (id: string, u: Partial<LessonSection>) => Promise<void>;
}) {
  const [questions, setQuestions] = useState<QDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(section.content || "Section Quiz");

  useEffect(() => {
    edsync
      .from("quiz_questions")
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("section_id", section.id)
      .then(({ data }: { data: QuizQuestion[] | null }) => {
        if (data?.length)
          setQuestions(data.map(toQuestionDraft));
        else setQuestions([emptyQ()]);
      });
  }, [edsync, lessonId, section.id]);

  const saveAll = async () => {
    setSaving(true);
    try {
      const validQuestions = questions.filter((q) => q.question_text.trim());
      if (validQuestions.length === 0) {
        toast.error(
          "Add at least one question before saving this quiz section.",
        );
        return;
      }

      await onSave(section.id, { content: title });

      const { error: deleteError } = await edsync
        .from("quiz_questions")
        .delete()
        .eq("lesson_id", lessonId)
        .eq("section_id", section.id);
      if (deleteError) {
        toast.error("Could not clear previous section questions.");
        return;
      }

      const rows = validQuestions.map((q, i) => ({
        lesson_id: lessonId,
        section_id: section.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options:
          q.question_type === "multiple_choice" ||
          q.question_type === "true_false"
            ? q.options?.length
              ? q.options
              : null
            : null,
        correct_answer: q.correct_answer || null,
        explanation: q.explanation || null,
        difficulty: q.difficulty,
        is_diagnostic: q.is_diagnostic,
        is_micro_check: q.is_micro_check,
        is_final_quiz: q.is_final_quiz,
        order_index: i,
      }));

      const { error: insertError } = await edsync
        .from("quiz_questions")
        .insert(rows);
      if (insertError) {
        toast.error("Could not save quiz questions: " + insertError.message);
        return;
      }

      toast.success("Quiz section saved!");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-edsync-subtle mb-1">
          Quiz title / instructions
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="edsync-input py-2 text-sm"
          placeholder="e.g. Check your understanding"
        />
      </div>
      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionBuilder
            key={i}
            q={q}
            onChange={(updated) =>
              setQuestions(questions.map((x, j) => (j === i ? updated : x)))
            }
            onDelete={() => setQuestions(questions.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setQuestions([...questions, emptyQ()])}
          className="btn-secondary text-sm py-2"
        >
          + Add Question
        </button>
        <button
          onClick={saveAll}
          disabled={saving}
          className="btn-primary text-sm py-2"
        >
          {saving ? " Saving..." : "✓ Save Quiz Section"}
        </button>
      </div>
    </div>
  );
}

// Activity / Discussion section editor
function ActivitySectionEditor({
  section,
  onSave,
  type,
}: {
  section: LessonSection;
  onSave: (id: string, u: Partial<LessonSection>) => Promise<void>;
  type: "activity" | "discussion";
}) {
  const [content, setContent] = useState(section.content || "");
  return (
    <div className="space-y-4">
      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder={
          type === "activity"
            ? "Describe the activity steps, materials, and instructions..."
            : "Write your discussion prompt and guiding questions..."
        }
      />
      <button
        onClick={() => onSave(section.id, { content })}
        className="btn-primary text-sm py-2"
      >
        ✓ Save
      </button>
    </div>
  );
}

// Full section editor wrapper
function SectionEditor({
  section,
  index,
  onSave,
  onDelete,
  onCancel,
  edsync,
  lessonId,
}: {
  section: LessonSection;
  index: number;
  onSave: (id: string, u: Partial<LessonSection>) => Promise<void>;
  onDelete: (id: string) => void;
  onCancel: () => void;
  edsync: EdSyncClient;
  lessonId: string;
}) {
  const [title, setTitle] = useState(section.title);
  const [contentType, setContentType] = useState<ContentType>(
    section.content_type,
  );
  const [content, setContent] = useState(section.content || "");
  const [duration, setDuration] = useState(section.duration_minutes);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = async (t: ContentType) => {
    setContentType(t);
    // Save type immediately to DB
    await edsync
      .from("lesson_sections")
      .update({ content_type: t, title })
      .eq("id", section.id);
  };

  const handleSaveText = async () => {
    setSaving(true);
    await onSave(section.id, {
      title,
      content,
      content_type: contentType,
      duration_minutes: duration,
    });
    setSaving(false);
  };

  const TYPE_ICONS: Record<ContentType, string> = {
    text: "",
    video: "",
    image: "",
    quiz: "",
    activity: "",
    discussion: "",
  };

  return (
    <div className="border-2 border-edsync-blue/40 rounded-2xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-edsync-blue/5 border-b border-edsync-blue/20">
        <span className="w-7 h-7 rounded-lg bg-edsync-blue text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="edsync-input py-1.5 font-semibold flex-1 text-sm"
          placeholder="Section title..."
        />

        {/* Type selector */}
        <div className="flex gap-1 flex-shrink-0">
          {(
            [
              "text",
              "image",
              "video",
              "quiz",
              "activity",
              "discussion",
            ] as ContentType[]
          ).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              title={t}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${contentType === t ? "bg-edsync-blue text-white" : "bg-edsync-card text-edsync-subtle hover:text-edsync-text border border-edsync-border"}`}
            >
              {TYPE_ICONS[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={120}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="edsync-input py-1.5 w-14 text-xs text-center"
            title="Duration (minutes)"
          />
          <span className="text-xs text-edsync-subtle">min</span>
        </div>
        <button
          onClick={onCancel}
          className="btn-ghost text-xs py-1 px-3 flex-shrink-0"
        >
          Close
        </button>
      </div>

      {/* Content area based on type */}
      <div className="p-4">
        {(contentType === "text" || contentType === undefined) && (
          <div className="space-y-3">
            <RichTextEditor value={content} onChange={setContent} />
            <div className="flex gap-2">
              <button
                onClick={handleSaveText}
                disabled={saving}
                className="btn-primary text-sm py-2"
              >
                {saving ? " Saving..." : "✓ Save Section"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this section?")) onDelete(section.id);
                }}
                className="btn-ghost text-sm py-2 text-edsync-red"
              >
                Delete
              </button>
            </div>
          </div>
        )}
        {contentType === "image" && (
          <ImageSectionEditor
            section={{ ...section, content }}
            onSave={async (id, u) => {
              await onSave(id, {
                ...u,
                title,
                content_type: contentType,
                duration_minutes: duration,
              });
            }}
            edsync={edsync}
            lessonId={lessonId}
          />
        )}
        {contentType === "video" && (
          <VideoSectionEditor
            section={{ ...section, content }}
            onSave={async (id, u) => {
              await onSave(id, {
                ...u,
                title,
                content_type: contentType,
                duration_minutes: duration,
              });
            }}
          />
        )}
        {contentType === "quiz" && (
          <QuizSectionEditor
            section={{ ...section, content, content_type: contentType }}
            lessonId={lessonId}
            edsync={edsync}
            onSave={async (id, u) => {
              await onSave(id, {
                ...u,
                title,
                content_type: contentType,
                duration_minutes: duration,
              });
            }}
          />
        )}
        {(contentType === "activity" || contentType === "discussion") && (
          <ActivitySectionEditor
            section={{ ...section, content, content_type: contentType }}
            type={contentType}
            onSave={async (id, u) => {
              await onSave(id, {
                ...u,
                title,
                content_type: contentType,
                duration_minutes: duration,
              });
            }}
          />
        )}
        {contentType !== "text" && contentType !== undefined && (
          <div className="mt-3 pt-3 border-t border-edsync-border">
            <button
              onClick={() => {
                if (confirm("Delete this section?")) onDelete(section.id);
              }}
              className="btn-ghost text-sm py-2 text-edsync-red"
            >
              Delete Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function TeacherLessonDetail() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;
  const edsync = useMemo(() => createClient(), []);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qDrafts, setQDrafts] = useState<QDraft[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<
    { class_id: string; class_name: string; created_at: string }[]
  >([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Controlled overview
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(45);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [complexity, setComplexity] = useState(50);
  const [pacing, setPacing] = useState(50);
  const [scaffolding, setScaffolding] = useState(50);
  const [overviewDirty, setOverviewDirty] = useState(false);

  // Glossary editing
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(
    null,
  );
  const [newTerm, setNewTerm] = useState({
    term: "",
    definition: "",
    example: "",
  });
  const [addingTerm, setAddingTerm] = useState(false);

  // Questions saving
  const [savingQ, setSavingQ] = useState(false);

  const loadAll = useCallback(async () => {
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) return;

    const [
      lessonRes,
      sectionsRes,
      questionsRes,
      glossaryRes,
      classesRes,
      assignRes,
    ] = await Promise.all([
      edsync.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
      edsync
        .from("lesson_sections")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index"),
      edsync
        .from("quiz_questions")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("order_index"),
      edsync
        .from("glossary_terms")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at"),
      edsync
        .from("classes")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("is_active", true)
        .order("name"),
      edsync
        .from("lesson_assignments")
        .select("class_id, created_at, classes(name)")
        .eq("lesson_id", lessonId)
        .eq("is_active", true),
    ]);

    const l = lessonRes.data;
    if (l) {
      setLesson(l);
      setTitle(l.title || "");
      setDescription(l.description || "");
      setSubject(l.subject || "");
      setDuration(l.estimated_duration || 45);
      setDifficulty(l.difficulty || "intermediate");
      setObjectives(l.objectives || []);
      setComplexity(l.complexity_slider ?? 50);
      setPacing(l.pacing_slider ?? 50);
      setScaffolding(l.scaffolding_slider ?? 50);
    }
    setSections(sectionsRes.data || []);
    const qs: QuizQuestion[] = questionsRes.data || [];
    setQuestions(qs);
    // Only load non-section questions into the question bank drafts
    setQDrafts(
      qs
        .filter((q) => !q.section_id || q.section_id === null)
        .map(toQuestionDraft),
    );
    setGlossary(glossaryRes.data || []);
    setMyClasses(classesRes.data || []);
    setAssignments(
      ((assignRes.data || []) as AssignmentRow[]).map((a) => ({
        class_id: a.class_id,
        class_name: a.classes?.name || "",
        created_at: a.created_at,
      })),
    );
    setLoading(false);
  }, [edsync, lessonId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveOverview = async () => {
    setSaving(true);
    const updates = {
      title,
      description,
      subject,
      estimated_duration: duration,
      difficulty,
      objectives: objectives.filter(Boolean),
      complexity_slider: complexity,
      pacing_slider: pacing,
      scaffolding_slider: scaffolding,
    };
    const { error } = await edsync
      .from("lessons")
      .update(updates)
      .eq("id", lessonId);
    if (error) toast.error("Save failed: " + error.message);
    else {
      setLesson((l) => (l ? { ...l, ...updates } : l));
      setOverviewDirty(false);
      toast.success("Saved!");
    }
    setSaving(false);
  };

  const changeStatus = async (status: "draft" | "published" | "archived") => {
    await edsync.from("lessons").update({ status }).eq("id", lessonId);
    setLesson((l) => (l ? { ...l, status } : l));
    toast.success(
      status === "published"
        ? " Published!"
        : status === "draft"
          ? "Moved to draft"
          : "Archived",
    );
  };

  const saveSection = async (
    sectionId: string,
    updates: Partial<LessonSection>,
  ) => {
    const { error } = await edsync
      .from("lesson_sections")
      .update(updates)
      .eq("id", sectionId);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    setSections((s) =>
      s.map((sec) => (sec.id === sectionId ? { ...sec, ...updates } : sec)),
    );
    setEditingSectionId(null);
    toast.success("Section saved!");
  };

  const persistSectionOrder = async (nextSections: LessonSection[]) => {
    await Promise.all(
      nextSections.map((section, index) =>
        edsync
          .from("lesson_sections")
          .update({ order_index: index })
          .eq("id", section.id),
      ),
    );
  };

  const addSection = async (template: SectionTemplate = SECTION_TEMPLATES[0]) => {
    const { data, error } = await edsync
      .from("lesson_sections")
      .insert({
        lesson_id: lessonId,
        title: template.title,
        content: template.content,
        content_type: template.contentType,
        order_index: sections.length,
        duration_minutes: template.durationMinutes,
        metadata: { template_id: template.id, template_category: template.category },
      })
      .select()
      .single();
    if (error) {
      toast.error("Could not add section");
      return;
    }
    setSections((s) => [...s, data]);
    setEditingSectionId(data.id);
  };

  const moveSection = async (id: string, direction: -1 | 1) => {
    const currentIndex = sections.findIndex((section) => section.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) return;

    const nextSections = [...sections];
    [nextSections[currentIndex], nextSections[nextIndex]] = [
      nextSections[nextIndex],
      nextSections[currentIndex],
    ];
    const ordered = nextSections.map((section, index) => ({ ...section, order_index: index }));
    setSections(ordered);
    await persistSectionOrder(ordered);
    toast.success("Section moved");
  };

  const duplicateSection = async (section: LessonSection) => {
    const insertIndex = sections.findIndex((item) => item.id === section.id) + 1;
    const { data, error } = await edsync
      .from("lesson_sections")
      .insert({
        lesson_id: lessonId,
        title: `${section.title} Copy`,
        content: section.content || "",
        content_type: section.content_type,
        order_index: insertIndex,
        duration_minutes: section.duration_minutes,
        metadata: { ...(section.metadata || {}), duplicated_from: section.id },
      })
      .select()
      .single();

    if (error) {
      toast.error("Could not duplicate section");
      return;
    }

    const nextSections = [
      ...sections.slice(0, insertIndex),
      data,
      ...sections.slice(insertIndex),
    ].map((item, index) => ({ ...item, order_index: index }));

    setSections(nextSections);
    await persistSectionOrder(nextSections);
    setEditingSectionId(data.id);
    toast.success("Section duplicated");
  };

  const deleteSection = async (id: string) => {
    await edsync.from("lesson_sections").delete().eq("id", id);
    const nextSections = sections
      .filter((sec) => sec.id !== id)
      .map((section, index) => ({ ...section, order_index: index }));
    setSections(nextSections);
    await persistSectionOrder(nextSections);
    setEditingSectionId(null);
    toast.success("Section deleted");
  };

  // Glossary ops
  const addGlossaryTerm = async () => {
    if (!newTerm.term.trim() || !newTerm.definition.trim()) {
      toast.error("Term and definition required");
      return;
    }
    const { data, error } = await edsync
      .from("glossary_terms")
      .insert({ lesson_id: lessonId, ...newTerm })
      .select()
      .single();
    if (error) {
      toast.error("Could not add term");
      return;
    }
    setGlossary((g) => [...g, data]);
    setNewTerm({ term: "", definition: "", example: "" });
    setAddingTerm(false);
    toast.success("Term added!");
  };

  const updateGlossaryTerm = async (
    id: string,
    updates: Partial<GlossaryTerm>,
  ) => {
    await edsync.from("glossary_terms").update(updates).eq("id", id);
    setGlossary((g) => g.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    setEditingGlossaryId(null);
    toast.success("Term updated");
  };

  const deleteGlossaryTerm = async (id: string) => {
    await edsync.from("glossary_terms").delete().eq("id", id);
    setGlossary((g) => g.filter((t) => t.id !== id));
    toast.success("Term removed");
  };

  // Questions save
  const saveQuestions = async () => {
    setSavingQ(true);
    // Delete non-section questions, re-insert
    await edsync
      .from("quiz_questions")
      .delete()
      .eq("lesson_id", lessonId)
      .is("section_id", null);
    const toInsert = qDrafts
      .filter((q) => q.question_text.trim())
      .map((q, i) => ({
        lesson_id: lessonId,
        section_id: null,
        question_text: q.question_text,
        question_type: q.question_type,
        options:
          q.question_type === "multiple_choice" ||
          q.question_type === "true_false"
            ? q.options
            : null,
        correct_answer: q.correct_answer || null,
        explanation: q.explanation || null,
        difficulty: q.difficulty,
        is_diagnostic: q.is_diagnostic,
        is_micro_check: q.is_micro_check,
        is_final_quiz: q.is_final_quiz,
        order_index: i,
      }));
    if (toInsert.length > 0)
      await edsync.from("quiz_questions").insert(toInsert);
    await loadAll();
    setSavingQ(false);
    toast.success("Questions saved!");
  };

  // Assign
  const assignToClass = async () => {
    if (!assignClassId) {
      toast.error("Pick a class");
      return;
    }
    setAssigning(true);
    const {
      data: { user },
    } = await edsync.auth.getUser();
    if (!user) {
      setAssigning(false);
      return;
    }
    if (assignments.find((a) => a.class_id === assignClassId)) {
      toast.error("Already assigned");
      setAssigning(false);
      return;
    }
    const { error } = await edsync.from("lesson_assignments").insert({
      lesson_id: lessonId,
      class_id: assignClassId,
      assigned_by: user.id,
      due_date: assignDueDate || null,
      is_active: true,
    });
    if (error) {
      toast.error("Failed: " + error.message);
      setAssigning(false);
      return;
    }
    const cls = myClasses.find((c) => c.id === assignClassId);
    setAssignments((a) => [
      ...a,
      {
        class_id: assignClassId,
        class_name: cls?.name || "",
        created_at: new Date().toISOString(),
      },
    ]);
    if (lesson?.status !== "published") await changeStatus("published");
    await fetch("/api/notifications/lesson-assigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lessonId,
        classId: assignClassId,
        dueDate: assignDueDate || null,
      }),
    });
    setAssignClassId("");
    setAssignDueDate("");
    setAssigning(false);
    toast.success(`Assigned to ${cls?.name}!`);
  };

  const unassign = async (classId: string) => {
    await edsync
      .from("lesson_assignments")
      .update({ is_active: false })
      .eq("lesson_id", lessonId)
      .eq("class_id", classId);
    setAssignments((a) => a.filter((x) => x.class_id !== classId));
    toast.success("Assignment removed");
  };

  const TYPE_INFO: Record<string, { icon: string; color: string }> = {
    text: { icon: "T", color: "blue" },
    image: { icon: "I", color: "purple" },
    video: { icon: "V", color: "red" },
    quiz: { icon: "Q", color: "amber" },
    activity: { icon: "A", color: "emerald" },
    discussion: { icon: "D", color: "cyan" },
  };
  const lessonPackage = useMemo(
    () => (lesson ? lessonRowsToLearningObject({ lesson, sections, questions }) : null),
    [lesson, sections, questions],
  );
  const packageSummary = useMemo(
    () => (lessonPackage ? summarizeLearningObject(lessonPackage) : null),
    [lessonPackage],
  );

  if (loading)
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-10 w-64 bg-edsync-card rounded-xl shimmer mb-6" />
        <div className="h-64 bg-edsync-card rounded-2xl shimmer" />
      </div>
    );

  if (!lesson)
    return (
      <div className="p-6 text-center">
        <p className="text-edsync-subtle">Lesson not found.</p>
        <button
          onClick={() => router.push("/teacher/lessons")}
          className="btn-primary mt-4"
        >
          Back
        </button>
      </div>
    );

  const badge = getStatusBadge(lesson.status);

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => router.push("/teacher/lessons")}
            className="btn-ghost mt-1 flex-shrink-0"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              {lesson.ai_generated && (
                <span className="badge bg-edsync-purple/10 text-edsync-purple border-edsync-purple/20">
                  AI
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-2xl text-edsync-text">
              {lesson.title}
            </h1>
            <p className="text-edsync-subtle text-xs mt-0.5">
              Updated {formatRelativeTime(lesson.updated_at)} ·{" "}
              {sections.length} sections ·{" "}
              {questions.filter((q) => !q.section_id).length} questions
            </p>
            {lessonPackage && packageSummary && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-edsync-subtle">
                <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1">
                  {getLearningStateLabel(lessonPackage.state)}
                </span>
                <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1">
                  {packageSummary.total} learning blocks
                </span>
                <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1">
                  {packageSummary.estimatedMinutes} min package
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {lesson.status !== "published" && (
            <button
              onClick={() => changeStatus("published")}
              className="btn-primary text-sm py-2"
            >
              Publish
            </button>
          )}
          {lesson.status === "published" && (
            <button
              onClick={() => changeStatus("draft")}
              className="btn-secondary text-sm py-2"
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-edsync-border mb-6 overflow-x-auto">
        {[
          { key: "overview" as Tab, label: "Overview" },
          { key: "sections" as Tab, label: `Sections (${sections.length})` },
          {
            key: "questions" as Tab,
            label: `Questions (${qDrafts.length})`,
          },
          { key: "glossary" as Tab, label: `Glossary (${glossary.length})` },
          {
            key: "assign" as Tab,
            label: `Assign${assignments.length > 0 ? ` (${assignments.length})` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${tab === t.key ? "border-edsync-blue text-edsync-blue" : "border-transparent text-edsync-subtle hover:text-edsync-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2 space-y-4">
            <div className="edsync-card">
              <label className="block text-xs font-medium text-edsync-subtle mb-1">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setOverviewDirty(true);
                }}
                className="edsync-input font-display font-bold text-xl"
              />
            </div>
            <div className="edsync-card">
              <label className="block text-xs font-medium text-edsync-subtle mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setOverviewDirty(true);
                }}
                rows={3}
                className="edsync-textarea"
                placeholder="Overview for students..."
              />
            </div>
            <div className="edsync-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-edsync-text">
                  Learning Objectives
                </h3>
                <button
                  onClick={() => {
                    setObjectives((o) => [...o, ""]);
                    setOverviewDirty(true);
                  }}
                  className="text-edsync-blue text-xs hover:underline"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-edsync-blue font-bold text-sm w-5 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <input
                      value={obj}
                      onChange={(e) => {
                        const o = [...objectives];
                        o[i] = e.target.value;
                        setObjectives(o);
                        setOverviewDirty(true);
                      }}
                      className="edsync-input py-2 flex-1"
                      placeholder={`Objective ${i + 1}...`}
                    />
                    <button
                      onClick={() => {
                        setObjectives((o) => o.filter((_, j) => j !== i));
                        setOverviewDirty(true);
                      }}
                      className="text-edsync-subtle hover:text-edsync-red text-lg"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {objectives.length === 0 && (
                  <p className="text-xs text-edsync-subtle">
                    No objectives yet. Click + Add.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="edsync-card space-y-3">
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setOverviewDirty(true);
                  }}
                  className="edsync-input py-2"
                  placeholder="e.g. Biology"
                />
              </div>
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => {
                    setDuration(Number(e.target.value));
                    setOverviewDirty(true);
                  }}
                  className="edsync-input py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    setDifficulty(e.target.value as DifficultyLevel);
                    setOverviewDirty(true);
                  }}
                  className="edsync-input py-2"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="edsync-card">
              <h3 className="font-semibold text-edsync-text mb-3 text-sm">
                Differentiation
              </h3>
              {[
                {
                  label: "Complexity",
                  val: complexity,
                  set: (v: number) => {
                    setComplexity(v);
                    setOverviewDirty(true);
                  },
                  color: "#4F86F7",
                },
                {
                  label: "Pacing",
                  val: pacing,
                  set: (v: number) => {
                    setPacing(v);
                    setOverviewDirty(true);
                  },
                  color: "#F5A623",
                },
                {
                  label: "Scaffolding",
                  val: scaffolding,
                  set: (v: number) => {
                    setScaffolding(v);
                    setOverviewDirty(true);
                  },
                  color: "#23D18B",
                },
              ].map((s) => (
                <div key={s.label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-edsync-subtle">{s.label}</span>
                    <span style={{ color: s.color }} className="font-bold">
                      {s.val}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={s.val}
                    onChange={(e) => s.set(Number(e.target.value))}
                    style={{ accentColor: s.color }}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
            {overviewDirty && (
              <button
                onClick={saveOverview}
                disabled={saving}
                className="btn-primary w-full justify-center py-3 glow-blue"
              >
                {saving ? " Saving..." : " Save Changes"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SECTIONS ── */}
      {tab === "sections" && (
        <div className="animate-fade-in space-y-3">
          <div className="rounded-lg border border-edsync-border bg-edsync-card p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-edsync-text">Section Library</h2>
                <p className="text-xs text-edsync-subtle">
                  Add teaching, slide, activity, media, discussion, or quiz blocks.
                </p>
              </div>
              <button onClick={() => addSection()} className="btn-primary text-sm py-2">
                Blank section
              </button>
            </div>
            <SectionTemplateLibrary onAdd={addSection} />
          </div>

          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-edsync-subtle">
              Reorder, duplicate, and edit sections from this outline.
            </p>
            <button onClick={() => addSection()} className="btn-primary text-sm py-2">
              Add Section
            </button>
          </div>

          {sections.length === 0 && (
            <div className="edsync-card text-center py-12">
              <p className="text-edsync-text font-medium mb-4">
                No sections yet
              </p>
              <button onClick={() => addSection()} className="btn-primary">
                Add First Section
              </button>
            </div>
          )}

          {sections.map((sec, i) =>
            editingSectionId === sec.id ? (
              <SectionEditor
                key={sec.id}
                section={sec}
                index={i}
                onSave={saveSection}
                onDelete={deleteSection}
                onCancel={() => setEditingSectionId(null)}
                edsync={edsync}
                lessonId={lessonId}
              />
            ) : (
              <div
                key={sec.id}
                className="edsync-card border border-edsync-border hover:border-edsync-blue/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-edsync-muted/30 text-edsync-subtle text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-lg flex-shrink-0">
                    {TYPE_INFO[sec.content_type]?.icon || ""}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-edsync-text text-sm">
                      {sec.title}
                    </p>
                    <p className="text-xs text-edsync-subtle mt-0.5">
                      <span
                        className={`badge bg-edsync-${TYPE_INFO[sec.content_type]?.color || "blue"}/10 text-edsync-${TYPE_INFO[sec.content_type]?.color || "blue"} border-edsync-${TYPE_INFO[sec.content_type]?.color || "blue"}/20 mr-2`}
                      >
                        {sec.content_type}
                      </span>
                      {sec.content
                        ? sec.content.startsWith("<")
                          ? "Has rich text content"
                          : sec.content.slice(0, 80) +
                            (sec.content.length > 80 ? "…" : "")
                        : "Empty — click Edit"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
                    <span className="text-xs text-edsync-subtle">
                      {sec.duration_minutes}m
                    </span>
                    <button
                      onClick={() => moveSection(sec.id, -1)}
                      disabled={i === 0}
                      className="btn-ghost px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      title="Move up"
                    >
                      Up
                    </button>
                    <button
                      onClick={() => moveSection(sec.id, 1)}
                      disabled={i === sections.length - 1}
                      className="btn-ghost px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      title="Move down"
                    >
                      Down
                    </button>
                    <button
                      onClick={() => duplicateSection(sec)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => setEditingSectionId(sec.id)}
                      className="btn-ghost text-xs py-1 px-3"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}

          {sections.length > 0 && editingSectionId === null && (
            <button
              onClick={() => addSection()}
              className="w-full py-4 border-2 border-dashed border-edsync-border rounded-2xl text-edsync-subtle hover:border-edsync-blue hover:text-edsync-blue transition-all text-sm"
            >
              Add Section
            </button>
          )}
        </div>
      )}

      {/* ── QUESTIONS ── */}
      {tab === "questions" && (
        <div className="animate-fade-in space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-2">
            {[
              {
                label: "Pre-check (Diagnostic)",
                count: qDrafts.filter((q) => q.is_diagnostic).length,
                color: "purple",
              },
              {
                label: "Micro-check",
                count: qDrafts.filter((q) => q.is_micro_check).length,
                color: "cyan",
              },
              {
                label: "Final Quiz",
                count: qDrafts.filter((q) => q.is_final_quiz).length,
                color: "amber",
              },
            ].map((s, i) => (
              <div key={i} className="edsync-card py-3 px-4">
                <p className="text-xs text-edsync-subtle mb-1">{s.label}</p>
                <p
                  className={`font-display font-bold text-2xl text-edsync-${s.color}`}
                >
                  {s.count}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-edsync-blue/5 border border-edsync-blue/20 rounded-xl text-xs text-edsync-subtle">
            <strong className="text-edsync-text">How it works:</strong> Pre-check
            questions appear before the lesson starts. Micro-check questions
            appear after a specific section. Final quiz questions appear at the
            end. Quiz sections (created in Sections tab) appear inline during
            the lesson.
          </div>

          {qDrafts.length === 0 && (
            <div className="edsync-card text-center py-10">
              <p className="text-edsync-text font-medium mb-4">
                No questions yet. Add pre-checks, micro-checks, or final quiz
                questions.
              </p>
            </div>
          )}

          {qDrafts.map((q, i) => (
            <QuestionBuilder
              key={i}
              q={q}
              onChange={(updated) =>
                setQDrafts(qDrafts.map((x, j) => (j === i ? updated : x)))
              }
              onDelete={() => setQDrafts(qDrafts.filter((_, j) => j !== i))}
            />
          ))}

          <div className="flex gap-3 sticky bottom-4">
            <button
              onClick={() =>
                setQDrafts((d) => [...d, emptyQ({ is_diagnostic: true })])
              }
              className="btn-secondary text-sm py-2 flex-1 justify-center"
            >
              + Pre-check
            </button>
            <button
              onClick={() =>
                setQDrafts((d) => [...d, emptyQ({ is_micro_check: true })])
              }
              className="btn-secondary text-sm py-2 flex-1 justify-center"
            >
              + Micro-check
            </button>
            <button
              onClick={() =>
                setQDrafts((d) => [...d, emptyQ({ is_final_quiz: true })])
              }
              className="btn-secondary text-sm py-2 flex-1 justify-center"
            >
              + Final Quiz Q
            </button>
            <button
              onClick={saveQuestions}
              disabled={savingQ}
              className="btn-primary text-sm py-2 flex-1 justify-center glow-blue"
            >
              {savingQ ? " Saving..." : " Save All Questions"}
            </button>
          </div>
        </div>
      )}

      {/* ── GLOSSARY ── */}
      {tab === "glossary" && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg text-edsync-text">
              Glossary Terms
            </h2>
            <button
              onClick={() => setAddingTerm(true)}
              className="btn-primary text-sm py-2"
            >
              + Add Term
            </button>
          </div>

          {/* Add new term form */}
          {addingTerm && (
            <div className="edsync-card border-2 border-edsync-blue/40 space-y-3">
              <h3 className="font-semibold text-edsync-text text-sm">
                New Glossary Term
              </h3>
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Term *
                </label>
                <input
                  value={newTerm.term}
                  onChange={(e) =>
                    setNewTerm((t) => ({ ...t, term: e.target.value }))
                  }
                  className="edsync-input py-2"
                  placeholder="e.g. Photosynthesis"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Definition *
                </label>
                <textarea
                  value={newTerm.definition}
                  onChange={(e) =>
                    setNewTerm((t) => ({ ...t, definition: e.target.value }))
                  }
                  rows={2}
                  className="edsync-textarea"
                  placeholder="Clear, student-friendly definition..."
                />
              </div>
              <div>
                <label className="block text-xs text-edsync-subtle mb-1">
                  Example (optional)
                </label>
                <input
                  value={newTerm.example}
                  onChange={(e) =>
                    setNewTerm((t) => ({ ...t, example: e.target.value }))
                  }
                  className="edsync-input py-2"
                  placeholder="e.g. Plants use photosynthesis to turn sunlight into sugar"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAddingTerm(false);
                    setNewTerm({ term: "", definition: "", example: "" });
                  }}
                  className="btn-secondary text-sm py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={addGlossaryTerm}
                  className="btn-primary text-sm py-2"
                >
                  Add Term
                </button>
              </div>
            </div>
          )}

          {glossary.length === 0 && !addingTerm ? (
            <div className="edsync-card text-center py-12">
              <p className="text-edsync-text font-medium mb-4">
                No glossary terms yet
              </p>
              <button
                onClick={() => setAddingTerm(true)}
                className="btn-primary"
              >
                + Add First Term
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {glossary.map((term) =>
                editingGlossaryId === term.id ? (
                  <GlossaryEditCard
                    key={term.id}
                    term={term}
                    onSave={updateGlossaryTerm}
                    onCancel={() => setEditingGlossaryId(null)}
                  />
                ) : (
                  <div key={term.id} className="edsync-card group relative">
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingGlossaryId(term.id)}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this term?"))
                            deleteGlossaryTerm(term.id);
                        }}
                        className="btn-ghost text-xs py-1 px-2 text-edsync-red"
                      >
                        ×
                      </button>
                    </div>
                    <p className="font-display font-bold text-edsync-text pr-14">
                      {term.term}
                    </p>
                    <p className="text-edsync-subtle text-sm mt-1">
                      {term.definition}
                    </p>
                    {term.example && (
                      <p className="text-edsync-cyan text-xs mt-2 italic">
                        e.g. {term.example}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ASSIGN ── */}
      {tab === "assign" && (
        <div className="animate-fade-in space-y-6">
          {assignments.length > 0 && (
            <div className="edsync-card">
              <h3 className="font-semibold text-edsync-text mb-4">
                Currently Assigned
              </h3>
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.class_id}
                    className="flex items-center justify-between p-3 bg-edsync-surface rounded-xl border border-edsync-border"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-edsync-text text-sm">
                          {a.class_name}
                        </p>
                        <p className="text-xs text-edsync-subtle">
                          Assigned {formatRelativeTime(a.created_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Remove?")) unassign(a.class_id);
                      }}
                      className="text-edsync-subtle hover:text-edsync-red text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="edsync-card">
            <h3 className="font-semibold text-edsync-text mb-1">
              Assign to Class
            </h3>
            <p className="text-edsync-subtle text-sm mb-4">
              Students in that class will see this lesson in their dashboard.
              {lesson.status !== "published" && (
                <span className="text-edsync-amber">
                  {" "}
                  Lesson auto-publishes on assign.
                </span>
              )}
            </p>
            {myClasses.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-edsync-subtle text-sm mb-3">
                  No classes yet.
                </p>
                <button
                  onClick={() => router.push("/teacher/students")}
                  className="btn-secondary text-sm"
                >
                  Go create a class →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-edsync-subtle mb-1">
                    Class *
                  </label>
                  <select
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className="edsync-input py-2"
                  >
                    <option value="">— Choose a class —</option>
                    {myClasses
                      .filter(
                        (c) => !assignments.find((a) => a.class_id === c.id),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.subject ? ` · ${c.subject}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-edsync-subtle mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="edsync-input py-2 w-48"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <button
                  onClick={assignToClass}
                  disabled={assigning || !assignClassId}
                  className="btn-primary py-3 px-8 glow-blue disabled:opacity-40"
                >
                  {assigning ? " Assigning..." : " Assign Lesson"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline glossary edit card
function GlossaryEditCard({
  term,
  onSave,
  onCancel,
}: {
  term: GlossaryTerm;
  onSave: (id: string, u: Partial<GlossaryTerm>) => Promise<void>;
  onCancel: () => void;
}) {
  const [t, setT] = useState(term.term);
  const [d, setD] = useState(term.definition);
  const [e, setE] = useState(term.example || "");
  return (
    <div className="edsync-card border-2 border-edsync-blue/40 space-y-2">
      <input
        value={t}
        onChange={(ev) => setT(ev.target.value)}
        className="edsync-input py-1.5 font-bold text-sm"
        placeholder="Term"
      />
      <textarea
        value={d}
        onChange={(ev) => setD(ev.target.value)}
        rows={2}
        className="edsync-textarea text-sm"
        placeholder="Definition..."
      />
      <input
        value={e}
        onChange={(ev) => setE(ev.target.value)}
        className="edsync-input py-1.5 text-xs"
        placeholder="Example..."
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost text-xs py-1">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave(term.id, { term: t, definition: d, example: e })
          }
          className="btn-primary text-xs py-1"
        >
          Save
        </button>
      </div>
    </div>
  );
}
