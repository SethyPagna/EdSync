"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  MessageSquareText,
  Presentation,
  ShieldCheck,
  Trophy,
  Wand2,
  type LucideIcon,
} from "lucide-react";

type WorkflowSlide = {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  route: string;
  icon: LucideIcon;
  accent: string;
  rows: string[];
  stats: { label: string; value: string }[];
  actions: string[];
};

const slides: WorkflowSlide[] = [
  {
    id: "studio",
    title: "Course Studio",
    shortTitle: "Studio",
    subtitle: "Build the source lesson, slides, practice set, and assignment package in one workspace.",
    route: "/studio",
    icon: Presentation,
    accent: "text-edsync-blue",
    rows: ["Energy Transfer lesson", "7 slides generated", "Quiz and rubric attached"],
    stats: [
      { label: "Duration", value: "35m" },
      { label: "Blocks", value: "12" },
      { label: "State", value: "Draft" },
    ],
    actions: ["Edit sections", "Generate slides", "Assign"],
  },
  {
    id: "ai",
    title: "AI Co-creator",
    shortTitle: "AI",
    subtitle: "Prompt with grade level, language, duration, tone, standards, and output type before importing.",
    route: "/ai",
    icon: Wand2,
    accent: "text-edsync-emerald",
    rows: ["Grade 8 Science", "Student-friendly tone", "Quiz + flashcards + rubric"],
    stats: [
      { label: "Provider", value: "Smart" },
      { label: "Review", value: "On" },
      { label: "Output", value: "JSON" },
    ],
    actions: ["Preview", "Insert selected", "Regenerate"],
  },
  {
    id: "teacher",
    title: "Teacher Flow",
    shortTitle: "Teacher",
    subtitle: "See today’s work, feedback queues, class readiness, deadline signals, and next teaching actions.",
    route: "/teacher/dashboard",
    icon: CalendarCheck,
    accent: "text-edsync-blue",
    rows: ["3 submissions need review", "4 learners need support", "Friday quiz ready"],
    stats: [
      { label: "Active", value: "23" },
      { label: "Mastery", value: "81%" },
      { label: "Alerts", value: "4" },
    ],
    actions: ["Review", "Plan deadline", "Send note"],
  },
  {
    id: "practice",
    title: "Student Practice",
    shortTitle: "Practice",
    subtitle: "Students move through timed quizzes, flashcards, mistake retry, explanations, and review cards.",
    route: "/practice",
    icon: Trophy,
    accent: "text-edsync-amber",
    rows: ["Sprint mode running", "2 missed saved to review", "Explanation unlocked"],
    stats: [
      { label: "Timer", value: "08:42" },
      { label: "Streak", value: "6" },
      { label: "Score", value: "88%" },
    ],
    actions: ["Pause", "Retry missed", "Save review"],
  },
  {
    id: "admin",
    title: "Admin Command",
    shortTitle: "Admin",
    subtitle: "Platform controls stay separate: portals, providers, feature flags, security, and governance.",
    route: "/admin/dashboard",
    icon: ShieldCheck,
    accent: "text-edsync-purple",
    rows: ["AI provider fallback healthy", "Portal catalog published", "Security audit logged"],
    stats: [
      { label: "Providers", value: "5" },
      { label: "Portals", value: "3" },
      { label: "Risk", value: "Low" },
    ],
    actions: ["Test provider", "Edit portal", "Audit"],
  },
  {
    id: "discussion",
    title: "Class Discussion",
    shortTitle: "Discuss",
    subtitle: "Prompts, replies, teacher notes, and feedback connect back to lessons and interventions.",
    route: "/student/discussions",
    icon: MessageSquareText,
    accent: "text-edsync-cyan",
    rows: ["Prompt linked to lesson", "12 replies collected", "Teacher note drafted"],
    stats: [
      { label: "Replies", value: "12" },
      { label: "Unread", value: "3" },
      { label: "Notes", value: "2" },
    ],
    actions: ["Reply", "Summarize", "Intervene"],
  },
];

export default function WorkflowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeSlide = slides[activeIndex] ?? slides[0];
  const ActiveIcon = activeSlide.icon;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const index = Number(visible?.target.getAttribute("data-step-index"));
        if (Number.isFinite(index)) setActiveIndex(index);
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0.2, 0.55, 0.9] },
    );

    stepRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const goToSlide = (index: number) => {
    const safeIndex = (index + slides.length) % slides.length;
    setActiveIndex(safeIndex);
    stepRefs.current[safeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section id="showcase" className="edsync-workflow-showcase scroll-mt-24">
      <div className="edsync-workflow-sticky">
        <div className="edsync-workflow-copy">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-edsync-blue">View workflow</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Product screens, not promises.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-edsync-subtle">
            Scroll or click through the real surfaces: Studio, AI, teacher work, student practice, admin controls, and discussion.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goToSlide(index)}
                className={`edsync-workflow-dot ${activeIndex === index ? "is-active" : ""}`}
                aria-label={`Show ${slide.title}`}
                aria-current={activeIndex === index ? "true" : undefined}
              >
                <span />
                {slide.shortTitle}
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex - 1)} aria-label="Previous workflow slide">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex + 1)} aria-label="Next workflow slide">
              <ChevronRight className="h-4 w-4" />
            </button>
            <Link href="#catalog-search-panel" className="btn-secondary ml-1 justify-center px-4 py-2 text-sm">
              Open catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="edsync-workflow-stage" aria-live="polite">
          <article key={activeSlide.id} className="edsync-workflow-screen">
            <div className="edsync-workflow-browser">
              <span />
              <span />
              <span />
            </div>

            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-edsync-bg ${activeSlide.accent}`}>
                    <ActiveIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-3xl font-bold">{activeSlide.title}</h3>
                    <p className="text-sm font-semibold text-edsync-subtle">{activeSlide.route}</p>
                  </div>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-edsync-subtle">{activeSlide.subtitle}</p>
              </div>
              <Link href={activeSlide.route} className="btn-primary w-fit justify-center px-4 py-2 text-sm">
                Open
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {activeSlide.stats.map((stat) => (
                <div key={stat.label} className="edsync-workflow-stat">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="edsync-workflow-canvas">
                {activeSlide.rows.map((row, index) => (
                  <div key={row} className="edsync-workflow-row">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-edsync-blue/10 text-edsync-blue">
                      {index === 0 ? <FileText className="h-4 w-4" /> : index === 1 ? <Bot className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </span>
                    <span className="font-semibold text-edsync-text">{row}</span>
                    <span className="ml-auto h-2 max-w-[7rem] flex-1 rounded-full bg-edsync-border">
                      <span className="block h-full rounded-full bg-edsync-blue/30" style={{ width: `${82 - index * 16}%` }} />
                    </span>
                  </div>
                ))}
              </div>

              <div className="edsync-workflow-sidepanel">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-edsync-subtle">Actions</span>
                  <Clock3 className="h-4 w-4 text-edsync-subtle" />
                </div>
                <div className="mt-4 grid gap-2">
                  {activeSlide.actions.map((action, index) => (
                    <button
                      key={action}
                      type="button"
                      className={index === 0 ? "btn-primary justify-center px-3 py-2 text-sm" : "btn-secondary justify-center px-3 py-2 text-sm"}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="edsync-workflow-scroll-steps" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(node) => {
              stepRefs.current[index] = node;
            }}
            data-step-index={index}
            className="edsync-workflow-step"
          />
        ))}
      </div>
    </section>
  );
}
