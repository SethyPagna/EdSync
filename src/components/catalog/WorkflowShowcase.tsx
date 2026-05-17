"use client";

import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Presentation,
  Search,
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
    id: "catalog",
    title: "Catalog And Organization Entry",
    shortTitle: "Catalog",
    headline: "Start from catalog, portal, or workspace.",
    subtitle: "Visitors search, enroll, sign in, and return to the right course context.",
    route: "/catalog",
    icon: Search,
    accent: "text-edsync-cyan",
    tabs: ["Search", "Org portal", "Enroll", "Access"],
    metrics: [
      { label: "Routes", value: "/catalog" },
      { label: "Products", value: "Free + paid" },
      { label: "Return", value: "Login next" },
    ],
    rows: [
      { title: "Catalog search", detail: "Filter by price, duration, language, difficulty, and academy", status: "Discover" },
      { title: "Organization portal", detail: "/org/[portalSlug] keeps school or partner catalog context", status: "Route" },
      { title: "Enrollment guard", detail: "Free access or checkout starts after account sign-in", status: "Access" },
    ],
    sideTitle: "Visitor entry",
    sideRows: ["Search courses", "Open org portal", "Enroll with account", "Return to course"],
    actions: ["Search catalog", "View portals", "Start"],
  },
  {
    id: "studio",
    title: "Studio And Lesson Builder",
    shortTitle: "Studio",
    headline: "Build lessons in Studio.",
    subtitle: "Notes, docs, slides, media, drafts, and lesson sections share one authoring surface.",
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
    headline: "Turn prompts into editable drafts.",
    subtitle: "AI creates outlines, slides, quizzes, rubrics, and flashcards with provider fallback.",
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
    title: "Teacher Review And Assignment",
    shortTitle: "Review",
    headline: "Review, assign, and grade.",
    subtitle: "Teachers approve drafts, set due dates, review submissions, and control final scores.",
    route: "/teacher/dashboard",
    icon: CalendarCheck,
    accent: "text-edsync-blue",
    tabs: ["Draft", "Media", "Due date", "Gradebook"],
    metrics: [
      { label: "Review", value: "Teacher" },
      { label: "Gradebook", value: "Weighted" },
      { label: "Notes", value: "Student-linked" },
    ],
    rows: [
      { title: "Publish check", detail: "Unsafe links, videos, uploads, and missing details stay visible", status: "Review" },
      { title: "Assignment setup", detail: "Class, due date, duration, points, and feedback rules", status: "Assign" },
      { title: "Submissions review", detail: "Score updates, comments, notes, and grade events", status: "Grade" },
    ],
    sideTitle: "Teacher actions",
    sideRows: ["Approve draft", "Set due date", "Update score", "Send note"],
    actions: ["Teacher dashboard", "Open gradebook", "Plan deadline"],
  },
  {
    id: "practice",
    title: "Practice And Student Learning",
    shortTitle: "Practice",
    headline: "Practice until it sticks.",
    subtitle: "Students use quizzes, flashcards, sprints, explanations, retries, and review cards.",
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
    title: "Progress, Evidence, And Admin Controls",
    shortTitle: "Progress",
    headline: "Progress becomes evidence.",
    subtitle: "Attempts feed grades, recommendations, provider audits, security logs, and dashboards.",
    route: "/admin/dashboard",
    icon: BarChart3,
    accent: "text-edsync-purple",
    tabs: ["Progress", "Feedback", "AI audit", "Security"],
    metrics: [
      { label: "Grade", value: "Event-led" },
      { label: "Providers", value: "Fallback" },
      { label: "Audit", value: "Logged" },
    ],
    rows: [
      { title: "Grade events", detail: "Attempts, overrides, excusals, and rubric changes remain auditable", status: "Record" },
      { title: "Recommendations", detail: "Missed concepts become review cards and next-step suggestions", status: "Guide" },
      { title: "Admin controls", detail: "AI providers, portals, permissions, security, catalog, and billing", status: "Manage" },
    ],
    sideTitle: "Evidence loop",
    sideRows: ["Save attempt", "Explain misses", "Recommend review", "Audit provider"],
    actions: ["Admin dashboard", "AI settings", "Security"],
  },
];

function WorkflowMockup({ slide }: { slide: WorkflowSlide }) {
  if (slide.id === "catalog") {
    return (
      <div className="edsync-workflow-app-mock edsync-workflow-app-mock-catalog">
        <div className="edsync-workflow-mock-toolbar">
          <span className="is-wide">Search public courses or academies</span>
          <span>Free</span>
          <span>30 min</span>
        </div>
        <div className="edsync-workflow-mock-grid">
          <article className="edsync-workflow-course-card">
            <strong>Energy Transfer Lab</strong>
            <small>Grade 8 Science - free enrollment</small>
            <em>Open after sign in</em>
          </article>
          <article className="edsync-workflow-course-card">
            <strong>Partner academy</strong>
            <small>/org/riverside - public catalog</small>
            <em>Portal scoped</em>
          </article>
        </div>
      </div>
    );
  }

  if (slide.id === "studio") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-editor-ribbon">
          {["Style", "Text", "Insert", "Media", "AI", "Assign"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="edsync-workflow-slide-editor">
          <aside>
            <span className="is-active">01</span>
            <span>02</span>
            <span>03</span>
          </aside>
          <section>
            <small>Slide 03</small>
            <strong>Conduction vs convection</strong>
            <div>
              <span>Image</span>
              <span>Video</span>
              <span>Quiz block</span>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (slide.id === "ai") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-ai-grid">
          <section>
            <small>Prompt builder</small>
            <strong>Grade 8 - 35 minutes - student friendly</strong>
            <span>Output: slides + quiz + rubric</span>
          </section>
          <section>
            <small>Provider</small>
            <strong>Groq ready</strong>
            <span>Google fallback enabled</span>
          </section>
        </div>
        <div className="edsync-workflow-preview-rows">
          <span>
            <strong>Generated slide deck</strong>
            <small>6 editable slides, teacher review required</small>
            <em>Insert into Studio</em>
          </span>
        </div>
      </div>
    );
  }

  if (slide.id === "teacher") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-assignment-grid">
          <section>
            <small>Assign</small>
            <strong>Grade 8 Science</strong>
            <span>Due Friday, 4:00 PM</span>
            <span>12 questions - 24 pts</span>
          </section>
          <section>
            <small>Review</small>
            <strong>3 submissions waiting</strong>
            <span>Media checks passed</span>
            <span>AI feedback draft ready</span>
          </section>
        </div>
      </div>
    );
  }

  if (slide.id === "practice") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-practice-card">
          <div>
            <small>Practice sprint</small>
            <strong>08:42</strong>
          </div>
          <span>Pause</span>
        </div>
        <div className="edsync-workflow-preview-rows">
          <span>
            <strong>Question 4 of 12</strong>
            <small>Explain why heat moved faster through metal.</small>
            <em>Retry missed</em>
          </span>
          <span>
            <strong>Review card saved</strong>
            <small>Mistake goes back to dashboard recommendations.</small>
            <em>Repeat</em>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="edsync-workflow-app-mock">
      <div className="edsync-workflow-admin-grid">
        <section>
          <small>Grade events</small>
          <strong>24 pts</strong>
          <span>Attempt graded</span>
        </section>
        <section>
          <small>AI providers</small>
          <strong>Healthy</strong>
          <span>Fallback audited</span>
        </section>
        <section>
          <small>Security</small>
          <strong>Clean</strong>
          <span>Upload checks logged</span>
        </section>
      </div>
      <div className="edsync-workflow-bar-chart" aria-hidden="true">
        <span style={{ height: "42%" }} />
        <span style={{ height: "66%" }} />
        <span style={{ height: "54%" }} />
        <span style={{ height: "78%" }} />
      </div>
    </div>
  );
}

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
            <WorkflowMockup slide={slide} />
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
                  Scroll through the learning loop.
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-8 text-edsync-subtle">
                  Watch one course move from public discovery to Studio, AI, teacher review, practice, and progress evidence.
                </p>
              </div>
              <div className="edsync-workflow-bridge-window" aria-hidden="true">
                {[
                  ["Catalog", "/catalog/[course]", "Search, preview, enroll"],
                  ["Studio", "/studio", "Slides, media, safe links"],
                  ["AI insert", "/ai", "Outline, quiz, rubric"],
                  ["Review", "/teacher/work", "Approve, assign, grade"],
                  ["Practice", "/practice", "Timer, retry, explain"],
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
