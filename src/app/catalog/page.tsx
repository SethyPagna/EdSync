import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  GraduationCap,
  Search,
  Sparkles,
} from "lucide-react";
import CatalogCourseCard from "@/components/catalog/CatalogCourseCard";
import PublicTopbar from "@/components/public/PublicTopbar";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import {
  hasCatalogFilters,
  normalizeCatalogFilters,
  type CatalogSearchParams,
} from "@/lib/catalog/filters";
import { getPublicCopy } from "@/lib/public/i18n";
import {
  publicLanguageHref,
  publicLanguageQueryValue,
} from "@/lib/public/languages";

export const metadata: Metadata = {
  title: "Explore courses",
  description:
    "Find your next course. Learn, practice, and make progress with EdSync.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: Promise<CatalogSearchParams>;
}) {
  const host = (await headers()).get("host")?.trim().toLowerCase().split(":")[0];
  const isDemoSite = process.env.EDSYNC_DEMO_MODE === "1" &&
    Boolean(host && host === process.env.EDSYNC_DEMO_HOSTNAME?.trim().toLowerCase());
  const filters = normalizeCatalogFilters(await searchParams);
  const copy = getPublicCopy(filters.language);
  const hasFilters = hasCatalogFilters(filters);
  const [catalogResult, portalsResult] = await Promise.allSettled([
    listPublicCatalog(filters),
    listPublicPortals(),
  ]);
  const unavailable = catalogResult.status === "rejected";
  const items = catalogResult.status === "fulfilled" ? catalogResult.value : [];
  const showFilters = unavailable || hasFilters || items.length > 0;
  const portals =
    portalsResult.status === "fulfilled" ? portalsResult.value : [];
  const labels = {
    featured: copy.featured,
    free: copy.free,
    preview: "",
    flexible: copy.anyDuration,
    view: "Explore course",
    minutes: "min",
  };
  const language = publicLanguageQueryValue(filters.language);
  return (
    <main className="catalog-revamp text-edsync-text">
      <PublicTopbar active="catalog" language={filters.language} />
      {isDemoSite && (
        <section id="demo-roles" className="mx-auto mt-5 max-w-7xl scroll-mt-20 px-4 sm:px-6">
          <div className="premium-panel rounded-[1.4rem] border border-edsync-blue/20 bg-edsync-blue/5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="catalog-eyebrow">Interactive sample</span>
                <h2 className="mt-1 font-display text-xl font-semibold">See EdSync with real example lessons</h2>
                <p className="mt-1 text-sm text-edsync-subtle">Choose a view to explore sample classes, courses, and progress. This shared demo is read-only.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action="/api/demo/session" method="post">
                  <input type="hidden" name="role" value="student" />
                  <button className="btn-primary" type="submit"><BookOpenCheck size={16} /> Explore as learner</button>
                </form>
                <form action="/api/demo/session" method="post">
                  <input type="hidden" name="role" value="teacher" />
                  <button className="btn-secondary" type="submit"><GraduationCap size={16} /> Explore as teacher</button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}
      {!hasFilters && (
        <section className="catalog-hero">
          <div className="max-w-2xl">
            <span className="catalog-eyebrow">
              <Sparkles size={14} /> {copy.catalogLabel}
            </span>
            <h1 className="font-display">{copy.heroTitle}</h1>
            <p>{copy.heroCopy}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#courses" className="btn-primary">
                {copy.catalogLabel}
                <ArrowRight size={16} />
              </a>
              {!isDemoSite && <Link
                href={publicLanguageHref("/auth/signup", filters.language)}
                className="btn-secondary"
              >
                {copy.createWorkspace}
              </Link>}
            </div>
          </div>
        </section>
      )}
      <section id="courses" className="catalog-browse scroll-mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="catalog-eyebrow">Explore at your own pace</span>
            <h2 className="mt-2 font-display text-2xl font-bold">
              {hasFilters ? "Find your next course" : copy.courses}
            </h2>
          </div>
          <span className="text-sm text-edsync-subtle">
            {unavailable ? "" : `${items.length} ${copy.courses.toLowerCase()}`}
          </span>
        </div>
        {showFilters && <form action="/catalog" className="catalog-filter">
          {language && <input type="hidden" name="language" value={language} />}
          {filters.tenantSlug && (
            <input type="hidden" name="tenant" value={filters.tenantSlug} />
          )}
          {filters.portalSlug && (
            <input type="hidden" name="portal" value={filters.portalSlug} />
          )}
          <label>
            <Search size={18} />
            <span className="sr-only">{copy.searchPlaceholder}</span>
            <input
              name="q"
              defaultValue={filters.query}
              placeholder={copy.searchPlaceholder}
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-1 rounded-full border border-edsync-border bg-edsync-surface p-1">
            <legend className="sr-only">{copy.allPrices}</legend>
            {([
              ["all", copy.allPrices],
              ["free", copy.free],
              ["paid", copy.paid],
            ] as const).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input className="peer sr-only" type="radio" name="price" value={value} defaultChecked={filters.price === value} />
                <span className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-edsync-subtle transition peer-checked:bg-edsync-blue peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-edsync-blue">
                  {label}
                </span>
              </label>
            ))}
          </fieldset>
          <select
            name="duration"
            aria-label={copy.anyDuration}
            defaultValue={filters.maxDuration ?? ""}
          >
            <option value="">{copy.anyDuration}</option>
            <option value="30">Under 30 min</option>
            <option value="60">Under 1 hour</option>
            <option value="120">Under 2 hours</option>
          </select>
          <button className="btn-primary" type="submit">
            {copy.searchButton}
            <ArrowRight size={15} />
          </button>
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-edsync-subtle">
              {copy.filters}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input
                className="edsync-input"
                aria-label={copy.categories}
                name="category"
                defaultValue={filters.category}
                placeholder={copy.categories}
              />
              <input
                className="edsync-input"
                aria-label={copy.difficulty}
                name="difficulty"
                defaultValue={filters.difficulty}
                placeholder={copy.difficulty}
              />
              <input
                className="edsync-input"
                aria-label="Course language"
                name="courseLanguage"
                defaultValue={filters.courseLanguage}
                placeholder="Course language"
              />
              <label className="text-xs">
                <input
                  type="checkbox"
                  name="featured"
                  value="true"
                  defaultChecked={filters.featuredOnly}
                />
                {copy.featured}
              </label>
            </div>
          </details>
        </form>}
        {hasFilters && (
          <Link
            href={publicLanguageHref("/catalog", filters.language)}
            className="mb-4 inline-block text-sm text-edsync-blue underline"
          >
            {copy.clearFilters}
          </Link>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CatalogCourseCard
              key={item.id}
              item={item}
              labels={labels}
              language={filters.language}
            />
          ))}
        </div>
        {!items.length && (
          <div className="rounded-2xl border border-dashed border-edsync-border p-10 text-center">
            <BookOpenCheck
              className="mx-auto mb-4 text-edsync-blue"
              size={32}
            />
            <h3 className="font-semibold">
              {unavailable
                ? "Courses are temporarily unavailable"
                : copy.emptyTitle}
            </h3>
            {(unavailable || hasFilters) && <p className="mt-2 text-sm text-edsync-subtle">
              {unavailable ? "Please try again in a moment." : copy.emptyCopy}
            </p>}
            <Link
              href={isDemoSite && !unavailable && !hasFilters ? "#demo-roles" : publicLanguageHref(unavailable || hasFilters ? "/catalog" : "/auth/signup", filters.language)}
              className="btn-secondary mt-5"
            >
              {unavailable ? "Try again" : hasFilters ? copy.clearFilters : isDemoSite ? "Explore sample workspace" : copy.createWorkspace}
            </Link>
          </div>
        )}
        {portals.length > 0 && (
          <details className="mt-10 rounded-2xl border border-edsync-border p-5">
            <summary className="cursor-pointer font-display text-lg font-semibold">
              {copy.academies}
              <span className="ml-2 text-sm text-edsync-subtle">
                {portals.length}
              </span>
            </summary>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portals.map((portal) => (
                <Link
                  key={portal.id}
                  href={publicLanguageHref(
                    `/org/${portal.slug}`,
                    filters.language,
                    { tenant: portal.tenant_slug },
                  )}
                  className="premium-card flex items-center gap-3 rounded-xl p-4"
                >
                  <Building2 size={18} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {portal.name}
                  </span>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </details>
        )}
        <footer className="mt-12 flex justify-between border-t border-edsync-border pt-5 text-xs text-edsync-subtle">
          <span>EdSync · Keep growing.</span>
          <Link href={isDemoSite ? "#demo-roles" : publicLanguageHref("/auth/login", filters.language)}>
            {isDemoSite ? "Explore demo" : copy.signIn}
            <ArrowRight className="ml-2 inline" size={12} />
          </Link>
        </footer>
      </section>
    </main>
  );
}
