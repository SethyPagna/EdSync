"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { createClient } from "@/lib/edsync/client";
import { SECTION_INSERT_TOOLS } from "@/lib/content/section-library";
import LessonBlockEditor from "@/components/lesson/LessonBlockEditor";
import { classifySafeMediaUrl, safeImageUrl } from "@/lib/security/media";
import type { ContentType, LessonSection, QuizQuestion } from "@/types";
import { QuestionBuilder, emptyQ, toQuestionDraft, type QDraft } from "./QuestionBuilder";
import { persistQuestions } from "./persistQuestions";
import { useConfirm } from "@/components/ui";

type EdSyncClient = ReturnType<typeof createClient>;

// Section editors

// Image block
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
    const restoreTimer = window.setTimeout(() => {
      // Parse existing content: "imgUrl|||caption"
      const parts = (section.content || "").split("|||");
      setImgUrl(parts[0] || "");
      setCaption(parts[1] || "");
    }, 0);
    return () => window.clearTimeout(restoreTimer);
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
            alt={caption || "Lesson image"}
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
        Save image block
      </button>
    </div>
  );
}

// Video block
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
    const restoreTimer = window.setTimeout(() => {
      const parts = (section.content || "").split("|||");
      setUrl(parts[0] || "");
      setCaption(parts[1] || "");
    }, 0);
    return () => window.clearTimeout(restoreTimer);
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
        Save video block
      </button>
    </div>
  );
}

// Quiz block (inline questions for this page)
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
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(section.content || "Block Quiz");

  useEffect(() => {
    edsync
      .from("quiz_questions")
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("section_id", section.id)
      .then(({ data, error: loadError }: { data: QuizQuestion[] | null; error: { message: string } | null }) => {
        if (loadError) { setError(loadError.message); return; }
        setSavedIds((data || []).map((item) => item.id));
        if (data?.length)
          setQuestions(data.map(toQuestionDraft));
        else setQuestions([emptyQ({ section_id: section.id })]);
      });
  }, [edsync, lessonId, section.id]);

  const saveAll = async () => {
    setSaving(true);
    setError("");
    try {
      const validQuestions = questions.filter((q) => q.question_text.trim());
      if (validQuestions.length === 0) {
        setError("Add at least one question before saving this quiz block.");
        return;
      }
      await persistQuestions({ edsync, lessonId, sectionId: section.id, drafts: validQuestions, savedIds });
      await onSave(section.id, { content: title });
      const { data, error: reloadError } = await edsync.from("quiz_questions").select("*").eq("lesson_id", lessonId).eq("section_id", section.id).order("order_index");
      if (reloadError) throw new Error(reloadError.message);
      setQuestions((data || []).map(toQuestionDraft));
      setSavedIds((data || []).map((item: QuizQuestion) => item.id));
      toast.success("Quiz block saved!");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quiz block was not saved.");
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
            key={q.clientKey}
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
          onClick={() => setQuestions([...questions, emptyQ({ section_id: section.id })])}
          className="btn-secondary text-sm py-2"
        >
          + Add Question
        </button>
        <button
          onClick={saveAll}
          disabled={saving}
          className="btn-primary text-sm py-2"
        >
          {saving ? " Saving..." : "Save quiz block"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

// Activity / Discussion block editor
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
      <LessonBlockEditor
        value={content}
        onChange={setContent}
        insertTools={SECTION_INSERT_TOOLS}
        contentTypeLabel={type === "activity" ? "Activity" : "Discussion"}
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

// Full lesson block editor wrapper
export function SectionEditor({
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
  const confirm = useConfirm();
  const [title, setTitle] = useState(section.title);
  const [contentType, setContentType] = useState<ContentType>(
    section.content_type,
  );
  const [content, setContent] = useState(section.content || "");
  const [duration, setDuration] = useState(section.duration_minutes);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (type: ContentType) => setContentType(type);
  const removeBlock = async () => {
    if (await confirm({ title: `Delete ${section.title}?`, body: "This block and its content will be removed.", confirmLabel: "Delete block", danger: true })) onDelete(section.id);
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
    text: "T",
    video: "Video",
    image: "Image",
    quiz: "Quiz",
    activity: "Act",
    discussion: "Talk",
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-edsync-border bg-edsync-card p-3 shadow-card">
      {/* Block header */}
      <div className="mb-3 flex flex-col gap-3 rounded-[1.5rem] border border-edsync-border bg-edsync-surface p-3 xl:flex-row xl:items-center">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue text-xs font-bold text-white shadow-sm">
          {index + 1}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="edsync-input min-w-0 flex-1 py-2 font-display text-base font-bold"
          placeholder="Page title..."
        />

        {/* Type selector */}
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto rounded-2xl border border-edsync-border bg-edsync-card p-1">
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
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${contentType === t ? "bg-edsync-blue text-white shadow-sm" : "text-edsync-subtle hover:bg-edsync-surface hover:text-edsync-text"}`}
            >
              {TYPE_ICONS[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setDuration(Math.max(1, duration - 1))}
            className="btn-secondary h-9 px-3 text-xs"
          >
            -
          </button>
          <span className="flex h-9 min-w-16 items-center justify-center rounded-xl border border-edsync-border bg-edsync-card px-3 text-xs font-bold text-edsync-text">
            {duration}m
          </span>
          <button
            type="button"
            onClick={() => setDuration(duration + 1)}
            className="btn-secondary h-9 px-3 text-xs"
          >
            +
          </button>
        </div>
        <button
          onClick={onCancel}
          className="btn-ghost flex-shrink-0 px-3 py-2 text-xs"
        >
          Close
        </button>
      </div>

      {/* Content area based on type */}
      <div className="rounded-[1.5rem] bg-edsync-bg p-3">
        {(contentType === "text" || contentType === undefined) && (
          <div className="space-y-3">
            <LessonBlockEditor
              value={content}
              onChange={setContent}
              insertTools={SECTION_INSERT_TOOLS}
              contentTypeLabel="Lesson"
              placeholder="Click the canvas or insert a block..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveText}
                disabled={saving}
                className="btn-primary text-sm py-2"
              >
                {saving ? " Saving..." : "Save block"}
              </button>
              <button
                onClick={() => void removeBlock()}
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
              onClick={() => void removeBlock()}
              className="btn-ghost text-sm py-2 text-edsync-red"
            >
              Delete block
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

