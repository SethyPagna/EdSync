"use client";

import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
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
  headline: string;
  subtitle: string;
  route: string;
  icon: LucideIcon;
  accent: string;
  tabs: string[];
  metrics: { label: string; value: string }[];
  rows: { title: string; detail: string; status: string }[];
  sideTitle: string;
  sideRows: string[];
  actions: string[];
};

const slides: WorkflowSlide[] = [
  {
    id: "studio",
    title: "Course Studio",
    shortTitle: "Studio",
    headline: "Turn a rough idea into a lesson package.",
    subtitle: "A teacher can write, import, design slides, build quizzes, and keep drafts in one workspace.",
    route: "/studio",
    icon: Presentation,
    accent: "text-edsync-blue",
    tabs: ["Outline", "Slides", "Practice", "Assign"],
    metrics: [
      { label: "Draft", value: "Auto-saved" },
      { label: "Sections", value: "12" },
      { label: "Duration", value: "35 min" },
    ],
    rows: [
      { title: "Energy Transfer", detail: "Lesson sections, deck, and worksheet", status: "Editing" },
      { title: "Quiz block", detail: "8 point-based questions with explanations", status: "Ready" },
      { title: "Class handoff", detail: "Assign to Grade 8 Science by Friday", status: "Next" },
    ],
    sideTitle: "Studio actions",
    sideRows: ["Import text or files", "Ask AI to clean up", "Insert slides and practice"],
    actions: ["Open Studio", "Create lesson", "Generate practice"],
  },
  {
    id: "ai",
    title: "AI Co-creator",
    shortTitle: "AI",
    headline: "AI output arrives as editable classroom material.",
    subtitle: "Guided fields control grade level, tone, language, standards, quiz style, and insert-back target.",
    route: "/ai",
    icon: Wand2,
    accent: "text-edsync-emerald",
    tabs: ["Prompt", "Preview", "Review", "Insert"],
    metrics: [
      { label: "Provider", value: "Smart" },
      { label: "Review", value: "Required" },
      { label: "Output", value: "Structured" },
    ],
    rows: [
      { title: "Grade 8 science", detail: "Zero-to-expert explanation", status: "Prompted" },
      { title: "Draft slides", detail: "5 slides with speaker notes", status: "Preview" },
      { title: "Practice set", detail: "Quiz, flashcards, and retry missed", status: "Insert" },
    ],
    sideTitle: "Teacher control",
    sideRows: ["Regenerate one slide", "Change tone or language", "Insert selected only"],
    actions: ["Run AI", "Preview result", "Insert selected"],
  },
  {
    id: "teacher",
    title: "Teacher Dashboard",
    shortTitle: "Teacher",
    headline: "The teacher sees the next useful action first.",
    subtitle: "Deadlines, submissions, notes, class health, and planning signals stay grouped and readable.",
    route: "/teacher/dashboard",
    icon: CalendarCheck,
    accent: "text-edsync-blue",
    tabs: ["Today", "Classes", "Review", "Plan"],
    metrics: [
      { label: "Review", value: "3" },
      { label: "Support", value: "4" },
      { label: "Mastery", value: "81%" },
    ],
    rows: [
      { title: "Friday quiz", detail: "23 learners assigned", status: "Scheduled" },
      { title: "Feedback queue", detail: "3 submissions need comments", status: "Review" },
      { title: "Intervention", detail: "4 learners missed two concepts", status: "Help" },
    ],
    sideTitle: "Fast actions",
    sideRows: ["Plan deadline", "Send student note", "Open gradebook"],
    actions: ["Review work", "Schedule", "Message"],
  },
  {
    id: "practice",
    title: "Student Practice",
    shortTitle: "Practice",
    headline: "Practice feels active, not like another static worksheet.",
    subtitle: "Students can run timed sprints, retry missed items, read explanations, and save mistakes to review.",
    route: "/practice",
    icon: Trophy,
    accent: "text-edsync-amber",
    tabs: ["Sprint", "Flashcards", "Retry", "Review"],
    metrics: [
      { label: "Timer", value: "08:42" },
      { label: "Streak", value: "6" },
      { label: "Score", value: "88%" },
    ],
    rows: [
      { title: "Question 5", detail: "Why does heat move from warm to cool?", status: "Answered" },
      { title: "Missed concept", detail: "Conduction vs convection", status: "Review" },
      { title: "Next card", detail: "Saved to mistake retry queue", status: "Ready" },
    ],
    sideTitle: "Learning loop",
    sideRows: ["Pause or restart", "Retry missed only", "Save to review cards"],
    actions: ["Start sprint", "Retry missed", "Review cards"],
  },
  {
    id: "admin",
    title: "Admin Command",
    shortTitle: "Admin",
    headline: "Platform controls stay powerful but separated.",
    subtitle: "Global admin manages providers, portals, feature flags, catalog settings, audit logs, and security.",
    route: "/admin/dashboard",
    icon: ShieldCheck,
    accent: "text-edsync-purple",
    tabs: ["Health", "Portals", "AI", "Security"],
    metrics: [
      { label: "Providers", value: "5" },
      { label: "Portals", value: "3" },
      { label: "Risk", value: "Low" },
    ],
    rows: [
      { title: "AI fallback", detail: "Groq, Google, Mistral, Cerebras, Cohere", status: "Healthy" },
      { title: "Portal catalog", detail: "Public and organization products", status: "Live" },
      { title: "Security events", detail: "Admin view-as and provider tests logged", status: "Audited" },
    ],
    sideTitle: "Platform actions",
    sideRows: ["Test provider", "Edit portal", "Review audit"],
    actions: ["Open admin", "Test AI", "View security"],
  },
  {
    id: "discussion",
    title: "Discussion And Feedback",
    shortTitle: "Discuss",
    headline: "Class discussion connects back to evidence.",
    subtitle: "Prompts, replies, teacher notes, and feedback stay tied to the lesson and student progress.",
    route: "/student/discussions",
    icon: MessageSquareText,
    accent: "text-edsync-cyan",
    tabs: ["Prompt", "Replies", "Notes", "Follow-up"],
    metrics: [
      { label: "Replies", value: "12" },
      { label: "Unread", value: "3" },
      { label: "Notes", value: "2" },
    ],
    rows: [
      { title: "Lesson prompt", detail: "Explain heat transfer in your kitchen", status: "Open" },
      { title: "Student reply", detail: "Teacher note drafted for misconception", status: "Flagged" },
      { title: "Recommendation", detail: "Review card added to dashboard", status: "Next" },
    ],
    sideTitle: "Feedback loop",
    sideRows: ["Summarize replies", "Draft a note", "Recommend review"],
    actions: ["Join discussion", "Summarize", "Add note"],
  },
];

const WorkflowScreen = memo(function WorkflowScreen({ slide }: { slide: WorkflowSlide }) {
  const ActiveIcon = slide.icon;

  return (
    <article className="edsync-workflow-screen" aria-label={slide.title}>
      <div className="edsync-workflow-browser">
        <div className="flex gap-1.5" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="truncate text-xs font-bold text-edsync-subtle">{slide.route}</span>
        <Link href={slide.route} className="edsync-workflow-open">
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="edsync-workflow-hero-row">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-edsync-bg ${slide.accent}`}>
              <ActiveIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-edsync-subtle">{slide.title}</p>
              <h3 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{slide.headline}</h3>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-7 text-edsync-subtle">{slide.subtitle}</p>
        </div>
      </div>

      <div className="edsync-workflow-tabs" aria-label={`${slide.title} preview tabs`}>
        {slide.tabs.map((tab, index) => (
          <span key={tab} className={index === 0 ? "is-active" : ""}>
            {tab}
          </span>
        ))}
      </div>

      <div className="edsync-workflow-product">
        <div className="edsync-workflow-canvas">
          <div className="grid gap-3 sm:grid-cols-3">
            {slide.metrics.map((metric) => (
              <div key={metric.label} className="edsync-workflow-stat">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            {slide.rows.map((row, index) => (
              <div key={row.title} className="edsync-workflow-row">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-edsync-blue/10 text-edsync-blue">
                  {index === 0 ? <FileText className="h-4 w-4" /> : index === 1 ? <Bot className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-edsync-text">{row.title}</span>
                  <span className="block truncate text-sm text-edsync-subtle">{row.detail}</span>
                </span>
                <span className="edsync-workflow-status">{row.status}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="edsync-workflow-sidepanel">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-xl font-bold">{slide.sideTitle}</h4>
            <Clock3 className="h-4 w-4 text-edsync-subtle" />
          </div>
          <div className="mt-4 grid gap-2">
            {slide.sideRows.map((row) => (
              <div key={row} className="edsync-workflow-side-row">
                <CheckCircle2 className="h-4 w-4 text-edsync-emerald" />
                <span>{row}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2">
            {slide.actions.map((action, index) => (
              <button
                key={action}
                type="button"
                className={index === 0 ? "btn-primary justify-center px-3 py-2 text-sm" : "btn-secondary justify-center px-3 py-2 text-sm"}
              >
                {action}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </article>
  );
});

export default function WorkflowShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeIndexRef = useRef(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  const setActiveSlide = useCallback((index: number) => {
    const safeIndex = (index + slides.length) % slides.length;
    if (activeIndexRef.current === safeIndex) return;
    activeIndexRef.current = safeIndex;
    startTransition(() => setActiveIndex(safeIndex));
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 901px)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio <= bestRatio) continue;
          bestRatio = entry.intersectionRatio;
          bestIndex = Number(entry.target.getAttribute("data-step-index"));
        }
        if (Number.isFinite(bestIndex) && bestIndex >= 0) setActiveSlide(bestIndex);
      },
      { rootMargin: "-36% 0px -44% 0px", threshold: 0.5 },
    );

    stepRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [setActiveSlide]);

  const goToSlide = useCallback((index: number) => {
    const safeIndex = (index + slides.length) % slides.length;
    setActiveSlide(safeIndex);
    stepRefs.current[safeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [setActiveSlide]);

  return (
    <>
      <section id="workflow-transition" className="edsync-workflow-bridge" aria-label="Workflow transition">
        <div className="edsync-workflow-bridge-sticky">
          <div className="edsync-workflow-bridge-card">
            <div className="min-w-0">
              <h2 className="font-display text-5xl font-bold leading-none sm:text-7xl">
                See the loop.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-edsync-subtle">
                Scroll once and the landing page gives way to the product: create, personalize, practice, grade, and improve.
              </p>
            </div>
            <div className="edsync-workflow-bridge-window" aria-hidden="true">
              {["Idea", "Studio", "Practice", "Progress"].map((label, index) => (
                <span key={label} style={{ transform: `translateX(${index * 0.65}rem)` }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="showcase" className="edsync-workflow-showcase scroll-mt-24">
        <div className="edsync-workflow-sticky">
          <div className="edsync-workflow-heading">
            <div>
              <h2 className="font-display text-4xl font-bold leading-tight sm:text-6xl">
                One gallery. Every step.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-edsync-subtle">
                Click the dots or keep scrolling through the actual EdSync workflow surfaces.
              </p>
            </div>
          </div>

          <div className="edsync-workflow-controls" aria-label="Workflow gallery controls">
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex - 1)} aria-label="Previous workflow slide">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="edsync-workflow-dots">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={activeIndex === index ? "is-active" : ""}
                  aria-label={`Show ${slide.title}`}
                  aria-current={activeIndex === index ? "true" : undefined}
                />
              ))}
            </div>
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex + 1)} aria-label="Next workflow slide">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="edsync-workflow-stage">
            <WorkflowScreen slide={activeSlide} />
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
    </>
  );
}
