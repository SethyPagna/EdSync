import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenCheck, Building2, Clock3, Globe2, Search } from "lucide-react";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters } from "@/lib/catalog-filters";

export async function generateMetadata({
  params,
}: {
  params: { portalSlug: string };
}): Promise<Metadata> {
  const portals = await listPublicPortals();
  const portal = portals.find((item) => item.slug === params.portalSlug);
  return {
    title: portal ? `${portal.name} Catalog` : "Organization Catalog",
    description: portal
      ? `Browse public courses and programs from ${portal.tenant_name}.`
      : "Browse an EdSync organization catalog.",
  };
}

export default async function OrganizationPortalPage({
  params,
  searchParams,
}: {
  params: { portalSlug: string };
  searchParams?: {
    q?: string;
    price?: string;
    difficulty?: string;
    language?: string;
    duration?: string;
  };
}) {
  const portals = await listPublicPortals();
  const portal = portals.find((item) => item.slug === params.portalSlug);
  if (!portal) notFound();

  const filters = normalizeCatalogFilters({
    ...searchParams,
    portal: portal.slug,
    tenant: portal.tenant_slug,
  });
  const hasFilters = hasCatalogFilters({ ...filters, portalSlug: null, tenantSlug: null });
  const items = await listPublicCatalog({
    ...filters,
  });

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="border-b border-edsync-border bg-edsync-surface/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/catalog" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">{portal.name}</p>
              <p className="text-xs text-edsync-subtle">{portal.tenant_name}</p>
            </div>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/catalog" className="btn-secondary justify-center px-4 py-2 text-sm">Global catalog</Link>
            <Link href="/auth/login" className="btn-primary justify-center px-4 py-2 text-sm">Sign in</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-edsync-border bg-edsync-card p-5 sm:p-7">
            <p className="inline-flex rounded-lg border border-edsync-blue/20 bg-edsync-blue/10 px-3 py-1.5 text-sm font-semibold text-edsync-blue">
              Organization academy
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              {portal.name}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-edsync-subtle">
              Browse public courses and programs from {portal.tenant_name}. Enrollment stays tied to your EdSync account,
              whether you join as an individual learner or through an organization.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="badge bg-edsync-blue/10 text-edsync-blue">{portal.audience}</span>
              <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{items.length} courses</span>
            </div>
            <form className="mt-6 rounded-lg border border-edsync-border bg-edsync-surface p-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(8rem,1fr))_auto] [&>*]:min-w-0">
                <label className="relative">
                  <span className="sr-only">Search this academy</span>
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-edsync-subtle" />
                  <input
                    name="q"
                    defaultValue={filters.query}
                    className="edsync-input pl-9"
                    placeholder="Search this academy"
                  />
                </label>
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
                <select name="duration" defaultValue={filters.maxDuration ?? ""} className="edsync-input min-w-0">
                  <option value="">Any duration</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="120">2 hours</option>
                </select>
                <button type="submit" className="btn-primary justify-center">
                  Filter
                </button>
              </div>
            </form>
          </div>
          <div className="rounded-lg border border-edsync-border bg-edsync-card p-5">
            <Globe2 className="mb-3 h-7 w-7 text-edsync-blue" />
            <p className="font-semibold">Scoped portal</p>
            <p className="mt-2 text-sm leading-6 text-edsync-subtle">
              Organization managers control only this academy: courses, branding, visibility, and catalog settings stay separate from the platform owner console.
            </p>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Courses</h2>
            {hasFilters && (
              <Link href={`/org/${portal.slug}`} className="text-sm font-semibold text-edsync-blue hover:underline">
                Clear filters
              </Link>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={item.detailUrl} className="group overflow-hidden rounded-lg border border-edsync-border bg-edsync-card transition hover:border-edsync-blue/40 hover:shadow-card-hover">
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
              <div className="p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.price.label}</span>
                  {item.metadata.category && <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.metadata.category}</span>}
                </div>
                <h2 className="font-display text-xl font-bold">{item.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-edsync-subtle">
                  {item.metadata.previewSummary || item.description || "Open this course to preview details and enroll."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-edsync-subtle">
                    <Clock3 className="h-4 w-4" />
                    {item.lesson.durationMinutes ? `${item.lesson.durationMinutes} min` : "Flexible"}
                  </span>
                  <span className="inline-flex items-center gap-2 font-semibold text-edsync-blue">
                    View course <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
          </div>
        </section>

        {items.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
            <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
            <p className="font-semibold text-edsync-text">No public courses in this portal yet</p>
            <p className="mt-2 text-sm text-edsync-subtle">Check back later or browse the global catalog.</p>
            <Link href="/catalog" className="btn-primary mx-auto mt-5 w-fit">
              Browse global catalog
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
