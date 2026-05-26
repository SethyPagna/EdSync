"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";

type EmilIntroShowcaseProps = {
  labels: {
    signIn: string;
    start: string;
    catalog: string;
    search: string;
    courses: string;
    free: string;
    paid: string;
    filters: string;
    workflow?: string;
    individual?: string;
    organization?: string;
    teacher?: string;
    student?: string;
    brandSubhead?: string;
  };
};

type PreviewSlide = {
  id: string;
  eyebrow: string;
  title: string;
  route: string;
  accent: string;
  left: string[];
  canvasTitle: string;
  canvasRows: string[];
  sideTitle: string;
  sideRows: string[];
};

const previewSlides: PreviewSlide[] = [
  {
    id: "teacher",
    eyebrow: "Teacher lesson canvas",
    title: "Create Lesson",
    route: "/teacher/lessons/create",
    accent: "studio",
    left: ["Templates", "Elements", "Text", "Uploads", "AI"],
    canvasTitle: "Lesson pages",
    canvasRows: ["Template applied", "Media checked", "Practice block ready"],
    sideTitle: "Class work",
    sideRows: ["Due date synced", "Weighted score optional", "Feedback draft saved"],
  },
  {
    id: "student",
    eyebrow: "Student support",
    title: "Practice & AI Tutor",
    route: "/practice",
    accent: "practice",
    left: ["Lessons", "My Work", "Planner", "Notes", "Grades"],
    canvasTitle: "Retry missed questions",
    canvasRows: ["Misses saved", "AI explains why", "Review card scheduled"],
    sideTitle: "Active time",
    sideRows: ["Focused time tracked", "Notifications toggled", "Deadline synced"],
  },
  {
    id: "catalog",
    eyebrow: "Public catalog",
    title: "Find a course",
    route: "/catalog",
    accent: "catalog",
    left: ["Individual", "Organization", "Free", "Paid", "Portal"],
    canvasTitle: "Course marketplace",
    canvasRows: ["Search public courses", "Enter organization portal", "Sign in before enroll"],
    sideTitle: "Access",
    sideRows: ["Preview lesson", "Free enrollment", "Paid checkout"],
  },
  {
    id: "admin",
    eyebrow: "Platform control",
    title: "Admin command",
    route: "/admin/dashboard",
    accent: "admin",
    left: ["Users", "Portals", "AI Providers", "Security", "Settings"],
    canvasTitle: "AI provider routing",
    canvasRows: ["Provider health", "Fallback order", "Encrypted keys"],
    sideTitle: "Audit",
    sideRows: ["View-as logged", "Feature flags", "Tenant scoped"],
  },
];

const workflowSlides = [
  {
    id: "catalog",
    icon: Search,
    title: "Choose the right entrance",
    detail: "Individuals start from the course catalog. Organizations keep teacher and student work inside one portal.",
    route: "/catalog",
    rail: ["Catalog", "Portal", "Sign in"],
    panelTitle: "Public catalog",
    rows: ["Search by topic, price, duration", "Preview course details", "Return after sign in"],
    sideTitle: "Organization",
    sideRows: ["Teachers", "Students", "Manager controls"],
    pills: ["Individual", "Organization", "Teacher + Student"],
  },
  {
    id: "canvas",
    icon: Layers3,
    title: "Create with a lesson canvas",
    detail: "Lessons are pages with templates, elements, text, media, quiz blocks, practice cards, and bottom page navigation.",
    route: "/teacher/lessons/create",
    rail: ["Templates", "Elements", "Text", "Uploads"],
    panelTitle: "Lesson Creation Studio",
    rows: ["Apply template", "Add media cue", "Insert quiz block"],
    sideTitle: "Pages",
    sideRows: ["1 Title", "2 Activity", "3 Review"],
    pills: ["Templates", "Elements", "Bottom pages"],
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI drafts into designs",
    detail: "AI can start from a blank lesson, build a full draft, or format responses into the selected lesson template.",
    route: "/teacher/lessons/create?mode=ai",
    rail: ["AI draft", "Full AI", "Blank", "Style"],
    panelTitle: "AI Co-creator",
    rows: ["Topic + grade level", "Slides + speaker notes", "Quiz + rubric generated"],
    sideTitle: "Teacher review",
    sideRows: ["Editable draft", "Apply template", "No auto-publish"],
    pills: ["AI draft", "Full AI", "Blank lesson"],
  },
  {
    id: "assign",
    icon: CheckCircle2,
    title: "Assign work with context",
    detail: "Assignments, discussions, planner deadlines, projects, quizzes, and participation criteria stay tied to the class.",
    route: "/teacher/work",
    rail: ["Work", "Planner", "Discussion", "Grade"],
    panelTitle: "Class work",
    rows: ["Attach lesson pages", "Set deadline", "Weight 5% or completion only"],
    sideTitle: "Feedback",
    sideRows: ["Rich note", "Grade visible", "Revisions open"],
    pills: ["Assignments", "Deadlines", "Weighted score"],
  },
  {
    id: "practice",
    icon: Brain,
    title: "Practice feels playable",
    detail: "Practice and AI Tutor live together with quiz, sprint, retry missed, matching, flashcards, timers, and explanations.",
    route: "/practice",
    rail: ["Quiz", "Sprint", "Retry", "Explain"],
    panelTitle: "Practice & AI Tutor",
    rows: ["Generate from lesson", "Speed + accuracy", "Save misses to review"],
    sideTitle: "Live run",
    sideRows: ["Timer 05:00", "Points +120", "Next hint ready"],
    pills: ["Color feedback", "Timer", "Review queue"],
  },
  {
    id: "proof",
    icon: BarChart3,
    title: "Progress becomes evidence",
    detail: "Student work, feedback, time spent, grade events, reports, and admin audit trails stay connected.",
    route: "/admin/dashboard",
    rail: ["Grades", "Reports", "AI", "Security"],
    panelTitle: "Evidence dashboard",
    rows: ["Score out of work points", "Weighted toward course grade", "Participation criteria tracked"],
    sideTitle: "Admin",
    sideRows: ["Provider health", "View-as audited", "Tenant scoped"],
    pills: ["Gradebook", "Reports", "Admin audit"],
  },
];

function useAutoIndex(length: number, delayMs: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % length);
    }, delayMs);
    return () => window.clearInterval(timer);
  }, [delayMs, length]);

  return [index, setIndex] as const;
}

export default function EmilIntroShowcase({ labels }: EmilIntroShowcaseProps) {
  const [previewIndex, setPreviewIndex] = useAutoIndex(previewSlides.length, 4600);
  const [workflowIndex, setWorkflowIndex] = useAutoIndex(workflowSlides.length, 5200);
  const workflowRef = useRef<HTMLElement | null>(null);
  const workflowIndexRef = useRef(0);
  const wheelCooldownRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const preview = previewSlides[previewIndex];
  const workflow = workflowSlides[workflowIndex];
  const WorkflowIcon = workflow.icon;
  const workflowLabel = labels.workflow ?? "Workflow";
  const individualLabel = labels.individual ?? "Individual";
  const organizationLabel = labels.organization ?? "Organization";
  const teacherLabel = labels.teacher ?? "Teacher";
  const studentLabel = labels.student ?? "Student";
  const brandSubhead = labels.brandSubhead ?? "Teaching and learning workspace";
  const roleCards = useMemo(
    () => [
      {
        id: "individual",
        label: individualLabel,
        detail: "Catalog, purchased courses, personal notes, and independent practice.",
        icon: UserRound,
        href: "/auth/signup?mode=individual",
      },
      {
        id: "organization",
        label: organizationLabel,
        detail: `${teacherLabel} and ${studentLabel} access live inside the same portal.`,
        icon: Building2,
        href: "/auth/signup?mode=organization",
      },
    ],
    [individualLabel, organizationLabel, studentLabel, teacherLabel],
  );
  const setWorkflowSlide = useCallback((nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(workflowSlides.length - 1, nextIndex));
    workflowIndexRef.current = safeIndex;
    setWorkflowIndex(safeIndex);
  }, [setWorkflowIndex]);

  useEffect(() => {
    workflowIndexRef.current = workflowIndex;
  }, [workflowIndex]);

  useEffect(() => {
    const section = workflowRef.current;
    if (!section) return;

    const inViewport = () => {
      const rect = section.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.45;
    };

    const advance = (direction: 1 | -1, prevent?: () => void) => {
      if (!inViewport()) return false;
      prevent?.();
      const now = Date.now();
      if (now < wheelCooldownRef.current) return true;
      wheelCooldownRef.current = now + 520;
      const nextIndex = workflowIndexRef.current + direction;
      if (nextIndex < 0) {
        document.querySelector(".edsync-emil-hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      if (nextIndex >= workflowSlides.length) {
        document.getElementById("emil-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      setWorkflowSlide(nextIndex);
      return true;
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 24) return;
      if (!inViewport()) return;
      advance(event.deltaY > 0 ? 1 : -1, () => event.preventDefault());
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartYRef.current = null;
      if (startY == null || endY == null || Math.abs(startY - endY) < 44 || !inViewport()) return;
      advance(startY > endY ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    section.addEventListener("touchstart", onTouchStart, { passive: true });
    section.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchend", onTouchEnd);
    };
  }, [setWorkflowSlide]);

  const searchTags = useMemo(
    () => [
      `${labels.free} ${labels.courses}`,
      `${labels.paid} ${labels.courses}`,
      "Organization portal",
      "Practice and AI Tutor",
      "Teacher gradebook feedback",
    ],
    [labels.courses, labels.free, labels.paid],
  );

  return (
    <main className="edsync-emil-intro">
      <section className="edsync-emil-hero" aria-labelledby="emil-intro-title">
        <div className="edsync-emil-floating">
          <Link href="/" className="edsync-emil-brand" aria-label="EdSync home">
            <span>
              <GraduationCap className="h-5 w-5" />
            </span>
            <strong>EdSync</strong>
            <small>{brandSubhead}</small>
          </Link>
          <div className="edsync-emil-actions">
            <a href="#emil-catalog" className="edsync-emil-jump">
              {labels.catalog}
            </a>
            <a href="#emil-workflow" className="edsync-emil-jump">
              {workflowLabel}
            </a>
            <Link href="/auth/signup" className="edsync-emil-secondary">
              {labels.start}
            </Link>
            <ThemeToggle compact className="edsync-emil-icon" />
            <LanguageMenu compact syncCatalogFilter className="edsync-emil-icon" />
            <Link href="/auth/login" className="edsync-emil-signin">
              {labels.signIn}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="edsync-emil-hero-grid">
          <div className="edsync-emil-copy">
            <span className="edsync-emil-kicker">
              <Sparkles className="h-4 w-4" />
              Individual catalog or organization portal. One EdSync loop.
            </span>
            <h1 id="emil-intro-title">Teach. Practice. Prove progress.</h1>
            <p>
              Start as an individual learner, or enter an organization where teachers and students work together.
            </p>
            <div className="edsync-emil-roles" aria-label="EdSync role paths">
              {roleCards.map((role) => {
                const Icon = role.icon;
                return (
                  <Link key={role.id} href={role.href} title={role.detail}>
                    <Icon className="h-4 w-4" />
                    <span>
                      <strong>{role.label}</strong>
                      <small>{role.detail}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="edsync-emil-device" aria-label="EdSync workspace preview">
            <div className="edsync-emil-device-top">
              <span>{preview.eyebrow}</span>
              <Link href={preview.route}>{preview.route}</Link>
            </div>
            <div className="edsync-emil-device-body">
              <div className="edsync-emil-toolrail">
                {preview.left.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className={`edsync-emil-canvas is-${preview.accent}`}>
                <div className="edsync-emil-toolbar">
                  <span>Template</span>
                  <span>Text</span>
                  <span>Media</span>
                  <span>AI</span>
                </div>
                <article>
                  <small>{preview.title}</small>
                  <h2>{preview.canvasTitle}</h2>
                  {preview.canvasRows.map((row) => (
                    <p key={row}>
                      <CheckCircle2 className="h-4 w-4" />
                      {row}
                    </p>
                  ))}
                </article>
              </div>
              <aside className="edsync-emil-sidecard">
                <strong>{preview.sideTitle}</strong>
                {preview.sideRows.map((row) => (
                  <span key={row}>{row}</span>
                ))}
              </aside>
            </div>
            <div className="edsync-emil-dots" aria-label="Preview slides">
              {previewSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Show ${slide.title}`}
                  aria-current={previewIndex === index}
                  onClick={() => setPreviewIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="emil-workflow" ref={workflowRef} className="edsync-emil-workflow" aria-labelledby="emil-workflow-title">
        <div className="edsync-emil-workflow-card">
          <div className="edsync-emil-workflow-copy">
            <span>0{workflowIndex + 1} / 0{workflowSlides.length}</span>
            <h2 id="emil-workflow-title">{workflow.title}</h2>
            <p>{workflow.detail}</p>
            <div>
              {workflow.pills.map((pill) => (
                <small key={pill}>{pill}</small>
              ))}
            </div>
          </div>
          <div className="edsync-emil-workflow-screen">
            <div className="edsync-emil-workflow-window">
              <header>
                <WorkflowIcon className="h-7 w-7" />
                <div>
                  <strong>{workflow.panelTitle}</strong>
                  <span>{workflow.route}</span>
                </div>
              </header>
              <div className="edsync-emil-workflow-mock">
                <nav>
                  {workflow.rail.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </nav>
                <article>
                  <small>{workflow.title}</small>
                  <h3>{workflow.panelTitle}</h3>
                  {workflow.rows.map((row) => (
                    <p key={row}>{row}</p>
                  ))}
                </article>
                <aside>
                  <b>{workflow.sideTitle}</b>
                  {workflow.sideRows.map((row) => (
                    <span key={row}>{row}</span>
                  ))}
                </aside>
              </div>
            </div>
          </div>
        </div>
        <div className="edsync-emil-workflow-tabs">
          {workflowSlides.map((slide, index) => {
            const Icon = slide.icon;
            return (
              <button
                key={slide.id}
                type="button"
                aria-current={workflowIndex === index}
                onClick={() => setWorkflowIndex(index)}
              >
                <Icon className="h-4 w-4" />
                <span>{slide.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="emil-catalog" className="edsync-emil-catalog">
        <div className="edsync-emil-search">
          <div>
            <span>{labels.catalog}</span>
            <h2>Search courses and academies</h2>
          </div>
          <form action="/catalog">
            <Search className="h-4 w-4" />
            <input name="q" placeholder="Search courses, portals, practice, gradebook..." />
            <select name="price" defaultValue="all">
              <option value="all">{labels.free} + {labels.paid}</option>
              <option value="free">{labels.free}</option>
              <option value="paid">{labels.paid}</option>
            </select>
            <button type="submit">{labels.search}</button>
          </form>
          <div>
            {searchTags.map((tag) => (
              <Link key={tag} href={`/catalog?q=${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
