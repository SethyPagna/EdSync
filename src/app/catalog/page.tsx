import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  GraduationCap,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import CatalogLaunchHero from "@/components/catalog/CatalogLaunchHero";
import CatalogCourseCard from "@/components/catalog/CatalogCourseCard";
import WorkflowShowcase from "@/components/catalog/WorkflowShowcase";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters, type CatalogSearchParams } from "@/lib/catalog-filters";
import { getPublicCopy } from "@/lib/public/i18n";
import { publicLanguageHref, publicLanguageQuerySuffix, publicLanguageQueryValue } from "@/lib/public/languages";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Search public EdSync courses, organization academies, free programs, and paid learning products.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: CatalogSearchParams;
}) {
  const filters = normalizeCatalogFilters(searchParams);
  const copy = getPublicCopy(filters.language);
  const hasFilters = hasCatalogFilters(filters);
  const [items, portals] = await Promise.all([
    listPublicCatalog({
      ...filters,
    }),
    listPublicPortals(),
  ]);
  const featured = items.filter((item) => item.metadata.featured).slice(0, 3);
  const freeCount = items.filter((item) => item.price.isFree).length;
  const paidCount = items.length - freeCount;
  const categories = Array.from(
    new Set(items.map((item) => item.metadata.category).filter(Boolean) as string[]),
  ).slice(0, 6);
  const [, , aiLabel = "AI", practiceLabel = "Practice", proofLabel = "Grades"] = copy.heroTags;
  const cardLabels = {
    featured: copy.featured,
    free: copy.free,
    preview: `${copy.courses}. ${copy.start}.`,
    flexible: copy.anyDuration,
    view: copy.courses,
    minutes: "min",
  };
  const quickSearches = [
    `${aiLabel} ${copy.courses}`,
    `${practiceLabel} ${copy.workflowLabel}`,
    `${copy.academies} ${copy.catalogLabel}`,
    `${proofLabel} ${copy.courses}`,
  ];
  const audiencePaths = [
    {
      label: "Individual",
      detail: "Buy courses, take notes, practice at your own pace.",
      icon: UserRound,
    },
    {
      label: "Organization",
      detail: "Use portals, teams, managers, and SSO-ready access.",
      icon: Building2,
    },
    {
      label: "Teacher",
      detail: "Create lessons, assign work, and give feedback.",
      icon: BookOpenCheck,
    },
    {
      label: "Student",
      detail: "Open lessons, practice, submit work, and see grades.",
      icon: GraduationCap,
    },
  ];
  const catalogHref = (params: Record<string, string> = {}) => {
    const query = new URLSearchParams();
    const publicLanguage = publicLanguageQueryValue(filters.language);
    if (publicLanguage) query.set("language", publicLanguage);
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    const queryString = query.toString();
    return `/catalog${queryString ? `?${queryString}` : ""}`;
  };
  const orgHref = (slug: string) => {
    return `/org/${slug}${publicLanguageQuerySuffix(filters.language)}`;
  };

  return (
    <main id="top" className="edsync-catalog-reference edsync-public-launch min-h-screen text-edsync-text">
      <CatalogLaunchHero
        title={copy.heroTitle}
        description={copy.heroCopy}
        primaryLabel={copy.begin}
        secondaryLabel={copy.start}
        language={filters.language}
      />

      <section className="mx-auto max-w-[90rem] px-4">
        <div id="workflow-start" className="edsync-workflow-anchor" aria-hidden="true" />
        <WorkflowShowcase language={filters.language} />

        <section id="catalog-search-panel" className="edsync-catalog-availability py-6">
          <div className="premium-panel animate-reveal-soft overflow-visible rounded-[1.65rem] p-4 sm:p-6">
            <div className="edsync-catalog-search-head">
              <div className="min-w-0">
                <span className="edsync-catalog-search-kicker">{copy.catalogLabel}</span>
                <h2 className="font-display text-3xl font-bold sm:text-4xl">
                  {copy.searchHeading === "Search" ? "Find your learning path" : copy.searchHeading}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-edsync-subtle">
                  {copy.searchCopy === "Use filters after you search."
                    ? "Search public courses, organization academies, free programs, and paid learning products in one place."
                    : copy.searchCopy}
                </p>
              </div>
              <div className="edsync-catalog-availability-strip" aria-label="Catalog availability">
                <span>
                  <strong>{items.length}</strong>
                  <small>{copy.courses}</small>
                </span>
                <span>
                  <strong>{freeCount}</strong>
                  <small>{copy.free}</small>
                </span>
                <span>
                  <strong>{paidCount}</strong>
                  <small>{copy.paid}</small>
                </span>
              </div>
            </div>
            <form>
              <label className="sr-only" htmlFor="catalog-search">
                Search catalog
              </label>
              {publicLanguageQueryValue(filters.language) && (
                <input type="hidden" name="language" value={publicLanguageQueryValue(filters.language) ?? ""} />
              )}
              {filters.portalSlug && <input type="hidden" name="portal" value={filters.portalSlug} />}
              {filters.tenantSlug && <input type="hidden" name="tenant" value={filters.tenantSlug} />}
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_9rem_9rem_auto_auto] [&>*]:min-w-0">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-edsync-subtle" />
                  <input
                    id="catalog-search"
                    name="q"
                    defaultValue={filters.query}
                    className="edsync-input pl-9"
                    placeholder={copy.searchPlaceholder}
                  />
                </div>
                <select name="price" defaultValue={filters.price} className="edsync-input min-w-0">
                  <option value="all">{copy.allPrices}</option>
                  <option value="free">{copy.free}</option>
                  <option value="paid">{copy.paid}</option>
                </select>
                <select name="duration" defaultValue={filters.maxDuration ?? ""} className="edsync-input min-w-0">
                  <option value="">{copy.anyDuration}</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="120">2 hours</option>
                </select>
                <details className="group relative">
                  <summary className="btn-secondary h-full min-h-11 cursor-pointer justify-center px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                    <SlidersHorizontal className="h-4 w-4" />
                    {copy.filters}
                  </summary>
                  <div className="premium-overlay animate-overlay-in absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3">
                    <div className="grid gap-2">
                      <input
                        name="difficulty"
                        defaultValue={filters.difficulty}
                        className="edsync-input min-w-0"
                        placeholder={copy.difficulty}
                      />
                      <input
                        name="courseLanguage"
                        defaultValue={filters.courseLanguage}
                        className="edsync-input min-w-0"
                        placeholder={copy.language}
                      />
                    </div>
                  </div>
                </details>
                <button className="btn-primary justify-center" type="submit">
                  <Search className="h-4 w-4" />
                  {copy.searchButton}
                </button>
              </div>
            </form>
            <div className="edsync-catalog-path-row">
              {audiencePaths.map((path, index) => {
                const Icon = path.icon;
                return (
                  <div key={`audience-${index}-${path.label}`} className="edsync-catalog-audience-card">
                    <Icon className="h-4 w-4" />
                    <span>
                      <strong>{path.label}</strong>
                      <small>{path.detail}</small>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="edsync-catalog-quick-row">
              {quickSearches.map((sample, index) => (
                <Link key={`quick-search-${index}-${sample}`} href={catalogHref({ q: sample })}>
                  {sample}
                </Link>
              ))}
              {hasFilters && (
                <Link href={catalogHref()} className="is-clear">
                  {copy.clearFilters}
                </Link>
              )}
            </div>

            <div id="catalog-results" className="mt-6 border-t border-edsync-border pt-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">{copy.courses}</h2>
                  <p className="text-sm text-edsync-subtle">{copy.coursesSubhead}</p>
                </div>
                {hasFilters && (
                  <Link href={catalogHref()} className="text-sm font-semibold text-edsync-blue hover:underline">
                    {copy.clearFilters}
                  </Link>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <CatalogCourseCard key={item.id} item={item} labels={cardLabels} language={filters.language} />
                ))}
              </div>
              {items.length === 0 && (
                <div className="premium-surface rounded-2xl border-dashed p-8 text-center sm:p-10">
                  <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
                  <p className="font-semibold text-edsync-text">{copy.emptyTitle}</p>
                  <p className="mt-2 text-sm text-edsync-subtle">{copy.emptyCopy}</p>
                  <Link href={publicLanguageHref("/auth/signup", filters.language)} className="btn-primary mx-auto mt-5 w-fit">
                    {copy.createWorkspace}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mt-5">
            <h2 className="sr-only">{copy.categories}</h2>
            <div className="premium-surface rounded-2xl p-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category, index) => (
                  <Link
                    key={`category-${index}-${category}`}
                    href={catalogHref({ category })}
                    className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5 text-sm font-semibold text-edsync-subtle shadow-sm transition hover:-translate-y-0.5 hover:border-edsync-blue/40 hover:text-edsync-blue"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {featured.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">{copy.featured}</h2>
              <span className="text-sm text-edsync-subtle">{copy.featuredSubhead}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {featured.map((item) => (
                <CatalogCourseCard key={item.id} item={item} featured labels={cardLabels} language={filters.language} />
              ))}
            </div>
          </section>
        )}

        {portals.length > 0 && (
          <section id="organizations" className="mt-10 pb-12">
            <div className="mb-3">
              <h2 className="font-display text-2xl font-bold">{copy.academies}</h2>
              <p className="text-sm text-edsync-subtle">{copy.academiesSubhead}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {portals.slice(0, 9).map((portal) => (
                <Link
                  key={portal.id}
                  href={orgHref(portal.slug)}
                  className="premium-card group rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-edsync-text">{portal.name}</p>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-edsync-blue transition group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-1 truncate text-sm text-edsync-subtle">{portal.tenant_name}</p>
                      <span className="mt-3 inline-flex rounded-full border border-edsync-border px-2 py-0.5 text-xs font-semibold capitalize text-edsync-subtle">
                        {portal.audience}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
