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
                From public page to learning evidence.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-edsync-subtle">
                Each scroll step swaps the stage to a real EdSync surface: catalog, Studio, AI, teacher review, student practice, and admin controls.
              </p>
            </div>
            <div className="edsync-workflow-bridge-window" aria-hidden="true">
              {["Catalog", "Studio", "AI draft", "Practice", "Gradebook"].map((label, index) => (
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
                Slide through the actual app.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-edsync-subtle">
                Click the dots or scroll. Each slide shows the route, controls, data, and actions users actually touch.
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
            <WorkflowScreen key={activeSlide.id} slide={activeSlide} />
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
