import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, Search } from "lucide-react";
import { listPublicCatalog } from "@/lib/catalog";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: { q?: string; portal?: string; tenant?: string };
}) {
  const query = searchParams?.q ?? "";
  const items = await listPublicCatalog({
    query,
    portalSlug: searchParams?.portal ?? null,
    tenantSlug: searchParams?.tenant ?? null,
  });
  const featured = items.filter((item) => item.metadata.featured).slice(0, 3);

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="border-b border-edsync-border bg-edsync-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
              <BookOpenCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">EdSync Catalog</p>
              <p className="text-xs text-edsync-subtle">Public courses and organization academies</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link href="/auth/login" className="btn-secondary justify-center px-4 py-2 text-sm">Sign in</Link>
            <Link href="/auth/signup" className="btn-primary justify-center px-4 py-2 text-sm">Create account</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              Find free and paid learning from EdSync organizations.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-edsync-subtle">
              Browse public courses, compare organization programs, and sign in only when you are ready to enroll.
            </p>
          </div>
          <form className="rounded-lg border border-edsync-border bg-edsync-card p-3">
            <label className="mb-2 block text-sm font-semibold text-edsync-subtle" htmlFor="catalog-search">
              Search catalog
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-edsync-subtle" />
                <input id="catalog-search" name="q" defaultValue={query} className="edsync-input pl-9" placeholder="Subject, skill, or course" />
              </div>
              <button className="btn-primary justify-center" type="submit">Search</button>
            </div>
          </form>
        </div>

        {featured.length > 0 && (
          <section className="mt-8 grid gap-3 md:grid-cols-3">
            {featured.map((item) => (
              <Link key={item.id} href={item.detailUrl} className="rounded-lg border border-edsync-blue/25 bg-edsync-blue/10 p-4 transition hover:bg-edsync-blue/15">
                <p className="text-sm font-semibold text-edsync-blue">Featured</p>
                <p className="mt-2 font-display text-xl font-bold">{item.title}</p>
                <p className="mt-2 text-sm text-edsync-subtle">{item.organization.name}</p>
              </Link>
            ))}
          </section>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.price.label}</span>
                  {item.metadata.category && <span className="text-xs text-edsync-subtle">{item.metadata.category}</span>}
                </div>
                <h2 className="font-display text-xl font-bold text-edsync-text">{item.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-edsync-subtle">
                  {item.metadata.previewSummary || item.description || "Preview this course and enroll when you are ready."}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-edsync-subtle">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.organization.name}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-edsync-blue transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </section>

        {items.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
            <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
            <p className="font-semibold text-edsync-text">No public courses found</p>
            <p className="mt-2 text-sm text-edsync-subtle">Try another search or check an organization portal.</p>
          </div>
        )}
      </section>
    </main>
  );
}
