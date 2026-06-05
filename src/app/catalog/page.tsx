import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2 } from "lucide-react";
import CatalogCourseCard from "@/components/catalog/CatalogCourseCard";
import EmilIntroShowcase from "@/components/catalog/EmilIntroShowcase";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters, type CatalogSearchParams } from "@/lib/catalog/filters";
import { getPublicAuthCopy } from "@/lib/public/auth-copy";
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
  searchParams?: Promise<CatalogSearchParams>;
}) {
  const filters = normalizeCatalogFilters(await searchParams);
  const copy = getPublicCopy(filters.language);
  const authCopy = getPublicAuthCopy(filters.language);
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
  const cardLabels = {
    featured: copy.featured,
    free: copy.free,
    preview: "Course preview.",
    flexible: copy.anyDuration,
    view: "View",
    minutes: "min",
  };
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
    <>
      <EmilIntroShowcase
        labels={{
          signIn: copy.signIn,
          start: copy.start,
          catalog: copy.catalogLabel,
          workflow: copy.workflowLabel,
          brandSubhead: copy.brandSubhead,
          search: copy.searchButton,
          courses: copy.courses,
          free: copy.free,
          paid: copy.paid,
          filters: copy.filters,
          individual: authCopy.individual,
          organization: authCopy.organization,
        }}
      />

      <main id="catalog-results" className="edsync-catalog-reference edsync-public-launch text-edsync-text">
        <section className="mx-auto max-w-[90rem] px-4 py-10">
          <div className="premium-panel animate-reveal-soft overflow-visible rounded-[1.65rem] p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-edsync-border pb-5 lg:flex-row lg:items-end lg:justify-between">
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
        </section>

        {categories.length > 0 && (
          <section className="mx-auto mt-5 max-w-[90rem] px-4">
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
          <section className="mx-auto mt-8 max-w-[90rem] px-4">
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
          <section id="organizations" className="mx-auto mt-10 max-w-[90rem] px-4 pb-12">
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
      </main>
    </>
  );
}
