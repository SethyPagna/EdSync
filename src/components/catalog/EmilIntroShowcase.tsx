"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
  UserRound,
  type LucideIcon,
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
  image: string;
  summary: string;
  tags: string[];
};

type WorkflowSlide = {
  id: "catalog" | "access" | "canvas" | "assign" | "practice" | "proof";
  icon: LucideIcon;
  title: string;
  tabLabel: string;
  detail: string;
  route: string;
  image: string;
  panelTitle: string;
  pills: string[];
};

type SectionTransition = "idle" | "to-workflow" | "to-catalog" | "to-hero";

const previewSlides: PreviewSlide[] = [
  {
    id: "login",
    eyebrow: "Workspace entrance",
    title: "Choose the right path",
    route: "/auth/login",
    accent: "access",
    image: "/showcase/login-organization.jpg",
    summary: "Individual learners and organization users enter through one clear account flow.",
    tags: ["Catalog", "Organization", "Return path"],
  },
  {
    id: "teacher",
    eyebrow: "Teacher lesson canvas",
    title: "Create lessons",
    route: "/teacher/lessons/create",
    accent: "studio",
    image: "/showcase/teacher-create.jpg",
    summary: "Teachers can start with AI, a draft, or a blank canvas.",
    tags: ["AI draft", "Canvas", "Templates"],
  },
  {
    id: "student",
    eyebrow: "Student learning",
    title: "Continue learning",
    route: "/student/dashboard",
    accent: "practice",
    image: "/showcase/student-dashboard.jpg",
    summary: "Learners see progress, catalog courses, practice, and class context in one place.",
    tags: ["Progress", "Practice", "Catalog"],
  },
  {
    id: "admin",
    eyebrow: "Platform control",
    title: "Admin command",
    route: "/admin/dashboard",
    accent: "admin",
    image: "/showcase/admin-dashboard.jpg",
    summary: "Owners manage portals, permissions, governance, and platform evidence.",
    tags: ["Admin", "Governance", "Audit"],
  },
];

const workflowSlides: WorkflowSlide[] = [
  {
    id: "catalog",
    icon: Search,
    title: "Choose the right entrance",
    tabLabel: "Entrance",
    detail: "Individual catalog. Organization portal. Teacher and student views.",
    route: "/catalog",
    image: "/showcase/login-organization.jpg",
    panelTitle: "Catalog and access",
    pills: ["Individual", "Organization", "Teacher + Student"],
  },
  {
    id: "access",
    icon: UserRound,
    title: "Sign in with context",
    tabLabel: "Access",
    detail: "One login understands personal or organization access.",
    route: "/auth/login",
    image: "/showcase/login-organization.jpg",
    panelTitle: "Workspace access",
    pills: ["Organization code", "Individual workspace", "Return after login"],
  },
  {
    id: "canvas",
    icon: Layers3,
    title: "Create with a lesson canvas",
    tabLabel: "Create",
    detail: "Templates, media, quizzes, and practice stay on the lesson canvas.",
    route: "/teacher/lessons/create",
    image: "/showcase/teacher-create.jpg",
    panelTitle: "Lesson Creation Studio",
    pills: ["Templates", "Elements", "Bottom pages"],
  },
  {
    id: "assign",
    icon: CheckCircle2,
    title: "Assign work with context",
    tabLabel: "Assign",
    detail: "Class work, deadlines, and scoring stay connected.",
    route: "/teacher/work",
    image: "/showcase/teacher-work.jpg",
    panelTitle: "Class work",
    pills: ["Assignments", "Deadlines", "Weighted score"],
  },
  {
    id: "practice",
    icon: Brain,
    title: "Learning stays personal",
    tabLabel: "Practice",
    detail: "Courses, assignments, and AI practice meet in one student space.",
    route: "/student/dashboard",
    image: "/showcase/student-dashboard.jpg",
    panelTitle: "Student dashboard",
    pills: ["Catalog courses", "Practice & AI", "Class join"],
  },
  {
    id: "proof",
    icon: BarChart3,
    title: "Progress becomes evidence",
    tabLabel: "Proof",
    detail: "Grades, feedback, reports, and audit trails connect the story.",
    route: "/admin/dashboard",
    image: "/showcase/admin-dashboard.jpg",
    panelTitle: "Evidence dashboard",
    pills: ["Gradebook", "Reports", "Admin audit"],
  },
];

export default function EmilIntroShowcase({ labels }: EmilIntroShowcaseProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [workflowIndex, setWorkflowIndex] = useState(0);
  const heroRef = useRef<HTMLElement | null>(null);
  const workflowRef = useRef<HTMLElement | null>(null);
  const catalogRef = useRef<HTMLElement | null>(null);
  const workflowIndexRef = useRef(0);
  const wheelCooldownRef = useRef(0);
  const sectionTransitionTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [sectionTransition, setSectionTransition] = useState<SectionTransition>("idle");
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
        detail: "Personal catalog and practice.",
        icon: UserRound,
        href: "/auth/signup?mode=individual",
      },
      {
        id: "organization",
        label: organizationLabel,
        detail: `${teacherLabel} and ${studentLabel} portal.`,
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

  const moveToSection = useCallback((target: HTMLElement | null, transition: Exclude<SectionTransition, "idle">) => {
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sectionTransitionTimerRef.current) {
      window.clearTimeout(sectionTransitionTimerRef.current);
    }
    if (reduceMotion) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
      setSectionTransition("idle");
      return;
    }
    setSectionTransition(transition);
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    sectionTransitionTimerRef.current = window.setTimeout(() => {
      setSectionTransition("idle");
      sectionTransitionTimerRef.current = null;
    }, 760);
  }, []);

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
        moveToSection(heroRef.current, "to-hero");
        return true;
      }
      if (nextIndex >= workflowSlides.length) {
        moveToSection(catalogRef.current, "to-catalog");
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
  }, [moveToSection, setWorkflowSlide]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReducedMotion.matches) return;

    const sectionIsCentered = (section: HTMLElement, topWeight = 0.22, bottomWeight = 0.78) => {
      const rect = section.getBoundingClientRect();
      return rect.top < window.innerHeight * topWeight && rect.bottom > window.innerHeight * bottomWeight;
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 28 || Date.now() < wheelCooldownRef.current) return;
      const hero = heroRef.current;
      const workflow = workflowRef.current;
      const catalog = catalogRef.current;

      if (event.deltaY > 0 && hero && workflow && sectionIsCentered(hero, 0.34, 0.56)) {
        event.preventDefault();
        wheelCooldownRef.current = Date.now() + 720;
        moveToSection(workflow, "to-workflow");
        return;
      }

      if (event.deltaY < 0 && catalog && workflow && sectionIsCentered(catalog, 0.42, 0.72)) {
        event.preventDefault();
        wheelCooldownRef.current = Date.now() + 720;
        setWorkflowSlide(workflowSlides.length - 1);
        moveToSection(workflow, "to-workflow");
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, [moveToSection, setWorkflowSlide]);

  useEffect(() => {
    return () => {
      if (sectionTransitionTimerRef.current) {
        window.clearTimeout(sectionTransitionTimerRef.current);
      }
    };
  }, []);

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
    <main className="edsync-emil-intro" data-section-transition={sectionTransition}>
      <div className="edsync-emil-section-transition" aria-hidden="true" />
      <section ref={heroRef} className="edsync-emil-hero" aria-labelledby="emil-intro-title">
        <div className="edsync-emil-floating">
          <Link href="/" className="edsync-emil-brand" aria-label="EdSync home">
            <span>
              <GraduationCap className="h-5 w-5" />
            </span>
            <strong>EdSync</strong>
            <small>{brandSubhead}</small>
          </Link>
          <div className="edsync-emil-actions">
            <a
              href="#emil-catalog"
              className="edsync-emil-jump"
              onClick={(event) => {
                event.preventDefault();
                moveToSection(catalogRef.current, "to-catalog");
              }}
            >
              {labels.catalog}
            </a>
            <a
              href="#emil-workflow"
              className="edsync-emil-jump"
              onClick={(event) => {
                event.preventDefault();
                moveToSection(workflowRef.current, "to-workflow");
              }}
            >
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
            <h1 id="emil-intro-title">Teach. Practice. Prove.</h1>
            <p>Individual and organization access in one workspace.</p>
            <div className="edsync-emil-roles" aria-label="EdSync role paths">
              {roleCards.map((role) => {
                const Icon = role.icon;
                return (
                  <Link key={role.id} href={role.href} aria-label={`${role.label}: ${role.detail}`}>
                    <Icon className="h-4 w-4" />
                    <span>
                      <strong>{role.label}</strong>
                      <small>{role.detail}</small>
                    </span>
                    <em>{role.detail}</em>
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
            <div className="edsync-emil-device-body edsync-emil-shot-body">
              <figure className={`edsync-emil-shot-frame is-${preview.accent}`}>
                <Image
                  src={preview.image}
                  alt={`${preview.title} page preview`}
                  fill
                  priority={previewIndex === 0}
                  sizes="(max-width: 760px) 100vw, 58vw"
                />
                <figcaption>
                  <small>{preview.eyebrow}</small>
                  <strong>{preview.title}</strong>
                  <p>{preview.summary}</p>
                  <span>
                    {preview.tags.map((tag) => (
                      <em key={tag}>{tag}</em>
                    ))}
                  </span>
                </figcaption>
              </figure>
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
        <div key={workflow.id} className="edsync-emil-workflow-card">
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
              <figure className={`edsync-emil-workflow-visual is-${workflow.id}`}>
                <Image
                  src={workflow.image}
                  alt={`${workflow.panelTitle} actual EdSync page`}
                  fill
                  priority={workflowIndex === 0}
                  sizes="(max-width: 760px) 100vw, 58vw"
                />
                <figcaption>
                  <small>{workflow.route}</small>
                  <strong>{workflow.panelTitle}</strong>
                  <span>
                    {workflow.pills.map((pill) => (
                      <em key={pill}>{pill}</em>
                    ))}
                  </span>
                </figcaption>
              </figure>
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
                onClick={() => setWorkflowSlide(index)}
              >
                <Icon className="h-4 w-4" />
                <span>{slide.tabLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="emil-catalog" ref={catalogRef} className="edsync-emil-catalog">
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
