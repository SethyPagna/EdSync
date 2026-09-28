"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, StickyNote, X } from "lucide-react";
import ScenePreview from "../preview/ScenePreview";
import { useStudio } from "../store";

export default function PresentMode({ startPageId, onExit }: { startPageId?: string; onExit(): void }) {
  const deck = useStudio((state) => state.deck);
  const pages = useMemo(() => deck?.pages.filter((page) => !page.hidden) ?? [], [deck]);
  const [index, setIndex] = useState(() => Math.max(0, pages.findIndex((page) => page.id === startPageId)));
  const [notesOpen, setNotesOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewport, setViewport] = useState({ width: 960, height: 720 });
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const exitRef = useRef(onExit);
  const closingRef = useRef(false);
  useEffect(() => { exitRef.current = onExit; }, [onExit]);

  const exit = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (document.fullscreenElement === rootRef.current) void document.exitFullscreen().catch(() => {});
    exitRef.current();
  };

  const wakeControls = () => {
    setShowControls(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowControls(false), 2600);
  };

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    update();
    updateMotion();
    window.addEventListener("resize", update);
    preference.addEventListener("change", updateMotion);
    const root = rootRef.current;
    if (root?.requestFullscreen) void root.requestFullscreen().catch(() => setFullscreen(false));
    return () => {
      window.removeEventListener("resize", update);
      preference.removeEventListener("change", updateMotion);
      window.clearTimeout(timerRef.current);
      if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === rootRef.current;
      if (fullscreen && !active) exit();
      setFullscreen(active);
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, [fullscreen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Spacebar"].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.min(pages.length - 1, value + 1)); }
      else if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      else if (event.key === "Home") { event.preventDefault(); setIndex(0); }
      else if (event.key === "End") { event.preventDefault(); setIndex(Math.max(0, pages.length - 1)); }
      else if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey) { event.preventDefault(); setNotesOpen((open) => !open); }
      else if (event.key === "Escape") { event.preventDefault(); exit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setShowControls(false), 2600);
    return () => window.clearTimeout(timerRef.current);
  }, []);

  if (!deck || !pages.length) return null;
  const visibleIndex = Math.min(index, pages.length - 1);
  const page = pages[visibleIndex];
  const width = Math.max(1, Math.min(viewport.width - 32, (viewport.height - 100) * deck.width / deck.height));
  const animation = reducedMotion || page.transition === "none" ? undefined : page.transition === "slide" ? "studio-present-slide 240ms ease-out" : "studio-present-fade 180ms ease-out";
  const notes = page.notes || page.content?.notes;

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Presentation" onPointerMove={wakeControls} className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#101014] text-white ${showControls ? "cursor-auto" : "cursor-none"}`}>
      <style>{`@keyframes studio-present-fade { from { opacity: 0 } to { opacity: 1 } } @keyframes studio-present-slide { from { opacity: .55; transform: translateX(22px) } to { opacity: 1; transform: translateX(0) } }`}</style>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-white/10"><div className="h-full bg-white transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${((visibleIndex + 1) / pages.length) * 100}%` }} /></div>
      <div key={page.id} style={{ animation }} className="overflow-hidden rounded-sm shadow-2xl"><ScenePreview page={page} deck={deck} width={width} /></div>
      {notesOpen && notes && <aside aria-label="Speaker notes" className="absolute bottom-20 left-4 max-h-[32vh] w-[min(28rem,calc(100vw-2rem))] overflow-auto rounded-lg bg-black/85 p-4 text-sm leading-relaxed text-white shadow-lg backdrop-blur">{notes}</aside>}
      <div className={`absolute inset-x-4 top-4 flex items-center justify-between transition-opacity duration-200 motion-reduce:transition-none ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <span className="max-w-[70vw] truncate text-sm font-medium">{deck.title}</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={fullscreen ? "Leave fullscreen" : "Enter fullscreen"} onClick={() => { if (fullscreen) void document.exitFullscreen(); else void rootRef.current?.requestFullscreen().catch(() => {}); }} className="rounded-md p-2 hover:bg-white/15">{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <button type="button" aria-label="Exit presentation" onClick={exit} className="rounded-md p-2 hover:bg-white/15"><X size={18} /></button>
        </div>
      </div>
      <div className={`absolute bottom-4 flex items-center gap-3 rounded-full bg-black/75 px-3 py-1.5 text-sm shadow-lg backdrop-blur transition-opacity duration-200 motion-reduce:transition-none ${showControls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" aria-label="Previous page" disabled={visibleIndex === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-30"><ArrowLeft size={18} /></button>
        <span aria-live="polite" className="min-w-12 text-center tabular-nums">{visibleIndex + 1} / {pages.length}</span>
        <button type="button" aria-label="Next page" disabled={visibleIndex === pages.length - 1} onClick={() => setIndex((value) => Math.min(pages.length - 1, value + 1))} className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-30"><ArrowRight size={18} /></button>
        <span className="mx-0.5 h-4 w-px bg-white/25" />
        <button type="button" aria-label={notesOpen ? "Hide speaker notes" : "Show speaker notes"} aria-pressed={notesOpen} onClick={() => setNotesOpen(!notesOpen)} className="rounded-full p-1.5 hover:bg-white/15 aria-pressed:bg-white/20"><StickyNote size={17} /></button>
      </div>
    </div>
  );
}
