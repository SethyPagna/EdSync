"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Building2,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Play,
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
    eyebrow: "Lesson canvas",
    title: "Energy Transfer",
    route: "/teacher/lessons/create",
    accent: "studio",
    left: ["Templates", "Elements", "Text", "Media", "AI"],
    canvasTitle: "Conduction vs convection",
    canvasRows: ["Heat moves through touch", "Video cue checked", "Quick question ready"],
    sideTitle: "Assign to Grade 8",
    sideRows: ["Due Fri 4:00 PM", "35 min expected", "Practice sprint attached"],
  },
  {
    id: "student",
    eyebrow: "Student loop",
    title: "Practice & AI",
    route: "/practice",
    accent: "practice",
    left: ["Lessons", "My Work", "Planner", "Notes", "Grades"],
    canvasTitle: "Retry missed questions",
    canvasRows: ["2 mistakes saved", "Explanation generated", "Review card scheduled"],
    sideTitle: "Active time",
    sideRows: ["18 min focused", "Notifications on", "Next deadline synced"],
  },
  {
    id: "catalog",
    eyebrow: "Public catalog",
    title: "Find a course",
    route: "/catalog",
    accent: "catalog",
    left: ["Individual", "Organization", "Teacher", "Student"],
    canvasTitle: "Course marketplace",
    canvasRows: ["Free and paid filters", "Organization portals", "Account before enroll"],
    sideTitle: "Access",
    sideRows: ["Preview lesson", "Enroll free", "Checkout paid"],
  },
  {
    id: "admin",
    eyebrow: "Platform control",
    title: "Admin command",
    route: "/admin/dashboard",
    accent: "admin",
    left: ["Users", "Portals", "AI", "Security", "Settings"],
    canvasTitle: "AI provider routing",
    canvasRows: ["Groq healthy", "Google fallback", "Encrypted keys"],
    sideTitle: "Audit",
    sideRows: ["View-as logged", "Feature flags", "Tenant scoped"],
  },
];

const workflowSlides = [
  {
    id: "catalog",
    icon: Search,
    title: "Start from the right door",
    detail: "Individuals browse courses. Organizations enter portals. Teachers create. Students learn.",
    pills: ["Marketplace", "Org portal", "Role routing"],
  },
  {
    id: "canvas",
    icon: Layers3,
    title: "Build on a canvas",
    detail: "Lessons use pages, blocks, media, quizzes, discussions, and practice cards.",
    pills: ["Templates", "Blocks", "Media checks"],
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "Let AI draft, then edit",
    detail: "AI creates structured drafts, but teachers keep review, style, and publishing control.",
    pills: ["AI draft", "Full AI", "Blank lesson"],
  },
  {
    id: "practice",
    icon: Brain,
    title: "Turn content into practice",
    detail: "Quiz, sprint, retry missed, flashcards, and explanations live in one Practice & AI space.",
    pills: ["Kahoot-style", "Timer", "Review cards"],
  },
  {
    id: "proof",
    icon: BarChart3,
    title: "Prove progress",
    detail: "Submissions, feedback, weighted scoring, completion, and participation evidence stay connected.",
    pills: ["Gradebook", "Feedback", "Reports"],
  },
];

const roles = [
  {
    id: "individual",
    label: "Individual",
    detail: "Buy courses, take notes, practice alone.",
    icon: UserRound,
    href: "/auth/signup?mode=individual",
  },
  {
    id: "organization",
    label: "Organization",
    detail: "Portals, managers, SSO-ready access.",
    icon: Building2,
    href: "/auth/signup?mode=organization",
  },
  {
    id: "teacher",
    label: "Teacher",
    detail: "Create lessons, assign work, give feedback.",
    icon: BookOpenCheck,
    href: "/auth/signup?role=teacher",
  },
  {
    id: "student",
    label: "Student",
    detail: "Learn, submit, practice, see grades.",
    icon: GraduationCap,
    href: "/auth/signup?role=student",
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
  const preview = previewSlides[previewIndex];
  const workflow = workflowSlides[workflowIndex];
  const WorkflowIcon = workflow.icon;

  const searchTags = useMemo(
    () => [
      `${labels.free} ${labels.courses}`,
      `${labels.paid} ${labels.courses}`,
      "Organization portal",
      "Practice sprint",
      "Teacher gradebook",
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
            <small>Teaching and learning workspace</small>
          </Link>
          <div className="edsync-emil-actions">
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
              Public courses, portals, lessons, practice, proof.
            </span>
            <h1 id="emil-intro-title">Teach. Practice. Prove progress.</h1>
            <p>
              One clean path for individuals, organizations, teachers, and students.
            </p>
            <div className="edsync-emil-cta-row">
              <a href="#emil-workflow" className="edsync-emil-primary">
                View workflow
                <Play className="h-4 w-4" />
              </a>
              <Link href="/auth/signup" className="edsync-emil-secondary">
                {labels.start}
              </Link>
              <a href="#emil-catalog" className="edsync-emil-jump">
                {labels.catalog}
              </a>
            </div>
            <div className="edsync-emil-roles" aria-label="EdSync role paths">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <Link key={role.id} href={role.href} title={role.detail}>
                    <Icon className="h-4 w-4" />
                    <span>{role.label}</span>
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

      <section id="emil-workflow" className="edsync-emil-workflow" aria-labelledby="emil-workflow-title">
        <div className="edsync-emil-workflow-card">
          <div className="edsync-emil-workflow-copy">
            <span>0{workflowIndex + 1} / 05</span>
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
              <WorkflowIcon className="h-7 w-7" />
              <strong>{workflow.title}</strong>
              <span>{workflow.detail}</span>
              <div>
                {workflow.pills.map((pill) => (
                  <p key={pill}>{pill}</p>
                ))}
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
