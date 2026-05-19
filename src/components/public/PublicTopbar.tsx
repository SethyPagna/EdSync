import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Building2, GraduationCap } from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { getPublicCopy } from "@/lib/public/i18n";
import { normalizePublicLanguage, publicLanguageHref } from "@/lib/public/languages";

type PublicTopbarProps = {
  active?: "catalog" | "organization" | "course";
  organizationName?: string;
  organizationCode?: string;
  portalSlug?: string;
  organizationSlug?: string;
  language?: string | null;
};

export default async function PublicTopbar({
  organizationName,
  organizationCode,
  portalSlug,
  organizationSlug,
  language,
}: PublicTopbarProps) {
  const cookieStore = await cookies();
  const publicLanguage = normalizePublicLanguage(language ?? cookieStore.get("edsync-language")?.value);
  const copy = getPublicCopy(publicLanguage);
  const resolvedOrganizationCode = organizationCode || organizationSlug || portalSlug;
  const role = cookieStore.get(ROLE_COOKIE)?.value;
  const signedIn = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const workspaceHref =
    role === "admin"
      ? "/admin/dashboard"
      : role === "teacher"
        ? "/teacher/dashboard"
        : role === "student"
          ? "/student/dashboard"
          : "/auth/login";
  const loginHref = publicLanguageHref("/auth/login", publicLanguage, { org: resolvedOrganizationCode });

  return (
    <header className="edsync-public-topbar relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-lg sm:h-11 sm:w-11">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold leading-none sm:text-xl">EdSync</span>
              <span className="mt-1 hidden truncate text-xs font-semibold text-edsync-subtle sm:block">
                {organizationName || copy.brandSubhead}
              </span>
            </span>
          </Link>

          {organizationName && (
            <span className="hidden items-center gap-2 rounded-full border border-edsync-border bg-edsync-card px-3 py-1.5 text-xs font-semibold text-edsync-subtle shadow-sm md:inline-flex">
              <Building2 className="h-3.5 w-3.5 text-edsync-blue" />
              {organizationName}
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle compact />
          <LanguageMenu compact syncCatalogFilter />
          <Link
            href={signedIn ? workspaceHref : loginHref}
            className="btn-primary min-h-10 justify-center px-2.5 py-2 text-sm sm:px-4"
            aria-label={signedIn ? copy.start : copy.signIn}
          >
            <span className="hidden min-[390px]:inline">{signedIn ? copy.start : copy.signIn}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
