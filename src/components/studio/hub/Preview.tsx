"use client";

import { useEffect, useRef, useState } from "react";
import { composeTemplate } from "@/lib/studio/auto-layout";
import type { TemplateDef } from "@/lib/studio/library";
import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import ScenePreview from "../preview/ScenePreview";

const templateCache = new Map<string, SceneDeck>();

export function templateDeck(template: TemplateDef): SceneDeck {
  const cached = templateCache.get(template.id);
  if (cached) return cached;
  const deck = composeTemplate(template);
  templateCache.set(template.id, deck);
  return deck;
}

export function SceneThumbnail({ deck, page, className = "" }: { deck: SceneDeck; page: ScenePage; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(220);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setWidth(Math.max(1, Math.floor(frame.getBoundingClientRect().width)));
    if (typeof ResizeObserver === "undefined") {
      const animation = requestAnimationFrame(update);
      return () => cancelAnimationFrame(animation);
    }
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return <div ref={frameRef} className={`w-full overflow-hidden ${className}`}><ScenePreview page={page} deck={deck} width={width} /></div>;
}

export function LazyTemplateThumbnail({ template }: { template: TemplateDef }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (typeof IntersectionObserver === "undefined") {
      const animation = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(animation);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const deck = visible ? templateDeck(template) : null;
  return <div ref={frameRef} className="flex min-h-28 items-center justify-center overflow-hidden rounded-md bg-surface-2">{deck?.pages[0] ? <SceneThumbnail deck={deck} page={deck.pages[0]} /> : <span className="text-xs text-fg-faint">Preview</span>}</div>;
}
