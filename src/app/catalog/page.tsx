import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
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

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="border-b border-edsync-border bg-edsync-surface/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">EdSync</p>
              <p className="text-xs text-edsync-subtle">Catalog and academies</p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Link href="#organizations" className="btn-ghost px-3 py-2 text-sm">
              Organizations
            </Link>
            <Link href="/auth/login" className="btn-secondary justify-center px-4 py-2 text-sm">
              Sign in
            </Link>
            <Link href="/auth/signup" className="btn-primary justify-center px-4 py-2 text-sm">
              Create workspace
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5 sm:p-7">
            <p className="inline-flex rounded-lg border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-1.5 text-sm font-semibold text-edsync-blue">
              Public learning catalog
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-6xl">
              Find a course, join an academy, or start your own workspace.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-edsync-subtle">
              Browse EdSync courses across public organizations. Sign in only when
              you are ready to enroll, teach, manage an academy, or continue your
              individual learning space.
            </p>
            <form className="mt-6 rounded-lg border border-edsync-border bg-edsync-surface p-3">
              <label className="sr-only" htmlFor="catalog-search">
                Search catalog
              </label>
              {filters.portalSlug && <input type="hidden" name="portal" value={filters.portalSlug} />}
              {filters.tenantSlug && <input type="hidden" name="tenant" value={filters.tenantSlug} />}
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-edsync-subtle" />
                  <input
                    id="catalog-search"
                    name="q"
                    defaultValue={filters.query}
                    className="edsync-input pl-9"
                    placeholder="Search subject, skill, organization, or course"
                  />
                </div>
                <select name="price" defaultValue={filters.price} className="edsync-input min-w-28">
                  <option value="all">All prices</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
                <input
                  name="difficulty"
                  defaultValue={filters.difficulty}
                  className="edsync-input min-w-28"
                  placeholder="Difficulty"
                />
                <input
                  name="language"
                  defaultValue={filters.language}
                  className="edsync-input min-w-28"
                  placeholder="Language"
                />
                <select name="duration" defaultValue={filters.maxDuration ?? ""} className="edsync-input min-w-32">
                  <option value="">Any duration</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="120">2 hours</option>
                </select>
                <button className="btn-primary justify-center" type="submit">
                  Search
                </button>
              </div>
            </form>
            {categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Link
                    key={category}
                    href={`/catalog?category=${encodeURIComponent(category)}`}
                    className="rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5 text-sm font-semibold text-edsync-subtle transition hover:border-edsync-blue/40 hover:text-edsync-blue"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "Courses", value: items.length, icon: BookOpenCheck, tone: "text-edsync-blue" },
              { label: "Free", value: freeCount, icon: CheckCircle2, tone: "text-edsync-emerald" },
              { label: "Paid", value: paidCount, icon: Sparkles, tone: "text-edsync-amber" },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-xl border border-edsync-border bg-edsync-card p-5">
                  <Icon className={`mb-4 h-7 w-7 ${metric.tone}`} />
                  <p className="font-display text-3xl font-bold">{metric.value}</p>
                  <p className="text-sm text-edsync-subtle">{metric.label}</p>
                </div>
              );
            })}
          </aside>
        </div>

        {featured.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Featured learning</h2>
              <span className="text-sm text-edsync-subtle">Curated by organizations</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {featured.map((item) => (
                <CatalogCard key={item.id} item={item} featured />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">All public courses</h2>
              <p className="text-sm text-edsync-subtle">
                Global and organization-published learning products.
              </p>
            </div>
            {hasFilters && (
              <Link href="/catalog" className="text-sm font-semibold text-edsync-blue hover:underline">
                Clear filters
              </Link>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <CatalogCard key={item.id} item={item} />
            ))}
          </div>
          {items.length === 0 && (
            <div className="rounded-lg border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
              <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
              <p className="font-semibold text-edsync-text">No public courses found</p>
              <p className="mt-2 text-sm text-edsync-subtle">
                Try another search, browse an organization portal, or create your own workspace.
              </p>
              <Link href="/auth/signup" className="btn-primary mx-auto mt-5 w-fit">
                Create workspace
              </Link>
            </div>
          )}
        </section>

        <section id="organizations" className="mt-10">
          <div className="mb-3">
            <h2 className="font-display text-2xl font-bold">Organization academies</h2>
            <p className="text-sm text-edsync-subtle">
              Blackboard-style portals for schools, companies, cohorts, and partner learning spaces.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portals.slice(0, 9).map((portal) => (
              <Link
                key={portal.id}
                href={`/org/${portal.slug}`}
                className="group rounded-lg border border-edsync-border bg-edsync-card p-4 transition hover:border-edsync-blue/40 hover:shadow-card-hover"
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
          {portals.length === 0 && (
            <div className="rounded-lg border border-dashed border-edsync-border bg-edsync-card p-6 text-sm text-edsync-subtle">
              Public organization portals will appear here after admins publish them.
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-3 rounded-xl border border-edsync-border bg-edsync-surface p-5 md:grid-cols-3">
          {[
            { icon: UsersRound, title: "Individuals", copy: "Create a personal teacher or learner workspace." },
            { icon: Building2, title: "Organizations", copy: "Run tenant-scoped academies, catalogs, roles, and portals." },
            { icon: ShieldCheck, title: "Platform owner", copy: "Global admin controls stay separate from organization managers." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-edsync-border bg-edsync-card p-4">
                <Icon className="mb-3 h-5 w-5 text-edsync-blue" />
                <p className="font-semibold text-edsync-text">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-edsync-subtle">{item.copy}</p>
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function CatalogCard({
  item,
  featured = false,
}: {
  item: Awaited<ReturnType<typeof listPublicCatalog>>[number];
  featured?: boolean;
}) {
  return (
    <Link
      href={item.detailUrl}
      className={`group overflow-hidden rounded-lg border bg-edsync-card transition hover:border-edsync-blue/40 hover:shadow-card-hover ${
        featured ? "border-edsync-blue/30" : "border-edsync-border"
      }`}
    >
      <div className="aspect-video bg-edsync-surface">
        {item.metadata.thumbnailUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${item.metadata.thumbnailUrl})` }}
            aria-label={`${item.title} thumbnail`}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-edsync-blue/15 to-edsync-emerald/15">
            <BookOpenCheck className="h-12 w-12 text-edsync-blue" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {featured && <span className="badge bg-edsync-blue/10 text-edsync-blue">Featured</span>}
          <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.price.label}</span>
          {item.metadata.category && (
            <span className="badge bg-edsync-amber/10 text-edsync-amber">{item.metadata.category}</span>
          )}
        </div>
        <h3 className="font-display text-xl font-bold leading-tight text-edsync-text">{item.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-edsync-subtle">
          {item.metadata.previewSummary || item.description || "Preview this course and enroll when you are ready."}
        </p>
        <div className="mt-4 grid gap-2 text-xs text-edsync-subtle sm:grid-cols-2">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{item.organization.name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {item.lesson.durationMinutes ? `${item.lesson.durationMinutes} min` : "Flexible"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-edsync-blue">
          <span>View course</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
