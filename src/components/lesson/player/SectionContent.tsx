"use client";

import { useState } from "react";
import Image from "next/image";
import { MessageCircle, Play, Sparkles } from "lucide-react";
import { sanitizeHtml } from "@/lib/security/html";
import { classifySafeMediaUrl, safeImageUrl } from "@/lib/security/media";
import type { LessonSection } from "@/types";

function RichText({ content }: { content: string }) {
  if (!content.includes("<")) return <div className="lesson-prose whitespace-pre-line">{content}</div>;
  return <div className="lesson-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
}

function ImageSection({ content, title }: { content: string; title: string }) {
  const [raw, caption] = content.split("|||");
  const url = safeImageUrl(raw);
  if (!url) return <p role="status" className="rounded-lg bg-surface-2 p-4 text-sm text-fg-muted">Image unavailable.</p>;
  return (
    <figure>
      <Image src={url} alt={caption || title} width={1200} height={675} sizes="(max-width: 768px) 100vw, 720px" className="h-auto max-h-[32rem] w-full rounded-xl border border-line object-contain" />
      {caption && <figcaption className="mt-2 text-center text-xs text-fg-muted">{caption}</figcaption>}
    </figure>
  );
}

function VideoSection({ content, title }: { content: string; title: string }) {
  const [raw, caption] = content.split("|||");
  const media = classifySafeMediaUrl(raw);
  if (!media) return <p role="status" className="rounded-lg bg-surface-2 p-4 text-sm text-fg-muted">Video unavailable.</p>;
  return (
    <figure>
      {media.embedUrl ? (
        <iframe title={title} src={media.embedUrl} allowFullScreen allow="accelerometer; autoplay; encrypted-media; gyroscope" className="aspect-video w-full rounded-xl border border-line bg-surface-2" />
      ) : media.kind === "video" ? (
        <video controls src={media.url} className="aspect-video w-full rounded-xl border border-line bg-surface-2" />
      ) : (
        <a href={media.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-accent"><Play className="size-4" />Watch video</a>
      )}
      {caption && <figcaption className="mt-2 text-center text-xs text-fg-muted">{caption}</figcaption>}
    </figure>
  );
}

function DiscussionSection({ content }: { content: string }) {
  const [thought, setThought] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-accent"><MessageCircle className="size-4" />Discussion prompt</div>
      <RichText content={content} />
      <label className="block text-xs text-fg-muted" htmlFor="lesson-discussion-note">Your thought</label>
      <textarea id="lesson-discussion-note" className="textarea w-full" rows={3} value={thought} onChange={(event) => setThought(event.target.value)} placeholder="Jot down a thought before continuing" />
    </div>
  );
}

export default function SectionContent({ section }: { section: LessonSection }) {
  const content = section.content || "";
  if (section.content_type === "image") return <ImageSection content={content} title={section.title} />;
  if (section.content_type === "video") return <VideoSection content={content} title={section.title} />;
  if (section.content_type === "discussion") return <DiscussionSection content={content} />;
  if (section.content_type === "activity") return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-accent"><Sparkles className="size-4" />Activity</div>
      <RichText content={content} />
    </div>
  );
  if (section.content_type === "quiz") return content ? <div className="rounded-lg bg-surface-2 p-3 text-sm text-fg-muted"><RichText content={content} /></div> : null;
  return <RichText content={content} />;
}
