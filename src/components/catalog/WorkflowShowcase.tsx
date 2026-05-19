"use client";

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getPublicCopy } from "@/lib/public/i18n";
import { normalizePublicLanguage } from "@/lib/public/languages";

type WorkflowShowcaseProps = {
  language?: string | null;
};

type WorkflowLabels = {
  catalog: string;
  studio: string;
  ai: string;
  practice: string;
  grades: string;
  courses: string;
  search: string;
  filters: string;
  start: string;
  signIn: string;
  free: string;
  paid: string;
  duration: string;
  difficulty: string;
  featured: string;
  workflow: string;
  media: string;
  provider: string;
  review: string;
  security: string;
  healthy: string;
};

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

function labelsForLanguage(language?: string | null): WorkflowLabels {
  const publicLanguage = normalizePublicLanguage(language);
  const copy = getPublicCopy(publicLanguage);
  const [, studio = "Studio", ai = "AI", practice = "Practice", fallbackGrades = "Progress"] = copy.heroTags;
  const progressLabels: Record<string, string> = {
    Chinese: "进度",
    English: "Progress",
    French: "Progrès",
    Japanese: "進捗",
    Khmer: "វឌ្ឍនភាព",
    Korean: "진도",
    Spanish: "Progreso",
    Thai: "ความก้าวหน้า",
    Vietnamese: "Tiến bộ",
  };
  const utilityLabels: Record<string, Pick<WorkflowLabels, "media" | "provider" | "review" | "security" | "healthy">> = {
    Chinese: { media: "媒体", provider: "提供商", review: "审核", security: "安全", healthy: "正常" },
    English: { media: "Media", provider: "Provider", review: "Review", security: "Security", healthy: "Healthy" },
    French: { media: "Médias", provider: "Fournisseur", review: "Revue", security: "Sécurité", healthy: "OK" },
    Japanese: { media: "メディア", provider: "プロバイダー", review: "確認", security: "セキュリティ", healthy: "正常" },
    Khmer: { media: "មេឌៀ", provider: "អ្នកផ្តល់", review: "ពិនិត្យ", security: "សុវត្ថិភាព", healthy: "ល្អ" },
    Korean: { media: "미디어", provider: "제공자", review: "검토", security: "보안", healthy: "정상" },
    Spanish: { media: "Medios", provider: "Proveedor", review: "Revisión", security: "Seguridad", healthy: "Correcto" },
    Thai: { media: "สื่อ", provider: "ผู้ให้บริการ", review: "ตรวจทาน", security: "ความปลอดภัย", healthy: "พร้อม" },
    Vietnamese: { media: "Phương tiện", provider: "Nhà cung cấp", review: "Duyệt", security: "Bảo mật", healthy: "Ổn định" },
  };
  const grades = progressLabels[publicLanguage] ?? fallbackGrades;
  const utility = utilityLabels[publicLanguage] ?? utilityLabels.English;

  return {
    catalog: copy.catalogLabel,
    studio,
    ai,
    practice,
    grades,
    courses: copy.courses,
    search: copy.searchButton,
    filters: copy.filters,
    start: copy.start,
    signIn: copy.signIn,
    free: copy.free,
    paid: copy.paid,
    duration: copy.anyDuration,
    difficulty: copy.difficulty,
    featured: copy.featured,
    workflow: copy.workflowLabel,
    ...utility,
  };
}

function buildWorkflowSlides(labels: WorkflowLabels): WorkflowSlide[] {
  return [
  {
    id: "overview",
    title: `${labels.start} + ${labels.workflow}`,
    shortTitle: labels.start,
    headline: `${labels.courses}. ${labels.studio}. ${labels.practice}.`,
    subtitle: `${labels.catalog}, ${labels.studio}, ${labels.ai}, ${labels.practice}, ${labels.grades}.`,
    route: "/catalog#catalog-search-panel",
    icon: Wand2,
    accent: "text-edsync-emerald",
    tabs: [labels.catalog, labels.studio, labels.ai, labels.practice, labels.grades],
    metrics: [
      { label: labels.workflow, value: "6" },
      { label: labels.studio, value: labels.start },
      { label: labels.grades, value: labels.practice },
    ],
    rows: [
      { title: labels.catalog, detail: `${labels.search}, ${labels.filters}, ${labels.signIn}`, status: labels.search },
      { title: labels.studio, detail: `${labels.courses}, ${labels.ai}, ${labels.practice}`, status: labels.start },
      { title: labels.practice, detail: `${labels.practice}, ${labels.grades}, ${labels.workflow}`, status: labels.grades },
    ],
    sideTitle: "EdSync",
    sideRows: [labels.catalog, labels.studio, labels.ai, labels.practice],
    actions: [labels.workflow, labels.search, labels.start],
  },
  {
    id: "catalog",
    title: labels.catalog,
    shortTitle: labels.catalog,
    headline: `${labels.search} ${labels.courses.toLowerCase()}.`,
    subtitle: `${labels.catalog}: ${labels.free}, ${labels.paid}, ${labels.duration}, ${labels.difficulty}.`,
    route: "/catalog",
    icon: Search,
    accent: "text-edsync-cyan",
    tabs: [labels.search, labels.featured, labels.start, labels.signIn],
    metrics: [
      { label: "Routes", value: "/catalog" },
      { label: labels.courses, value: `${labels.free} + ${labels.paid}` },
      { label: labels.signIn, value: labels.start },
    ],
    rows: [
      { title: labels.search, detail: `${labels.filters}: ${labels.free}, ${labels.paid}, ${labels.duration}`, status: labels.search },
      { title: labels.featured, detail: `${labels.catalog} -> ${labels.courses}`, status: labels.catalog },
      { title: labels.signIn, detail: `${labels.signIn} -> ${labels.start}`, status: labels.start },
    ],
    sideTitle: labels.catalog,
    sideRows: [labels.search, labels.filters, labels.signIn, labels.start],
    actions: [labels.search, labels.catalog, labels.start],
  },
  {
    id: "studio",
    title: labels.studio,
    shortTitle: labels.studio,
    headline: `${labels.studio} -> ${labels.courses}.`,
    subtitle: `${labels.studio}: ${labels.courses}, ${labels.ai}, ${labels.practice}, ${labels.grades}.`,
    route: "/studio?tab=slides",
    icon: Presentation,
    accent: "text-edsync-blue",
    tabs: [labels.studio, labels.courses, labels.ai, labels.start],
    metrics: [
      { label: labels.studio, value: "Tiptap" },
      { label: labels.courses, value: "PPTX" },
      { label: labels.start, value: "D1" },
    ],
    rows: [
      { title: labels.studio, detail: `${labels.courses}, ${labels.ai}, ${labels.practice}`, status: labels.start },
      { title: labels.courses, detail: `${labels.studio} -> ${labels.courses}`, status: labels.courses },
      { title: labels.practice, detail: `${labels.practice} -> ${labels.grades}`, status: labels.grades },
    ],
    sideTitle: labels.studio,
    sideRows: [labels.studio, labels.courses, labels.ai, labels.practice],
    actions: [labels.studio, labels.courses, labels.start],
  },
  {
    id: "ai",
    title: labels.ai,
    shortTitle: "AI",
    headline: `${labels.ai} -> ${labels.studio}.`,
    subtitle: `${labels.ai}: ${labels.courses}, ${labels.practice}, ${labels.grades}.`,
    route: "/ai",
    icon: Wand2,
    accent: "text-edsync-emerald",
    tabs: [labels.ai, labels.studio, labels.practice, labels.start],
    metrics: [
      { label: labels.ai, value: "Groq" },
      { label: labels.ai, value: "Google" },
      { label: labels.studio, value: labels.start },
    ],
    rows: [
      { title: labels.ai, detail: `${labels.duration}, ${labels.difficulty}, ${labels.courses}`, status: labels.start },
      { title: labels.practice, detail: `${labels.ai} -> ${labels.practice}`, status: labels.practice },
      { title: labels.studio, detail: `${labels.ai} -> ${labels.studio}`, status: labels.studio },
    ],
    sideTitle: labels.ai,
    sideRows: [labels.ai, labels.studio, labels.practice, labels.grades],
    actions: [labels.ai, labels.studio, labels.start],
  },
  {
    id: "teacher",
    title: labels.grades,
    shortTitle: labels.grades,
    headline: `${labels.practice} -> ${labels.grades}.`,
    subtitle: `${labels.grades}: ${labels.practice}, ${labels.courses}, ${labels.start}.`,
    route: "/teacher/dashboard",
    icon: CalendarCheck,
    accent: "text-edsync-blue",
    tabs: [labels.studio, labels.practice, labels.duration, labels.grades],
    metrics: [
      { label: labels.grades, value: labels.start },
      { label: labels.grades, value: "24 pts" },
      { label: labels.practice, value: labels.courses },
    ],
    rows: [
      { title: labels.studio, detail: `${labels.studio} -> ${labels.practice}`, status: labels.start },
      { title: labels.duration, detail: `${labels.duration}, ${labels.grades}`, status: labels.practice },
      { title: labels.grades, detail: `${labels.grades} -> ${labels.practice}`, status: labels.grades },
    ],
    sideTitle: labels.grades,
    sideRows: [labels.studio, labels.duration, labels.grades, labels.practice],
    actions: [labels.grades, labels.practice, labels.start],
  },
  {
    id: "practice",
    title: labels.practice,
    shortTitle: labels.practice,
    headline: `${labels.practice}. ${labels.grades}.`,
    subtitle: `${labels.practice}: quiz, sprint, flashcards, retry, review.`,
    route: "/practice",
    icon: Trophy,
    accent: "text-edsync-amber",
    tabs: [labels.practice, labels.duration, labels.grades, labels.start],
    metrics: [
      { label: labels.practice, value: "9" },
      { label: labels.duration, value: "08:42" },
      { label: "Route", value: "/practice" },
    ],
    rows: [
      { title: labels.practice, detail: "quiz, exam, flashcards, sprint", status: labels.start },
      { title: labels.duration, detail: `${labels.duration}, ${labels.grades}`, status: labels.practice },
      { title: labels.grades, detail: `${labels.practice} -> ${labels.grades}`, status: labels.grades },
    ],
    sideTitle: labels.practice,
    sideRows: [labels.practice, labels.duration, labels.grades, labels.start],
    actions: [labels.practice, labels.start, labels.grades],
  },
  {
    id: "admin",
    title: `${labels.grades} + Admin`,
    shortTitle: labels.grades,
    headline: `${labels.grades} -> Admin.`,
    subtitle: `${labels.grades}, ${labels.ai}, ${labels.catalog}, ${labels.practice}.`,
    route: "/admin/dashboard",
    icon: BarChart3,
    accent: "text-edsync-purple",
    tabs: [labels.grades, labels.practice, labels.ai, labels.catalog],
    metrics: [
      { label: labels.grades, value: "Events" },
      { label: labels.ai, value: "Fallback" },
      { label: labels.catalog, value: "Audit" },
    ],
    rows: [
      { title: labels.grades, detail: `${labels.practice} -> ${labels.grades}`, status: "Audit" },
      { title: labels.practice, detail: `${labels.practice} -> ${labels.start}`, status: labels.practice },
      { title: labels.ai, detail: `${labels.ai}, ${labels.catalog}, ${labels.grades}`, status: labels.ai },
    ],
    sideTitle: labels.grades,
    sideRows: [labels.practice, labels.grades, labels.ai, labels.catalog],
    actions: [labels.grades, labels.ai, labels.catalog],
  },
  ];
}

function WorkflowMockup({ labels, slide }: { labels: WorkflowLabels; slide: WorkflowSlide }) {
  if (slide.id === "overview") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-loop-map">
          {[
            [labels.catalog, `${labels.search}, ${labels.free}, ${labels.start}`],
            [labels.studio, `${labels.courses}, slides, ${labels.media}`],
            [labels.ai, `${labels.courses}, quiz, rubric`],
            [labels.practice, `${labels.duration}, retry, ${labels.review}`],
            [labels.grades, `events, ${labels.review}, proof`],
          ].map(([label, detail], index) => (
            <span key={label} className={index === 0 ? "is-active" : ""}>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (slide.id === "catalog") {
    return (
      <div className="edsync-workflow-app-mock edsync-workflow-app-mock-catalog">
        <div className="edsync-workflow-mock-toolbar">
          <span className="is-wide">{labels.search} {labels.courses.toLowerCase()}</span>
          <span>{labels.free}</span>
          <span>30m</span>
        </div>
        <div className="edsync-workflow-mock-grid">
          <article className="edsync-workflow-course-card">
            <strong>{labels.courses}</strong>
            <small>{labels.difficulty} - {labels.free}</small>
            <em>{labels.signIn} {"->"} {labels.start}</em>
          </article>
          <article className="edsync-workflow-course-card">
            <strong>{labels.featured}</strong>
            <small>/org/riverside - {labels.catalog}</small>
            <em>{labels.featured}</em>
          </article>
        </div>
      </div>
    );
  }

  if (slide.id === "studio") {
    return (
      <div className="edsync-workflow-app-mock">
        <div className="edsync-workflow-editor-ribbon">
          {[labels.studio, "Text", "Insert", labels.media, labels.ai, labels.start].map((item) => (
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
            <small>{labels.studio} 03</small>
            <strong>{labels.courses}</strong>
            <div>
              <span>Image</span>
              <span>{labels.media}</span>
              <span>{labels.practice}</span>
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
            <small>{labels.ai}</small>
            <strong>{labels.difficulty} - 35m</strong>
            <span>{labels.studio} + {labels.practice} + rubric</span>
          </section>
          <section>
            <small>{labels.provider}</small>
            <strong>{labels.healthy}</strong>
            <span>Groq + Google</span>
          </section>
        </div>
        <div className="edsync-workflow-preview-rows">
          <span>
            <strong>{labels.studio}</strong>
            <small>6 slides, {labels.review}</small>
            <em>{labels.ai} {"->"} {labels.studio}</em>
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
            <small>{labels.start}</small>
            <strong>{labels.courses}</strong>
            <span>{labels.duration}: 35m</span>
            <span>12 questions - 24 pts</span>
          </section>
          <section>
            <small>{labels.grades}</small>
            <strong>3 submissions</strong>
            <span>{labels.media} checks</span>
            <span>{labels.ai} {labels.review}</span>
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
            <small>{labels.practice}</small>
            <strong>08:42</strong>
          </div>
          <span>{labels.duration}</span>
        </div>
        <div className="edsync-workflow-preview-rows">
          <span>
            <strong>4 / 12</strong>
            <small>{labels.practice}, {labels.review}</small>
            <em>{labels.practice}</em>
          </span>
          <span>
            <strong>{labels.grades}</strong>
            <small>{labels.practice} {"->"} {labels.grades}</small>
            <em>{labels.start}</em>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="edsync-workflow-app-mock">
      <div className="edsync-workflow-admin-grid">
        <section>
          <small>{labels.grades}</small>
          <strong>24 pts</strong>
          <span>Attempt graded</span>
        </section>
        <section>
          <small>{labels.ai}</small>
          <strong>{labels.healthy}</strong>
          <span>Fallback audited</span>
        </section>
        <section>
          <small>{labels.security}</small>
          <strong>{labels.healthy}</strong>
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
  labels,
  slide,
  index,
  total,
}: {
  labels: WorkflowLabels;
  slide: WorkflowSlide;
  index: number;
  total: number;
}) {
  const ActiveIcon = slide.icon;

  return (
    <article className="edsync-workflow-screen" aria-label={slide.title}>
      <div className="edsync-workflow-copy">
        <div className="edsync-workflow-count">
          <ActiveIcon className="h-4 w-4" />
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
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
            {labels.start}
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
            <WorkflowMockup labels={labels} slide={slide} />
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

export default function WorkflowShowcase({ language }: WorkflowShowcaseProps) {
  const labels = useMemo(() => labelsForLanguage(language), [language]);
  const slides = useMemo(() => buildWorkflowSlides(labels), [labels]);
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeIndexRef = useRef(0);
  const manualControlUntilRef = useRef(0);
  const scrollControlUntilRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const activeSlide = slides[activeIndex] ?? slides[0];

  const setActiveSlide = useCallback((index: number) => {
    const safeIndex = (index + slides.length) % slides.length;
    if (activeIndexRef.current === safeIndex) return;
    activeIndexRef.current = safeIndex;
    startTransition(() => setActiveIndex(safeIndex));
  }, [slides.length]);

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
    const section = document.getElementById("showcase");
    if (!section || !window.matchMedia("(min-width: 901px)").matches) return;

    const isMostlyInWorkflow = () => {
      const rect = section.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.25 && rect.bottom > window.innerHeight * 0.74;
    };

    const triggerStep = (direction: 1 | -1) => {
      if (!isMostlyInWorkflow() || Date.now() < scrollControlUntilRef.current) return;
      scrollControlUntilRef.current = Date.now() + 620;
      manualControlUntilRef.current = Date.now() + 1200;
      setActiveSlide(activeIndexRef.current + direction);
    };

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 28) return;
      triggerStep(event.deltaY > 0 ? 1 : -1);
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartYRef.current = null;
      if (startY == null || endY == null || Math.abs(startY - endY) < 42) return;
      triggerStep(startY > endY ? 1 : -1);
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
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
  }, [setActiveSlide, slides.length]);

  return (
    <>
      <section id="showcase" className="edsync-workflow-showcase scroll-mt-24">
        <div className="edsync-workflow-sticky">
          <div className="edsync-workflow-heading">
            <div>
              <span className="edsync-workflow-eyebrow">
                <Wand2 className="h-4 w-4" />
                {labels.workflow}
              </span>
            </div>
            <span className="edsync-workflow-live-label">{labels.start}</span>
          </div>

          <div className="edsync-workflow-stage">
            <WorkflowScreen
              key={activeSlide.id}
              labels={labels}
              slide={activeSlide}
              index={activeIndex}
              total={slides.length}
            />
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
