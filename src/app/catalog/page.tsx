import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import CatalogCourseCard from "@/components/catalog/CatalogCourseCard";
import WorkflowShowcase from "@/components/catalog/WorkflowShowcase";
import PublicTopbar from "@/components/public/PublicTopbar";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters } from "@/lib/catalog-filters";
import { normalizePublicLanguage, publicCopy } from "@/lib/public-i18n";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Search public EdSync courses, organization academies, free programs, and paid learning products.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    portal?: string;
    tenant?: string;
    price?: string;
    category?: string;
    difficulty?: string;
    language?: string;
    duration?: string;
  };
}) {
  const cookieStore = await cookies();
  const language = normalizePublicLanguage(
    cookieStore.get("edsync-language")?.value || cookieStore.get("edsync-language-code")?.value,
  );
  const copy = publicCopy[language];
  const filters = normalizeCatalogFilters(searchParams);
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

  return (
    <main className="premium-shell min-h-screen text-edsync-text">
      <PublicTopbar active="catalog" />

      <section className="mx-auto max-w-7xl px-4">
        <section className="edsync-launch-hero min-h-[calc(100vh-4.5rem)] overflow-hidden py-6 lg:py-10">
          <div className="grid h-full min-h-[calc(100vh-7rem)] min-w-0 items-center gap-8 overflow-hidden lg:grid-cols-[minmax(0,0.86fr)_minmax(430px,1fr)]">
            <div className="animate-reveal-soft max-w-2xl min-w-0">
              <h1 className="font-display text-5xl font-bold leading-[0.92] tracking-tight sm:text-7xl lg:text-8xl">
                Build. Practice. Improve.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-edsync-subtle">
                A clean learning loop for courses, AI drafts, student practice, feedback, and progress.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#workflow-transition" className="btn-primary justify-center">
                  Watch workflow
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/auth/signup" className="btn-secondary justify-center">
                  Start
                </Link>
              </div>
            </div>

            <div className="edsync-launch-deck animate-reveal-soft min-w-0" aria-label="EdSync launch path preview">
              <article className="edsync-launch-slide edsync-launch-slide-static">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-edsync-bg text-edsync-blue">
                    <BookOpenCheck className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-edsync-subtle">Launch</span>
                </div>
                <div className="mt-8">
                  <h2 className="font-display text-4xl font-bold">One loop, shown step by step.</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-edsync-subtle">
                    Scroll into the animated tour to see how each workspace connects.
                  </p>
                </div>
                <div className="mt-7 grid gap-3">
                  {["Create a lesson package", "Generate practice and feedback", "Track evidence and next steps"].map((row, index) => (
                    <div key={row} className="flex items-center gap-3 rounded-2xl bg-edsync-bg/80 p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-edsync-blue/10 text-xs font-bold text-edsync-blue">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-edsync-text">{row}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <WorkflowShowcase />

        <section id="catalog-search-panel" className="grid min-h-screen scroll-mt-24 content-center py-12">
          <div className="premium-panel animate-reveal-soft overflow-visible rounded-[1.65rem] p-4 sm:p-6">
            <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-4xl font-bold">{copy.searchHeading}</h2>
                <p className="mt-2 text-sm text-edsync-subtle">{copy.searchCopy}</p>
              </div>
              {hasFilters && (
                <Link href="/catalog" className="text-sm font-semibold text-edsync-blue hover:underline">
                  {copy.clearFilters}
                </Link>
              )}
            </div>
            <form>
              <label className="sr-only" htmlFor="catalog-search">
                Search catalog
              </label>
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
                        name="language"
                        defaultValue={filters.language}
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
            <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-edsync-subtle">
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {items.length} {copy.courses.toLowerCase()}
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {freeCount} {copy.free.toLowerCase()}
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {paidCount} {copy.paid.toLowerCase()}
              </span>
            </div>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mt-5">
            <h2 className="sr-only">{copy.categories}</h2>
            <div className="premium-surface rounded-2xl p-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={`/catalog?category=${encodeURIComponent(category)}`}
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
                <CatalogCourseCard key={item.id} item={item} featured />
              ))}
            </div>
          </section>
        )}

        <section id="catalog-results" className="mt-8 scroll-mt-32">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">{copy.courses}</h2>
              <p className="text-sm text-edsync-subtle">{copy.coursesSubhead}</p>
            </div>
            {hasFilters && (
              <Link href="/catalog" className="text-sm font-semibold text-edsync-blue hover:underline">
                  {copy.clearFilters}
              </Link>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <CatalogCourseCard key={item.id} item={item} />
            ))}
          </div>
          {items.length === 0 && (
            <div className="premium-surface rounded-2xl border-dashed p-10 text-center">
              <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">{copy.emptyTitle}</p>
              <p className="mt-2 text-sm text-edsync-subtle">{copy.emptyCopy}</p>
              <Link href="/auth/signup" className="btn-primary mx-auto mt-5 w-fit">
                {copy.createWorkspace}
              </Link>
            </div>
          )}
        </section>

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
                  href={`/org/${portal.slug}`}
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
