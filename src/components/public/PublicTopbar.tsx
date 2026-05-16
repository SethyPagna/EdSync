import Link from "next/link";
import { cookies } from "next/headers";
import { Building2, GraduationCap, UserPlus } from "lucide-react";
import LanguageMenu from "@/components/LanguageMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { normalizePublicLanguage, publicCopy } from "@/lib/public-i18n";

type PublicTopbarProps = {
  active?: "catalog" | "organization" | "course";
  organizationName?: string;
  organizationCode?: string;
  portalSlug?: string;
  organizationSlug?: string;
};

export default async function PublicTopbar({
  organizationName,
  organizationCode,
  portalSlug,
  organizationSlug,
}: PublicTopbarProps) {
  const cookieStore = await cookies();
  const language = normalizePublicLanguage(
    cookieStore.get("edsync-language")?.value || cookieStore.get("edsync-language-code")?.value,
  );
  const copy = publicCopy[language];
  const resolvedOrganizationCode = organizationCode || organizationSlug || portalSlug;
  const signupHref = resolvedOrganizationCode
    ? `/auth/signup?org=${encodeURIComponent(resolvedOrganizationCode)}`
    : "/auth/signup";

  return (
    <header className="sticky top-0 z-30 bg-edsync-bg/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/catalog" className="group flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
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
          <Link href={signupHref} className="btn-primary justify-center px-4 py-2 text-sm">
            <UserPlus className="h-4 w-4" />
            {copy.start}
          </Link>
        </div>
      </div>
    </header>
  );
}
