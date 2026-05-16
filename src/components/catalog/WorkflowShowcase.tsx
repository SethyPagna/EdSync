"use client";

import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
    title: "Studio And Lesson Builder",
    shortTitle: "Studio",
    headline: "Write the lesson, design slides, attach media, then assign.",
    subtitle: "The same Studio workspace powers notes, docs, slides, sheets, lesson sections, imports, local drafts, and publish states.",
    route: "/studio?tab=slides",
    icon: Presentation,
    accent: "text-edsync-blue",
    tabs: ["Rich editor", "Slides", "Media", "Drafts"],
    metrics: [
      { label: "Editor", value: "Tiptap" },
      { label: "Slides", value: "PPTX" },
      { label: "Drafts", value: "Local + D1" },
    ],
    rows: [
      { title: "Rich text toolbar", detail: "Headings, tables, callouts, images, links, formatting", status: "Editing" },
      { title: "Slide canvas", detail: "Thumbnails, speaker notes, layouts, transitions, PPTX export", status: "Design" },
      { title: "Lesson handoff", detail: "Insert selected Studio blocks into teacher lesson sections", status: "Assign" },
    ],
    sideTitle: "Real actions",
    sideRows: ["Save draft", "Duplicate item", "Export PPTX", "Insert into lesson"],
    actions: ["Open Studio", "Create lesson", "Export deck"],
  },
  {
    id: "ai",
    title: "AI Prompt Builder",
    shortTitle: "AI",
    headline: "Generate structured outputs that can be inserted back into Studio.",
    subtitle: "The AI surface uses guided prompt fields, provider fallback, preview contracts, and editable insert-back targets.",
    route: "/ai",
    icon: Wand2,
    accent: "text-edsync-emerald",
    tabs: ["Fields", "Provider", "Preview", "Insert"],
    metrics: [
      { label: "Endpoint", value: "/api/ai/course-workflow" },
      { label: "Fallback", value: "Groq + Google" },
      { label: "Mode", value: "Review first" },
    ],
    rows: [
      { title: "Prompt fields", detail: "Topic, grade, duration, tone, language, output type", status: "Filled" },
      { title: "Generated package", detail: "Outline, slides, quiz, rubric, flashcards, teacher notes", status: "Preview" },
      { title: "Save to Studio", detail: "Writes an editable local Studio draft before publish", status: "Insert" },
    ],
    sideTitle: "Controls",
    sideRows: ["Choose provider family", "Regenerate one section", "Save as note", "Open Studio"],
    actions: ["Run workflow", "Save to Studio", "Open AI"],
  },
  {
    id: "teacher",
    title: "Teacher Portal",
    shortTitle: "Teacher",
    headline: "Plan work, review submissions, grade, and message students.",
    subtitle: "Teacher pages connect dashboard, lesson builder, gradebook, planner, roster, discussions, notes, work, and reports.",
    route: "/teacher/dashboard",
    icon: CalendarCheck,
    accent: "text-edsync-blue",
    tabs: ["Dashboard", "Lessons", "Gradebook", "Planner"],
    metrics: [
      { label: "Routes", value: "10" },
      { label: "Gradebook", value: "Weighted" },
      { label: "Notes", value: "Student-linked" },
    ],
    rows: [
      { title: "Lesson builder", detail: "/teacher/lessons/create uses AI/manual sections and quizzes", status: "Create" },
      { title: "Submissions review", detail: "/teacher/work and gradebook score updates", status: "Grade" },
      { title: "Roster and notes", detail: "Student notes, discussions, deadlines, and reports", status: "Support" },
    ],
    sideTitle: "Teacher actions",
    sideRows: ["Create assignment", "Set due date", "Update score", "Send note"],
    actions: ["Teacher dashboard", "Open gradebook", "Plan deadline"],
  },
  {
    id: "practice",
    title: "Practice And Student Learning",
    shortTitle: "Practice",
    headline: "Students learn through quizzes, flashcards, games, reviews, and lesson attempts.",
    subtitle: "Practice, quizzes, games, lesson player, grades, discussions, notes, and profile are connected into one learning loop.",
    route: "/practice",
    icon: Trophy,
    accent: "text-edsync-amber",
    tabs: ["Quiz", "Sprint", "Flashcards", "Mistakes"],
    metrics: [
      { label: "Modes", value: "9" },
      { label: "Timer", value: "Pause + retry" },
      { label: "Route", value: "/practice" },
    ],
    rows: [
      { title: "Practice modes", detail: "Quiz, exam, flashcards, matching, sprint, true/false", status: "Choose" },
      { title: "Attempt summary", detail: "Elapsed time, score, missed questions, explanations", status: "Review" },
      { title: "Review cards", detail: "Save mistakes to reviews and dashboard recommendations", status: "Repeat" },
    ],
    sideTitle: "Student actions",
    sideRows: ["Start timer", "Pause attempt", "Retry missed", "Save mistake"],
    actions: ["Open practice", "Open quizzes", "Open games"],
  },
  {
    id: "admin",
    title: "Admin And Platform Settings",
    shortTitle: "Admin",
    headline: "Manage providers, portals, permissions, security, catalog, and billing.",
    subtitle: "The admin console separates platform owner controls from tenant-scoped organization managers.",
    route: "/admin/dashboard",
    icon: ShieldCheck,
    accent: "text-edsync-purple",
    tabs: ["AI", "Portals", "Permissions", "Security"],
    metrics: [
      { label: "Providers", value: "Encrypted" },
      { label: "Catalog", value: "Publishable" },
      { label: "Audit", value: "Logged" },
    ],
    rows: [
      { title: "AI providers", detail: "Groq, Google, Mistral, Cerebras, Cohere tests and priority", status: "Configure" },
      { title: "Portals and catalog", detail: "Public org pages, products, pricing, entitlements", status: "Publish" },
      { title: "Security and governance", detail: "Audit logs, feature flags, standards, automation", status: "Audit" },
    ],
    sideTitle: "Admin actions",
    sideRows: ["Test AI provider", "Edit portal", "Toggle feature", "Review events"],
    actions: ["Admin dashboard", "AI settings", "Security"],
  },
  {
    id: "discussion",
    title: "Catalog And Organizations",
    shortTitle: "Catalog",
    headline: "Public search, organization portals, enrollment, and course access.",
    subtitle: "The catalog and organization routes connect visitors to free/paid products before login and return them to the right course.",
    route: "/catalog",
    icon: MessageSquareText,
    accent: "text-edsync-cyan",
    tabs: ["Search", "Org portal", "Enroll", "Access"],
    metrics: [
      { label: "Routes", value: "3 public" },
      { label: "Billing", value: "Free + paid" },
      { label: "Media", value: "Safe links" },
    ],
    rows: [
      { title: "Global catalog", detail: "/catalog filters products by language, price, duration", status: "Search" },
      { title: "Organization portal", detail: "/org/[portalSlug] scopes catalog and branding", status: "Route" },
      { title: "Enrollment guard", detail: "Login returns to selected course and grants entitlement", status: "Access" },
    ],
    sideTitle: "Visitor actions",
    sideRows: ["Search courses", "Open org portal", "Enroll free", "Start checkout"],
    actions: ["Search catalog", "View portals", "Start"],
  },
];

const WorkflowScreen = memo(function WorkflowScreen({
  slide,
  index,
}: {
  slide: WorkflowSlide;
  index: number;
}) {
  const ActiveIcon = slide.icon;

  return (
    <article className="edsync-workflow-screen" aria-label={slide.title}>
      <div className="edsync-workflow-copy">
        <div className="edsync-workflow-count">
          <ActiveIcon className="h-4 w-4" />
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
        <h3>{slide.headline}</h3>
        <p>{slide.subtitle}</p>
        <div className="edsync-workflow-checklist">
          {slide.sideRows.slice(0, 3).map((row) => (
            <span key={row}>
              <CheckCircle2 className="h-4 w-4" />
              {row}
            </span>
          ))}
        </div>
      </div>

      <div className="edsync-workflow-preview">
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

        <div className="edsync-workflow-product">
          <aside className="edsync-workflow-sidepanel">
            {slide.tabs.map((tab, tabIndex) => (
              <span key={tab} className={tabIndex === 0 ? "is-active" : ""}>
                {tab}
              </span>
            ))}
          </aside>

          <div className="edsync-workflow-canvas">
            <div className="edsync-workflow-preview-head">
              <div>
                <p>{slide.title}</p>
                <h4>{slide.sideTitle}</h4>
              </div>
              <span>{slide.metrics[0]?.value}</span>
            </div>
            <div className="edsync-workflow-preview-rows">
              {slide.rows.map((row) => (
                <span key={row.title}>
                  <strong>{row.title}</strong>
                  <small>{row.detail}</small>
                  <em>{row.status}</em>
                </span>
              ))}
            </div>
            <div className="edsync-workflow-preview-metrics">
              {slide.metrics.map((metric) => (
                <span key={metric.label}>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

export default function WorkflowShowcase({ includeBridge = true }: { includeBridge?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeIndexRef = useRef(0);
  const manualControlUntilRef = useRef(0);
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
        if (Date.now() > manualControlUntilRef.current && Number.isFinite(bestIndex) && bestIndex >= 0) {
          setActiveSlide(bestIndex);
        }
      },
      { rootMargin: "-36% 0px -44% 0px", threshold: 0.5 },
    );

    stepRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [setActiveSlide]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const interval = window.setInterval(() => {
      if (document.hidden || Date.now() < manualControlUntilRef.current) return;
      setActiveSlide(activeIndexRef.current + 1);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [setActiveSlide]);

  const goToSlide = useCallback((index: number) => {
    const safeIndex = (index + slides.length) % slides.length;
    manualControlUntilRef.current = Date.now() + 9000;
    setActiveSlide(safeIndex);
  }, [setActiveSlide]);

  return (
    <>
      {includeBridge && (
        <section id="workflow-transition" className="edsync-workflow-bridge" aria-label="Workflow transition">
          <div className="edsync-workflow-bridge-sticky">
            <div className="edsync-workflow-bridge-card">
              <div className="min-w-0">
                <h2 className="font-display text-5xl font-bold leading-none sm:text-7xl">
                  Scroll into the workflow.
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-8 text-edsync-subtle">
                  One visitor path becomes a lesson draft, a practice attempt, and a gradebook signal.
                </p>
              </div>
              <div className="edsync-workflow-bridge-window" aria-hidden="true">
                {[
                  ["Catalog", "/catalog/[course]", "Preview, price, enroll"],
                  ["Studio", "/studio", "Slides, media, drafts"],
                  ["AI insert", "/ai", "Quiz, rubric, review"],
                  ["Practice", "/practice", "Timer, retry, explain"],
                  ["Gradebook", "/teacher/gradebook", "Events, feedback, progress"],
                ].map(([label, route, detail], index) => (
                  <span key={label} style={{ transform: `translateX(${index * 0.55}rem)` }}>
                    <strong>{label}</strong>
                    <small>{route}</small>
                    <em>{detail}</em>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="showcase" className="edsync-workflow-showcase scroll-mt-24">
        <div className="edsync-workflow-sticky">
          <div className="edsync-workflow-heading">
            <div>
              <span className="edsync-workflow-eyebrow">
                <Wand2 className="h-4 w-4" />
                Scroll workflow
              </span>
            </div>
            <nav aria-label="Workflow sections">
              <a href="#top">Hero</a>
              <a href="#showcase">Workflow</a>
              <a href="#catalog-search-panel">Workspace</a>
            </nav>
          </div>

          <div className="edsync-workflow-stage">
            <WorkflowScreen key={activeSlide.id} slide={activeSlide} index={activeIndex} />
          </div>

          <div className="edsync-workflow-controls" aria-label="Workflow gallery controls">
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex - 1)} aria-label="Previous workflow slide">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="edsync-workflow-bottom-tabs">
              {slides.map((slide, index) => {
                const SlideIcon = slide.icon;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goToSlide(index)}
                    className={activeIndex === index ? "is-active" : ""}
                    aria-label={`Show ${slide.title}`}
                    aria-current={activeIndex === index ? "true" : undefined}
                  >
                    <SlideIcon className="h-4 w-4" />
                    <span>
                      <strong>{slide.shortTitle}</strong>
                      <small>{String(index + 1).padStart(2, "0")}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="premium-icon-button" onClick={() => goToSlide(activeIndex + 1)} aria-label="Next workflow slide">
              <ChevronRight className="h-4 w-4" />
            </button>
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
