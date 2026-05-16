import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  LogIn,
  PanelTop,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";

type PublicTopbarProps = {
  active?: "catalog" | "organization" | "course";
  organizationName?: string;
  organizationCode?: string;
  portalSlug?: string;
  organizationSlug?: string;
};

const menuGroups = [
  {
    label: "Explore",
    icon: LibraryBig,
    links: [
      { href: "/catalog", label: "Course catalog", description: "Search public and free learning." },
      { href: "/catalog#organizations", label: "Organizations", description: "Find your school or company portal." },
      { href: "/practice", label: "Practice modes", description: "Quiz, sprint, flashcards, and review." },
    ],
  },
  {
    label: "Create",
    icon: PanelTop,
    links: [
      { href: "/auth/signup?mode=individual", label: "Individual workspace", description: "Start as a teacher or learner." },
      { href: "/auth/signup?mode=organization", label: "Organization workspace", description: "Set up an academy portal." },
      { href: "/auth/login?next=/studio", label: "Studio authoring", description: "Open docs, slides, sheets, and AI." },
    ],
  },
  {
    label: "Manage",
    icon: LayoutDashboard,
    links: [
      { href: "/auth/login?next=/teacher/dashboard", label: "Teacher portal", description: "Lessons, gradebook, and classroom work." },
      { href: "/auth/login?next=/student/dashboard", label: "Student portal", description: "Assignments, grades, and practice." },
      { href: "/auth/login?next=/admin/dashboard", label: "Admin console", description: "Platform, AI, portals, and security." },
    ],
  },
];

export default function PublicTopbar({
  active = "catalog",
  organizationName,
  organizationCode,
  portalSlug,
  organizationSlug,
}: PublicTopbarProps) {
  const resolvedOrganizationCode = organizationCode || organizationSlug || portalSlug;
  const organizationHref = portalSlug ? `/org/${portalSlug}` : null;
  const orgLoginHref = resolvedOrganizationCode
    ? `/auth/login?org=${encodeURIComponent(resolvedOrganizationCode)}`
    : "/auth/login?mode=organization";
  const orgSignupHref = resolvedOrganizationCode
    ? `/auth/signup?org=${encodeURIComponent(resolvedOrganizationCode)}`
    : "/auth/signup?mode=organization";

  return (
    <header className="sticky top-0 z-30 border-b border-edsync-border bg-edsync-bg/94 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/catalog" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-edsync-blue text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-xl font-bold leading-none">EdSync</span>
              <span className="mt-1 block text-xs font-semibold text-edsync-subtle">
                {organizationName || "Catalog, portals, and learning workspaces"}
              </span>
            </span>
          </Link>

          {organizationName && (
            <span className="inline-flex items-center gap-2 rounded-full border border-edsync-border bg-edsync-card px-3 py-1.5 text-xs font-semibold text-edsync-subtle shadow-sm lg:hidden">
              <Building2 className="h-3.5 w-3.5 text-edsync-blue" />
              {organizationName}
            </span>
          )}
        </div>

        <nav aria-label="Public navigation" className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link
            href="/catalog"
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition hover:bg-edsync-card ${
              active === "catalog" ? "premium-active" : "border-transparent text-edsync-subtle"
            }`}
          >
            Catalog
          </Link>
          {organizationHref && (
            <Link
              href={organizationHref}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition hover:bg-edsync-card ${
                active === "organization" ? "premium-active" : "border-transparent text-edsync-subtle"
              }`}
            >
              Organization
            </Link>
          )}
          {menuGroups.map((group) => {
            const Icon = group.icon;
            return (
              <details key={group.label} className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-edsync-subtle transition hover:border-edsync-border hover:bg-edsync-card hover:text-edsync-text [&::-webkit-details-marker]:hidden">
                  <Icon className="h-4 w-4" />
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                </summary>
                <div className="premium-overlay animate-overlay-in absolute left-0 top-full mt-2 w-72 rounded-2xl p-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group/link flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-edsync-muted"
                    >
                      <span>
                        <span className="block font-semibold text-edsync-text">{link.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-edsync-subtle">
                          {link.description}
                        </span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-edsync-blue transition group-hover/link:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle compact />
          <LanguageMenu compact syncCatalogFilter />
          <Link href={orgLoginHref} className="btn-secondary justify-center px-4 py-2 text-sm">
            <Building2 className="h-4 w-4" />
            Enter organization
          </Link>
          <Link href="/auth/login" className="btn-ghost justify-center px-3 py-2 text-sm">
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
          <Link href={orgSignupHref} className="btn-primary justify-center px-4 py-2 text-sm">
            <UserPlus className="h-4 w-4" />
            Start
          </Link>
        </div>
      </div>

      <div className="hidden border-t border-edsync-border/70 bg-edsync-surface/65 md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs font-semibold text-edsync-subtle">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-edsync-card px-2.5 py-1 shadow-sm">
            <Building2 className="h-3.5 w-3.5 text-edsync-emerald" />
            Organization portals
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-edsync-card px-2.5 py-1 shadow-sm">
            <UsersRound className="h-3.5 w-3.5 text-edsync-amber" />
            Teacher and student workspaces
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-edsync-card px-2.5 py-1 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-edsync-blue" />
            Studio, practice, and progress
          </span>
        </div>
      </div>
    </header>
  );
}
