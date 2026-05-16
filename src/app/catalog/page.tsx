import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Clock3,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
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

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <PublicTopbar active="catalog" />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
          <div className="overflow-hidden rounded-2xl border border-edsync-border bg-edsync-card shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="p-5 sm:p-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-1.5 text-sm font-semibold text-edsync-blue">
                  <Search className="h-4 w-4" />
                  Public learning catalog
                </p>
                <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-6xl">
                  Discover courses and enter the right learning space.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-edsync-subtle">
                  Search public courses, organization academies, and free or paid programs. EdSync keeps
                  individual and organization learning connected without mixing their data.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="#catalog-results" className="btn-primary justify-center">
                    Browse courses
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="#organizations" className="btn-secondary justify-center">
                    <Building2 className="h-4 w-4" />
                    Find organization
                  </Link>
                </div>
              </div>
              <div className="border-t border-edsync-border bg-edsync-surface p-4 lg:border-l lg:border-t-0">
                <div className="rounded-xl border border-edsync-border bg-edsync-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-edsync-subtle">Today in EdSync</p>
                      <p className="mt-1 font-display text-2xl font-bold">Catalog ready</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                      <Layers3 className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {[
                      ["Search", "Find lessons, courses, portals"],
                      ["Enroll", "Free access or checkout"],
                      ["Learn", "Dashboard, practice, progress"],
                    ].map(([title, copy], index) => (
                      <div
                        key={title}
                        className="flex items-center gap-3 rounded-lg border border-edsync-border bg-edsync-bg/60 p-3"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-edsync-blue/10 text-xs font-bold text-edsync-blue">
                          {index + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-edsync-text">{title}</span>
                          <span className="block text-xs text-edsync-subtle">{copy}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <form className="border-t border-edsync-border bg-edsync-surface p-3">
              <label className="sr-only" htmlFor="catalog-search">
                Search catalog
              </label>
              {filters.portalSlug && <input type="hidden" name="portal" value={filters.portalSlug} />}
              {filters.tenantSlug && <input type="hidden" name="tenant" value={filters.tenantSlug} />}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(8rem,1fr))_auto] [&>*]:min-w-0">
                <div>
                  <input
                    id="catalog-search"
                    name="q"
                    defaultValue={filters.query}
                    className="edsync-input"
                    placeholder="Search subject, skill, organization, or course"
                  />
                </div>
                <select name="price" defaultValue={filters.price} className="edsync-input min-w-0">
                  <option value="all">All prices</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
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
                <select name="duration" defaultValue={filters.maxDuration ?? ""} className="edsync-input min-w-0">
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
          </div>

          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "Courses", value: items.length, icon: BookOpenCheck, tone: "text-edsync-blue" },
              { label: "Free", value: freeCount, icon: CheckCircle2, tone: "text-edsync-emerald" },
              { label: "Paid", value: paidCount, icon: Sparkles, tone: "text-edsync-amber" },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-xl border border-edsync-border bg-edsync-card p-5 shadow-sm">
                  <Icon className={`mb-4 h-8 w-8 ${metric.tone}`} />
                  <p className="font-display text-4xl font-bold">{metric.value}</p>
                  <p className="text-sm text-edsync-subtle">{metric.label}</p>
                </div>
              );
            })}
          </aside>
        </div>

        <div className="mt-4 rounded-xl border border-edsync-border bg-edsync-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-edsync-text">Quick paths</p>
              <p className="text-sm text-edsync-subtle">Choose the way you are using EdSync today.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/auth/signup?mode=individual" className="btn-secondary justify-center px-4 py-2 text-sm">
                Individual
              </Link>
              <Link href="/auth/login?mode=organization" className="btn-secondary justify-center px-4 py-2 text-sm">
                Enter organization
              </Link>
              <Link href="/auth/login?next=/teacher/dashboard" className="btn-secondary justify-center px-4 py-2 text-sm">
                Teacher portal
              </Link>
              <Link href="/auth/login?next=/student/dashboard" className="btn-secondary justify-center px-4 py-2 text-sm">
                Student portal
              </Link>
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <section className="mt-5">
            <div className="rounded-xl border border-edsync-border bg-edsync-card p-4">
              <div className="flex flex-wrap gap-2">
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
                <CatalogCard key={item.id} item={item} featured />
              ))}
            </div>
          </section>
        )}

        <section id="catalog-results" className="mt-8 scroll-mt-32">
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
