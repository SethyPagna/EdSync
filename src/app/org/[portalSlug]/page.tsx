import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  Globe2,
  Search,
  UsersRound,
} from "lucide-react";
import PublicTopbar from "@/components/public/PublicTopbar";
import { getOrganizationPortal, listPublicCatalog } from "@/lib/catalog";
import { hasCatalogFilters, normalizeCatalogFilters } from "@/lib/catalog-filters";

export async function generateMetadata({
  params,
}: {
  params: { portalSlug: string };
}): Promise<Metadata> {
  const portal = await getOrganizationPortal(params.portalSlug);
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
  const portal = await getOrganizationPortal(params.portalSlug);
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
    <main className="premium-shell min-h-screen text-edsync-text">
      <PublicTopbar
        active="organization"
        organizationName={portal.name}
        organizationCode={portal.tenant_slug}
        portalSlug={portal.slug}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="premium-panel animate-reveal-soft overflow-hidden rounded-[1.65rem]">
            <div className="p-5 sm:p-7">
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
                {portal.name}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-edsync-subtle">
                Browse {portal.tenant_name} courses, then enter the organization when your school,
                cohort, or company manages your access.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge bg-edsync-blue/10 text-edsync-blue">{portal.audience}</span>
                <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{items.length} courses</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/auth/login?org=${encodeURIComponent(portal.tenant_slug)}`}
                  className="btn-primary justify-center"
                >
                  Enter organization
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/auth/signup?org=${encodeURIComponent(portal.tenant_slug)}`}
                  className="btn-secondary justify-center"
                >
                  Create account
                </Link>
              </div>
            </div>
            <form className="border-t border-edsync-border bg-edsync-surface/85 p-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(8rem,1fr))_auto] [&>*]:min-w-0">
                <label className="relative">
                  <span className="sr-only">Search this academy</span>
                  <input
                    name="q"
                    defaultValue={filters.query}
                    className="edsync-input"
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
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </form>
          </div>
          <div className="grid gap-3">
            <div className="premium-card rounded-2xl p-5">
              <Globe2 className="mb-3 h-8 w-8 text-edsync-blue" />
              <p className="font-semibold">Scoped portal</p>
              <p className="mt-2 text-sm leading-6 text-edsync-subtle">
                Courses, branding, access, and reports stay inside this academy.
              </p>
            </div>
            <div className="premium-card rounded-2xl p-5">
              <UsersRound className="mb-3 h-8 w-8 text-edsync-emerald" />
              <p className="font-semibold">Member flow</p>
              <p className="mt-2 text-sm leading-6 text-edsync-subtle">
                Sign in with the organization context, then continue as teacher, student, or manager.
              </p>
            </div>
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
              <Link
                key={item.id}
                href={item.detailUrl}
                className="premium-card group overflow-hidden rounded-2xl"
              >
                <div className="relative aspect-video overflow-hidden bg-edsync-surface">
                  {item.metadata.thumbnailUrl ? (
                    <div
                      className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
                      style={{ backgroundImage: `url(${item.metadata.thumbnailUrl})` }}
                      aria-label={`${item.title} thumbnail`}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-edsync-blue/20 via-edsync-surface to-edsync-emerald/20">
                      <BookOpenCheck className="h-12 w-12 text-edsync-blue" />
                    </div>
                  )}
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-edsync-surface/90 px-2.5 py-1 text-xs font-bold text-edsync-text shadow-sm backdrop-blur">
                      {item.price.label}
                    </span>
                    {item.metadata.category && (
                      <span className="rounded-full bg-edsync-blue px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                        {item.metadata.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <h2 className="font-display text-xl font-bold">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-edsync-subtle">
                    {item.metadata.previewSummary ||
                      item.description ||
                      "Open this course to preview details and enroll."}
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
          <div className="premium-surface mt-8 rounded-2xl border-dashed p-10 text-center">
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
