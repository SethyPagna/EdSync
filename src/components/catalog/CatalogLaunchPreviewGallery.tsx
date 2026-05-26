"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, GraduationCap, Presentation, Search, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";

type PreviewSlide = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  route: string;
  icon: LucideIcon;
  nav: string[];
  metrics: [string, string][];
  blocks: [string, string][];
};

export type LaunchPreviewSlideCopy = Omit<PreviewSlide, "id" | "icon">;

type LaunchPreviewSlideMap = Record<"catalog" | "studio" | "ai" | "practice" | "proof", LaunchPreviewSlideCopy>;

type CatalogLaunchPreviewGalleryProps = {
  readyLabel: string;
  slides: LaunchPreviewSlideMap;
};

function buildSlides(slides: LaunchPreviewSlideMap): PreviewSlide[] {
  return [
    {
      id: "catalog",
      icon: Search,
      ...slides.catalog,
    },
    {
      id: "studio",
      icon: Presentation,
      ...slides.studio,
    },
    {
      id: "ai",
      icon: Bot,
      ...slides.ai,
    },
    {
      id: "practice",
      icon: Trophy,
      ...slides.practice,
    },
    {
      id: "proof",
      icon: ShieldCheck,
      ...slides.proof,
    },
  ];
}

function PreviewMock({ slide }: { slide: PreviewSlide }) {
  if (slide.id === "catalog") {
    return (
      <div className="edsync-launch-mini-screen edsync-launch-mini-screen-catalog">
        <div className="edsync-launch-mini-search" />
        <div className="edsync-launch-mini-course-grid">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (slide.id === "studio") {
    return (
      <div className="edsync-launch-mini-screen edsync-launch-mini-screen-studio">
        <div className="edsync-launch-mini-rail">
          <span />
          <span />
          <span />
        </div>
        <div className="edsync-launch-mini-canvas">
          <i />
          <b />
          <em />
        </div>
      </div>
    );
  }

  if (slide.id === "ai") {
    return (
      <div className="edsync-launch-mini-screen edsync-launch-mini-screen-ai">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (slide.id === "practice") {
    return (
      <div className="edsync-launch-mini-screen edsync-launch-mini-screen-practice">
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className="edsync-launch-mini-screen edsync-launch-mini-screen-proof">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function CatalogLaunchPreviewGallery(props: CatalogLaunchPreviewGalleryProps) {
  const slides = useMemo(() => buildSlides(props.slides), [props.slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const pauseUntilRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);
  const activeSlide = slides[activeIndex] ?? slides[0];

  const showSlide = useCallback((index: number, pause = true) => {
    if (pause) {
      pauseUntilRef.current = Date.now() + 9000;
    }
    setActiveIndex((index + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      if (document.hidden || Date.now() < pauseUntilRef.current) return;
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div
      className="edsync-launch-preview-board"
      role="region"
      tabIndex={0}
      aria-label="EdSync product preview gallery"
      onFocusCapture={() => {
        pauseUntilRef.current = Date.now() + 9000;
      }}
      onMouseEnter={() => {
        pauseUntilRef.current = Date.now() + 9000;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        showSlide(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      }}
      onTouchStart={(event) => {
        touchStartXRef.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartXRef.current = null;
        if (startX == null || endX == null || Math.abs(startX - endX) < 42) return;
        showSlide(activeIndex + (startX > endX ? 1 : -1));
      }}
    >
      <div className="edsync-launch-preview-grid" key={activeSlide.id}>
        <aside className="edsync-launch-preview-nav" aria-label="Hero preview gallery">
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            const selected = index === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                className={selected ? "is-active" : ""}
                onClick={() => showSlide(index)}
                aria-label={`Show ${slide.label} preview`}
                aria-pressed={selected}
              >
                <Icon className="h-4 w-4" />
                <span>
                  <strong>{slide.label}</strong>
                  <small>{slide.route}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="edsync-launch-workspace" aria-live="polite">
          <div className="edsync-launch-workspace-head">
            <div>
              <small>{activeSlide.eyebrow}</small>
              <h2>{activeSlide.title}</h2>
            </div>
            <span>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {props.readyLabel}
            </span>
          </div>

          <div className="edsync-launch-app-path" aria-label={`${activeSlide.label} route preview`}>
            {activeSlide.nav.map((item, index) => (
              <span key={`${activeSlide.id}-nav-${index}-${item}`} className={index === 0 ? "is-active" : ""}>
                {item}
              </span>
            ))}
          </div>

          <div className="edsync-launch-focus-card">
            <div className="edsync-launch-focus-media">
              <PreviewMock slide={activeSlide} />
            </div>
            <div className="edsync-launch-focus-copy">
              <small>{activeSlide.route}</small>
              <strong>{activeSlide.blocks[0][0]}</strong>
              <p>{activeSlide.blocks[0][1]}</p>
            </div>
          </div>

          <div className="edsync-launch-proof-row" aria-label={`${activeSlide.label} metrics`}>
            {activeSlide.metrics.map(([value, label], index) => (
              <span key={`${activeSlide.id}-metric-${index}-${label}`}>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            ))}
          </div>

          <div className="edsync-launch-loop-strip" aria-label={`${activeSlide.label} follow up`}>
            {activeSlide.blocks.map(([title, detail], index) => (
              <span key={`${activeSlide.id}-block-${index}-${title}`}>
                <GraduationCap className="h-4 w-4" />
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </span>
            ))}
          </div>

          <div className="edsync-launch-gallery-dots" aria-label="Hero preview controls">
            {slides.map((slide, index) => (
              <button
                key={`${slide.id}-dot`}
                type="button"
                className={index === activeIndex ? "is-active" : ""}
                onClick={() => showSlide(index)}
                aria-label={`Show ${slide.label}`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
