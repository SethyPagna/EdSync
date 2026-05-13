import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenCheck, Building2, Globe2 } from "lucide-react";
import { listPublicCatalog, listPublicPortals } from "@/lib/catalog";

export default async function OrganizationPortalPage({
  params,
}: {
  params: { portalSlug: string };
}) {
  const portals = await listPublicPortals();
  const portal = portals.find((item) => item.slug === params.portalSlug);
  if (!portal) notFound();

  const items = await listPublicCatalog({
    portalSlug: portal.slug,
    tenantSlug: portal.tenant_slug,
  });

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="border-b border-edsync-border bg-edsync-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/catalog" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-edsync-blue to-edsync-emerald">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">{portal.name}</p>
              <p className="text-xs text-edsync-subtle">{portal.tenant_name}</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link href="/catalog" className="btn-secondary justify-center px-4 py-2 text-sm">Global catalog</Link>
            <Link href="/auth/login" className="btn-primary justify-center px-4 py-2 text-sm">Sign in</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Organization portal</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
              {portal.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-edsync-subtle">
              Browse public courses and programs from {portal.tenant_name}. Enrollment stays tied to your EdSync account.
            </p>
          </div>
          <div className="rounded-lg border border-edsync-border bg-edsync-card p-5">
            <Globe2 className="mb-3 h-7 w-7 text-edsync-blue" />
            <p className="font-semibold">Portal scope</p>
            <p className="mt-2 text-sm leading-6 text-edsync-subtle">
              This catalog is scoped to one organization. Organization managers can control their own courses, branding, and visibility without changing the global platform.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={item.detailUrl} className="group rounded-lg border border-edsync-border bg-edsync-card p-5 transition hover:border-edsync-blue/40 hover:shadow-card-hover">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-edsync-blue/10 text-edsync-blue">
                <BookOpenCheck className="h-7 w-7" />
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.price.label}</span>
                {item.metadata.category && <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.metadata.category}</span>}
              </div>
              <h2 className="font-display text-xl font-bold">{item.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-edsync-subtle">
                {item.metadata.previewSummary || item.description || "Open this course to preview details and enroll."}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-edsync-blue">
                View course <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>

        {items.length === 0 && (
          <div className="mt-8 rounded-lg border border-dashed border-edsync-border bg-edsync-card p-10 text-center">
            <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-edsync-subtle" />
            <p className="font-semibold text-edsync-text">No public courses in this portal yet</p>
            <p className="mt-2 text-sm text-edsync-subtle">Check back later or browse the global catalog.</p>
          </div>
        )}
      </section>
    </main>
  );
}

