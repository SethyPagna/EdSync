"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Layers3,
  BookOpenCheck,
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
  darkImage: string;
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
  darkImage: string;
  panelTitle: string;
  pills: string[];
};

type SectionTransition = "idle" | "to-workflow" | "to-catalog" | "to-hero";
type PriceFilter = "all" | "free" | "paid";

const previewSlides: PreviewSlide[] = [
  {
    id: "login",
    eyebrow: "Workspace entrance",
    title: "Pick your space",
    route: "/auth/login",
    accent: "access",
    image: "/showcase/login-organization.jpg",
    darkImage: "/showcase/login-organization-dark.png",
    summary: "Individual work or organization portal.",
    tags: ["Individual", "Organization", "Owner"],
  },
  {
    id: "teacher",
    eyebrow: "Creator workspace",
    title: "Build courses",
    route: "/studio",
    accent: "studio",
    image: "/showcase/teacher-create.jpg",
    darkImage: "/showcase/teacher-create-dark.png",
    summary: "Create, publish, and improve courses.",
    tags: ["Create", "Publish", "AI"],
  },
  {
    id: "student",
    eyebrow: "Learner workspace",
    title: "Learn by doing",
    route: "/student/dashboard",
    accent: "practice",
    image: "/showcase/student-dashboard.jpg",
    darkImage: "/showcase/student-dashboard-dark.png",
    summary: "Courses, practice, and progress.",
    tags: ["Courses", "Practice", "Progress"],
  },
  {
    id: "admin",
    eyebrow: "Owner control",
    title: "View every mode",
    route: "/admin/dashboard",
    accent: "admin",
    image: "/showcase/admin-dashboard.jpg",
    darkImage: "/showcase/admin-dashboard-dark.png",
    summary: "Individual, organization, creator, and learner views.",
    tags: ["Owner", "Portals", "Modes"],
  },
];

const workflowSlides: WorkflowSlide[] = [
  {
    id: "catalog",
    icon: Search,
    title: "Choose space",
    tabLabel: "Entrance",
    detail: "Individual or organization.",
    route: "/auth/signup",
    image: "/showcase/signup-access.png",
    darkImage: "/showcase/signup-access-dark.png",
    panelTitle: "Workspace setup",
    pills: ["Individual", "Organization", "Owner"],
  },
  {
    id: "access",
    icon: UserRound,
    title: "Enter once",
    tabLabel: "Access",
    detail: "Personal or portal access.",
    route: "/auth/login",
    image: "/showcase/login-organization.jpg",
    darkImage: "/showcase/login-organization-dark.png",
    panelTitle: "Workspace access",
    pills: ["Personal", "Portal", "Return"],
  },
  {
    id: "canvas",
    icon: Layers3,
    title: "Create courses",
    tabLabel: "Create",
    detail: "AI, pages, practice.",
    route: "/studio",
    image: "/showcase/teacher-create.jpg",
    darkImage: "/showcase/teacher-create-dark.png",
    panelTitle: "Course Studio",
    pills: ["AI", "Pages", "Practice"],
  },
  {
    id: "assign",
    icon: CheckCircle2,
    title: "Publish",
    tabLabel: "Publish",
    detail: "Share, sell, or grant access.",
    route: "/teacher/work",
    image: "/showcase/teacher-work.jpg",
    darkImage: "/showcase/teacher-work-dark.png",
    panelTitle: "Course Work",
    pills: ["Share", "Review", "Improve"],
  },
  {
    id: "practice",
    icon: BookOpenCheck,
    title: "Practice",
    tabLabel: "Practice",
    detail: "Focused drills and AI help.",
    route: "/student/dashboard",
    image: "/showcase/student-dashboard.jpg",
    darkImage: "/showcase/student-dashboard-dark.png",
    panelTitle: "Learner dashboard",
    pills: ["Courses", "Practice", "Progress"],
  },
  {
    id: "proof",
    icon: BarChart3,
    title: "Show progress",
    tabLabel: "Proof",
    detail: "Progress, feedback, evidence.",
    route: "/admin/dashboard",
    image: "/showcase/admin-dashboard.jpg",
    darkImage: "/showcase/admin-dashboard-dark.png",
    panelTitle: "Progress dashboard",
    pills: ["Progress", "Feedback", "Evidence"],
  },
];

export default function EmilIntroShowcase({ labels }: EmilIntroShowcaseProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [workflowIndex, setWorkflowIndex] = useState(0);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const workflowRef = useRef<HTMLElement | null>(null);
  const catalogRef = useRef<HTMLElement | null>(null);
  const workflowIndexRef = useRef(0);
  const wheelCooldownRef = useRef(0);
  const sectionTransitionTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const catalogSnapCooldownRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const [sectionTransition, setSectionTransition] = useState<SectionTransition>("idle");
  const [catalogStageVisible, setCatalogStageVisible] = useState(false);
  const preview = previewSlides[previewIndex];
  const workflow = workflowSlides[workflowIndex];
  const WorkflowIcon = workflow.icon;
  const workflowLabel = labels.workflow ?? "Workflow";
  const individualLabel = labels.individual ?? "Individual";
  const organizationLabel = labels.organization ?? "Organization";
  const creatorLabel = "Creator";
  const learnerLabel = "Learner";
  const brandSubhead = labels.brandSubhead ?? "Teaching and learning workspace";
  const roleCards = useMemo(
    () => [
      {
        id: "individual",
        label: individualLabel,
        detail: "Create + learn.",
        icon: UserRound,
        href: "/auth/signup?mode=individual",
      },
      {
        id: "organization",
        label: organizationLabel,
        detail: `Owner, ${creatorLabel}, ${learnerLabel}.`,
        icon: Building2,
        href: "/auth/signup?mode=organization",
      },
    ],
    [individualLabel, organizationLabel],
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
    const updateCatalogStageVisible = () => {
      const catalog = catalogRef.current;
      if (!catalog) return;
      const rect = catalog.getBoundingClientRect();
      const now = Date.now();
      const scrollY = window.scrollY;
      const scrollingDown = scrollY >= lastScrollYRef.current;
      const nextVisible = rect.top < window.innerHeight * 0.82;
      const shouldSnapToCatalog =
        nextVisible &&
        scrollingDown &&
        rect.top > 24 &&
        rect.top < window.innerHeight * 0.62 &&
        now > catalogSnapCooldownRef.current;

      if (shouldSnapToCatalog) {
        catalogSnapCooldownRef.current = now + 1100;
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        window.requestAnimationFrame(() => {
          catalog.scrollIntoView({ behavior, block: "start" });
        });
      }

      lastScrollYRef.current = scrollY;
      setCatalogStageVisible(nextVisible);
    };

    lastScrollYRef.current = window.scrollY;
    updateCatalogStageVisible();
    window.addEventListener("scroll", updateCatalogStageVisible, { passive: true });
    window.addEventListener("resize", updateCatalogStageVisible);
    return () => {
      window.removeEventListener("scroll", updateCatalogStageVisible);
      window.removeEventListener("resize", updateCatalogStageVisible);
    };
  }, []);

  useEffect(() => {
    if (!catalogStageVisible) return;
    const catalog = catalogRef.current;
    if (!catalog) return;

    const timer = window.setTimeout(() => {
      const rect = catalog.getBoundingClientRect();
      if (rect.top <= 24 || rect.top >= window.innerHeight) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      window.scrollTo({ top: window.scrollY + rect.top, behavior });
    }, 90);

    return () => window.clearTimeout(timer);
  }, [catalogStageVisible]);

  useEffect(() => {
    const section = workflowRef.current;
    if (!section) return;

    const inViewport = () => {
      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.12 && rect.bottom >= window.innerHeight * 0.82;
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

    const sectionIsCentered = (section: HTMLElement, topWeight = 0.14, bottomWeight = 0.86) => {
      const rect = section.getBoundingClientRect();
      return rect.top < window.innerHeight * topWeight && rect.bottom > window.innerHeight * bottomWeight;
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 28 || Date.now() < wheelCooldownRef.current) return;
      const hero = heroRef.current;
      const workflow = workflowRef.current;
      const catalog = catalogRef.current;

      if (event.deltaY > 0 && hero && workflow && sectionIsCentered(hero, 0.18, 0.76)) {
        event.preventDefault();
        wheelCooldownRef.current = Date.now() + 720;
        moveToSection(workflow, "to-workflow");
        return;
      }

      if (event.deltaY < 0 && catalog && workflow && sectionIsCentered(catalog, 0.18, 0.82)) {
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
      "AI practice",
      "Progress",
    ],
    [labels.courses, labels.free, labels.paid],
  );
  const priceOptions = useMemo(
    () =>
      [
        { value: "all", label: `${labels.free} + ${labels.paid}` },
        { value: "free", label: labels.free },
        { value: "paid", label: labels.paid },
      ] satisfies { value: PriceFilter; label: string }[],
    [labels.free, labels.paid],
  );
  const selectedPriceLabel = priceOptions.find((option) => option.value === priceFilter)?.label ?? priceOptions[0].label;

  return (
    <main
      className="edsync-emil-intro"
      data-section-transition={sectionTransition}
      data-catalog-stage-visible={catalogStageVisible ? "true" : "false"}
    >
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
            <h1 id="emil-intro-title">Build. Learn. Grow.</h1>
            <p>One workspace for independent courses and organization portals.</p>
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
              <Link href={preview.route}>Open</Link>
            </div>
            <div className="edsync-emil-device-body edsync-emil-shot-body">
              <figure className={`edsync-emil-shot-frame is-${preview.accent}`}>
                <Image
                  className="edsync-emil-image-light"
                  src={preview.image}
                  alt={`${preview.title} page preview`}
                  fill
                  priority={previewIndex === 0}
                  sizes="(max-width: 760px) 100vw, 58vw"
                />
                <Image
                  className="edsync-emil-image-dark"
                  src={preview.darkImage}
                  alt={`${preview.title} page preview in dark mode`}
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
                </div>
              </header>
              <figure className={`edsync-emil-workflow-visual is-${workflow.id}`}>
                <Image
                  className="edsync-emil-image-light"
                  src={workflow.image}
                  alt={`${workflow.panelTitle} actual EdSync page`}
                  fill
                  priority={workflowIndex === 0}
                  sizes="(max-width: 760px) 100vw, 58vw"
                />
                <Image
                  className="edsync-emil-image-dark"
                  src={workflow.darkImage}
                  alt={`${workflow.panelTitle} actual EdSync page in dark mode`}
                  fill
                  priority={workflowIndex === 0}
                  sizes="(max-width: 760px) 100vw, 58vw"
                />
                <figcaption>
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
        </div>
      </section>

      <section id="emil-catalog" ref={catalogRef} className="edsync-emil-catalog">
        <div className="edsync-emil-search">
          <div>
            <span>{labels.catalog}</span>
            <h2>Search courses</h2>
          </div>
          <form action="/catalog">
            <Search className="h-4 w-4" />
            <input name="q" placeholder="Search" />
            <input type="hidden" name="price" value={priceFilter} readOnly />
            <div className="edsync-emil-price-menu">
              <button
                type="button"
                aria-expanded={priceMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setPriceMenuOpen((open) => !open)}
              >
                <span>{selectedPriceLabel}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {priceMenuOpen && (
                <div role="listbox" aria-label={labels.filters}>
                  {priceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={priceFilter === option.value}
                      onClick={() => {
                        setPriceFilter(option.value);
                        setPriceMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
