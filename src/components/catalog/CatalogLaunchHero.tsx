import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, GraduationCap } from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import CatalogLaunchPreviewGallery, {
  type LaunchPreviewSlideCopy,
} from "@/components/catalog/CatalogLaunchPreviewGallery";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { getPublicCopy } from "@/lib/public/i18n";
import { normalizePublicLanguage, publicLanguageHref } from "@/lib/public/languages";

type CatalogLaunchHeroProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  statusLabel?: string;
  language?: string;
};

function buildLaunchPreviewSlides({
  catalog,
  studio,
  ai,
  practice,
  proof,
  signIn,
  start,
  free,
  paid,
  anyDuration,
  difficulty,
  courses,
  search,
  filters,
}: {
  catalog: string;
  studio: string;
  ai: string;
  practice: string;
  proof: string;
  signIn: string;
  start: string;
  free: string;
  paid: string;
  anyDuration: string;
  difficulty: string;
  courses: string;
  search: string;
  filters: string;
}): Record<"catalog" | "studio" | "ai" | "practice" | "proof", LaunchPreviewSlideCopy> {
  return {
    catalog: {
      label: catalog,
      eyebrow: catalog,
      title: courses,
      route: "/catalog",
      nav: [catalog, courses, free, paid],
      metrics: [[free, start], ["35m", anyDuration], [difficulty, filters]],
      blocks: [[courses, `${search} courses, preview media, then enroll.`], [signIn, `${signIn} before free access or checkout.`]],
    },
    studio: {
      label: studio,
      eyebrow: studio,
      title: studio,
      route: "/teacher/lessons/create",
      nav: [studio, "Templates", "Media", ai],
      metrics: [["Slides", studio], ["Quiz", practice], ["Draft", courses]],
      blocks: [[studio, "Canva-style lesson canvas with templates."], [courses, "Slides, media, questions, and due dates stay together."]],
    },
    ai: {
      label: ai,
      eyebrow: ai,
      title: ai,
      route: "/ai",
      nav: [ai, "Outline", "Slides", practice],
      metrics: [["Groq", ai], ["Google", ai], ["Review", studio]],
      blocks: [[ai, "Generate a draft, then edit before publish."], [studio, "Insert lessons, quizzes, rubrics, and notes."]],
    },
    practice: {
      label: practice,
      eyebrow: practice,
      title: practice,
      route: "/practice",
      nav: [practice, "Sprint", "Retry", proof],
      metrics: [["08:42", anyDuration], ["4/12", practice], ["2", proof]],
      blocks: [[practice, "Quiz, flashcards, sprint, and retry missed."], [proof, "Mistakes become review cards and feedback."]],
    },
    proof: {
      label: proof,
      eyebrow: proof,
      title: proof,
      route: "/admin/dashboard",
      nav: [proof, "Feedback", "Reports", "Admin"],
      metrics: [["24", proof], [ai, proof], [start, practice]],
      blocks: [[proof, "Grade events, feedback, and progress evidence."], [ai, "Provider health, audit logs, and safe media checks."]],
    },
  };
}

export default async function CatalogLaunchHero({
  title = "Teach. Practice. Prove.",
  description = "Turn lessons into practice and proof.",
  primaryLabel = "See it",
  secondaryLabel = "Start",
  language,
}: CatalogLaunchHeroProps) {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const signedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const publicLanguage = normalizePublicLanguage(language ?? cookieStore.get("edsync-language")?.value);
  const copy = getPublicCopy(publicLanguage);
  const loginHref = publicLanguageHref("/auth/login", publicLanguage);
  const signupHref = publicLanguageHref("/auth/signup", publicLanguage);
  const [, studioLabel = "Lessons", aiLabel = "AI", practiceLabel = "Practice", proofLabel = "Grades"] = copy.heroTags;
  const previewSlides = buildLaunchPreviewSlides({
    catalog: copy.catalogLabel,
    studio: studioLabel,
    ai: aiLabel,
    practice: practiceLabel,
    proof: proofLabel,
    signIn: copy.signIn,
    start: copy.start,
    free: copy.free,
    paid: copy.paid,
    anyDuration: copy.anyDuration,
    difficulty: copy.difficulty,
    courses: copy.courses,
    search: copy.searchButton,
    filters: copy.filters,
  });
  const workspaceHref =
    role === "admin"
      ? "/admin/dashboard"
      : role === "teacher"
        ? "/teacher/dashboard"
        : role === "student"
          ? "/student/dashboard"
          : "/auth/login";

  return (
    <section className="edsync-launch-hero-v2" aria-labelledby="edsync-public-title">
      <div className="edsync-launch-topline" role="navigation" aria-label="EdSync public navigation">
        <Link href="/" prefetch={false} className="edsync-launch-brand-inline" aria-label="EdSync home">
          <span className="edsync-launch-brand-mark">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span>
            <strong>EdSync</strong>
            <small>{copy.brandSubhead}</small>
          </span>
        </Link>
        <div className="edsync-launch-actions-inline">
          <a href="#workflow-start" className="edsync-launch-mini-link">
            {copy.workflowLabel}
          </a>
          <a href="#catalog-search-panel" className="edsync-launch-mini-link">
            {copy.catalogLabel}
          </a>
          <ThemeToggle compact className="edsync-launch-icon" />
          <LanguageMenu compact syncCatalogFilter className="edsync-launch-icon" />
          <Link href={signedIn ? workspaceHref : loginHref} prefetch={false} className="edsync-launch-signin">
            <span>{signedIn ? copy.start : copy.signIn}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="edsync-launch-hero-inner">
        <div className="edsync-launch-copy" data-public-language={publicLanguage}>
          <h1 id="edsync-public-title">{title}</h1>
          <p>{description}</p>
          <div className="edsync-launch-cta-row">
            <Link href="#workflow-start" prefetch={false} className="edsync-launch-primary">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={signupHref} prefetch={false} className="edsync-launch-secondary">
              {secondaryLabel}
            </Link>
            <Link href="#catalog-search-panel" prefetch={false} className="edsync-launch-tertiary">
              {copy.catalogLabel}
            </Link>
          </div>
          <div className="edsync-launch-mode-row" aria-label="EdSync public paths">
            {[
              ["Individual", "Buy, learn, take notes"],
              ["Organization", "Portals, SSO, teams"],
              ["Teacher", "Create, assign, feedback"],
              ["Student", "Lessons, practice, grades"],
            ].map(([label, detail]) => (
              <span key={label} title={detail}>{label}</span>
            ))}
          </div>
        </div>

        <div className="edsync-launch-preview-wrap" aria-label="EdSync workspace preview">
          <CatalogLaunchPreviewGallery
            readyLabel={copy.start}
            slides={previewSlides}
          />
        </div>
      </div>
    </section>
  );
}
