import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import CatalogCourseCard from "@/components/catalog/CatalogCourseCard";
import PublicTopbar from "@/components/public/PublicTopbar";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters } from "@/lib/catalog-filters";

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
  const steps = [
    ["01", "Browse", "Search courses, portals, and learning paths."],
    ["02", "Sign in", "Use one account for individual or organization access."],
    ["03", "Learn", "Continue in a focused student, teacher, or admin workspace."],
  ];

  return (
    <main className="premium-shell min-h-screen text-edsync-text">
      <PublicTopbar active="catalog" />

      <section className="mx-auto max-w-7xl px-4">
        <section className="grid min-h-[calc(100vh-5rem)] items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
          <div className="animate-reveal-soft max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-edsync-border bg-edsync-surface/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-edsync-subtle shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-edsync-blue" />
              Public learning catalog
            </div>
            <h1 className="max-w-4xl font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Find the right learning space.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-edsync-subtle">
              Search public courses, sign in when you are ready, then continue in the workspace that matches your role.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#catalog-search-panel" className="btn-primary justify-center">
                Start searching
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/auth/login" className="btn-secondary justify-center">
                Sign in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-sm font-semibold text-edsync-subtle">
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {items.length} courses
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {freeCount} free
              </span>
              <span className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                {paidCount} paid
              </span>
            </div>
          </div>

          <div className="relative min-h-[28rem]">
            <div className="absolute inset-0 rounded-[2rem] border border-edsync-border bg-edsync-surface/55 shadow-[var(--shadow-soft)] backdrop-blur-xl" />
            <div className="absolute -right-4 top-6 h-28 w-28 rounded-full bg-edsync-blue/15 blur-3xl" />
            <div className="absolute -bottom-4 left-5 h-28 w-28 rounded-full bg-edsync-emerald/15 blur-3xl" />
            <div className="relative grid gap-4 p-4 sm:p-5">
              {steps.map(([number, title, copy], index) => (
                <div
                  key={title}
                  className="premium-card animate-reveal-soft rounded-2xl p-5"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-edsync-blue/10 font-display text-lg font-bold text-edsync-blue">
                      {number}
                    </span>
                    <div>
                      <p className="font-display text-2xl font-bold">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-edsync-subtle">{copy}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="premium-overlay animate-overlay-in rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-edsync-subtle">Next</p>
                    <p className="font-display text-2xl font-bold">Scroll to search</p>
                  </div>
                  <Link href="#catalog-search-panel" className="premium-icon-button" aria-label="Scroll to catalog search">
                    <ArrowRight className="h-4 w-4 rotate-90" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="catalog-search-panel" className="scroll-mt-28 py-6">
          <div className="premium-panel animate-reveal-soft overflow-visible rounded-[1.65rem] p-3">
            <div className="flex flex-col gap-2 px-2 pb-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold">Search courses</h2>
                <p className="text-sm text-edsync-subtle">Filter only when you need to narrow the list.</p>
              </div>
              {hasFilters && (
                <Link href="/catalog" className="text-sm font-semibold text-edsync-blue hover:underline">
                  Clear filters
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
                    placeholder="Search subject, skill, organization, or course"
                  />
                </div>
                <select name="price" defaultValue={filters.price} className="edsync-input min-w-0">
                  <option value="all">All prices</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
                <select name="duration" defaultValue={filters.maxDuration ?? ""} className="edsync-input min-w-0">
                  <option value="">Any duration</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="120">2 hours</option>
                </select>
                <details className="group relative">
                  <summary className="btn-secondary h-full min-h-11 cursor-pointer justify-center px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                  </summary>
                  <div className="premium-overlay animate-overlay-in absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3">
                    <div className="grid gap-2">
                      <input
                        name="difficulty"
                        defaultValue={filters.difficulty}
                        className="edsync-input min-w-0"
                        placeholder="Difficulty"
                      />
                      <input
                        name="language"
                        defaultValue={filters.language}
                        className="edsync-input min-w-0"
                        placeholder="Language"
                      />
                    </div>
                  </div>
                </details>
                <button className="btn-primary justify-center" type="submit">
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </form>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mt-5">
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
              <h2 className="font-display text-2xl font-bold">Featured learning</h2>
              <span className="text-sm text-edsync-subtle">Curated by organizations</span>
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
              <h2 className="font-display text-2xl font-bold">Courses</h2>
              <p className="text-sm text-edsync-subtle">Public learning you can start from here.</p>
            </div>
            {hasFilters && (
              <Link href="/catalog" className="text-sm font-semibold text-edsync-blue hover:underline">
                Clear filters
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
              <p className="font-semibold text-edsync-text">No public courses found</p>
              <p className="mt-2 text-sm text-edsync-subtle">Try another search or start your own workspace.</p>
              <Link href="/auth/signup" className="btn-primary mx-auto mt-5 w-fit">
                Create workspace
              </Link>
            </div>
          )}
        </section>

        {portals.length > 0 && (
          <section id="organizations" className="mt-10 pb-12">
            <div className="mb-3">
              <h2 className="font-display text-2xl font-bold">Academies</h2>
              <p className="text-sm text-edsync-subtle">Published portals from schools, teams, and partners.</p>
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
