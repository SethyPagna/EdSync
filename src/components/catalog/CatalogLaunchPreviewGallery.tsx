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

type CatalogLaunchPreviewGalleryProps = {
  labels: {
    catalog: string;
    studio: string;
    ai: string;
    practice: string;
    proof: string;
  };
};

function buildSlides(labels: CatalogLaunchPreviewGalleryProps["labels"]): PreviewSlide[] {
  return [
    {
      id: "catalog",
      label: labels.catalog,
      eyebrow: "Public catalog",
      title: "Energy Transfer",
      route: "/catalog",
      icon: Search,
      nav: [labels.catalog, "Org portal", "Preview", "Enroll"],
      metrics: [["Free", "Access"], ["35m", "Duration"], ["Grade 8", "Level"]],
      blocks: [["Course card", "Preview, price, organization, and enrollment state"], ["Return path", "Sign in once, then continue to the selected course"]],
    },
    {
      id: "studio",
      label: labels.studio,
      eyebrow: "Lesson studio",
      title: "Conduction vs convection",
      route: "/studio",
      icon: Presentation,
      nav: [labels.studio, "Docs", "Slides", "Media"],
      metrics: [["5", "Slides"], ["12", "Questions"], ["Saved", "Draft"]],
      blocks: [["Slide canvas", "Toolbar, thumbnails, media checks, quiz blocks"], ["Lesson handoff", "Insert Studio blocks into teacher lessons"]],
    },
    {
      id: "ai",
      label: labels.ai,
      eyebrow: "AI co-creator",
      title: "Outline to editable draft",
      route: "/ai",
      icon: Bot,
      nav: [labels.ai, "Prompt", "Preview", "Insert"],
      metrics: [["Groq", "Primary"], ["Google", "Fallback"], ["Review", "Required"]],
      blocks: [["Generated package", "Slides, quiz, rubric, flashcards, teacher notes"], ["Insert back", "Save as local Studio draft before publishing"]],
    },
    {
      id: "practice",
      label: labels.practice,
      eyebrow: "Student practice",
      title: "Sprint with explanations",
      route: "/practice",
      icon: Trophy,
      nav: [labels.practice, "Quiz", "Retry", "Review"],
      metrics: [["08:42", "Elapsed"], ["4/12", "Question"], ["2", "Missed"]],
      blocks: [["Attempt summary", "Score, time, missed concepts, explanations"], ["Review queue", "Save mistakes for dashboard recommendations"]],
    },
    {
      id: "proof",
      label: labels.proof,
      eyebrow: "Progress proof",
      title: "Grade event saved",
      route: "/admin/dashboard",
      icon: ShieldCheck,
      nav: [labels.proof, "Feedback", "Audit", "Admin"],
      metrics: [["24 pts", "Score"], ["Audit", "Logged"], ["Next", "Review"]],
      blocks: [["Teacher control", "Overrides, feedback, notes, and due dates stay visible"], ["Admin command", "AI providers, security, portals, catalog, and billing"]],
    },
  ];
}

export default function CatalogLaunchPreviewGallery({ labels }: CatalogLaunchPreviewGalleryProps) {
  const slides = useMemo(() => buildSlides(labels), [labels]);
  const [activeIndex, setActiveIndex] = useState(0);
  const pauseUntilRef = useRef(0);
  const activeSlide = slides[activeIndex] ?? slides[0];
  const ActiveIcon = activeSlide.icon;

  const showSlide = useCallback((index: number, pause = true) => {
    if (pause) {
      pauseUntilRef.current = Date.now() + 9000;
    }
    setActiveIndex((index + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() < pauseUntilRef.current) return;
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div
      className="edsync-launch-preview-board"
      onFocusCapture={() => {
        pauseUntilRef.current = Date.now() + 9000;
      }}
      onMouseEnter={() => {
        pauseUntilRef.current = Date.now() + 9000;
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
              Ready
            </span>
          </div>

          <div className="edsync-launch-app-path" aria-label={`${activeSlide.label} route preview`}>
            {activeSlide.nav.map((item, index) => (
              <span key={`${activeSlide.id}-${item}`} className={index === 0 ? "is-active" : ""}>
                {item}
              </span>
            ))}
          </div>

          <div className="edsync-launch-focus-card">
            <div className="edsync-launch-focus-media">
              <ActiveIcon className="h-7 w-7" />
              <span />
              <span />
            </div>
            <div className="edsync-launch-focus-copy">
              <small>{activeSlide.route}</small>
              <strong>{activeSlide.blocks[0][0]}</strong>
              <p>{activeSlide.blocks[0][1]}</p>
            </div>
          </div>

          <div className="edsync-launch-proof-row" aria-label={`${activeSlide.label} metrics`}>
            {activeSlide.metrics.map(([value, label]) => (
              <span key={`${activeSlide.id}-${label}`}>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            ))}
          </div>

          <div className="edsync-launch-loop-strip" aria-label={`${activeSlide.label} follow up`}>
            {activeSlide.blocks.map(([title, detail]) => (
              <span key={`${activeSlide.id}-${title}`}>
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
