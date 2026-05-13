import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  Building2,
  Clock3,
  GraduationCap,
  Languages,
  ShieldCheck,
} from "lucide-react";
import CatalogEnrollButton from "@/components/CatalogEnrollButton";
import { getPublicCatalogItem } from "@/lib/catalog";

export default async function CatalogDetailPage({
  params,
  searchParams,
}: {
  params: { productId: string };
  searchParams?: { enrolled?: string; checkout?: string };
}) {
  const item = await getPublicCatalogItem(params.productId);
  if (!item) notFound();

  return (
    <main className="min-h-screen bg-edsync-bg text-edsync-text">
      <header className="border-b border-edsync-border bg-edsync-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Link href="/catalog" className="btn-ghost px-0">
            <ArrowLeft className="h-4 w-4" />
            Catalog
          </Link>
          <Link href="/auth/login" className="btn-secondary px-4 py-2 text-sm">Sign in</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-edsync-border bg-edsync-card">
            <div className="aspect-video bg-edsync-surface">
              {item.metadata.previewEmbedUrl ? (
                <iframe
                  className="h-full w-full"
                  src={item.metadata.previewEmbedUrl}
                  title={`${item.title} preview`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : item.metadata.previewVideoUrl ? (
                <video className="h-full w-full bg-black object-contain" controls src={item.metadata.previewVideoUrl} />
              ) : item.metadata.thumbnailUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${item.metadata.thumbnailUrl})` }}
                  aria-label={`${item.title} thumbnail`}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-edsync-blue/15 to-edsync-emerald/15">
                  <BookOpenCheck className="h-16 w-16 text-edsync-blue" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.productType}</span>
                <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{item.price.label}</span>
                {item.metadata.category && <span className="badge bg-edsync-amber/10 text-edsync-amber">{item.metadata.category}</span>}
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight">{item.title}</h1>
              <p className="mt-4 text-base leading-7 text-edsync-subtle">
                {item.metadata.previewSummary || item.description || "This public course is available through EdSync."}
              </p>
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-edsync-border bg-edsync-card p-4">
              <Clock3 className="mb-3 h-5 w-5 text-edsync-blue" />
              <p className="font-semibold">Duration</p>
              <p className="text-sm text-edsync-subtle">{item.lesson.durationMinutes || "Flexible"} minutes</p>
            </div>
            <div className="rounded-lg border border-edsync-border bg-edsync-card p-4">
              <GraduationCap className="mb-3 h-5 w-5 text-edsync-emerald" />
              <p className="font-semibold">Level</p>
              <p className="text-sm text-edsync-subtle">{item.metadata.difficulty || item.lesson.gradeLevel || "Open"}</p>
            </div>
            <div className="rounded-lg border border-edsync-border bg-edsync-card p-4">
              <Languages className="mb-3 h-5 w-5 text-edsync-amber" />
              <p className="font-semibold">Language</p>
              <p className="text-sm text-edsync-subtle">{item.metadata.language}</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {searchParams?.enrolled && (
            <div className="rounded-lg border border-edsync-emerald/30 bg-edsync-emerald/10 p-4 text-sm text-edsync-emerald">
              Enrollment is active. Open your student dashboard to continue.
            </div>
          )}
          {searchParams?.checkout === "cancelled" && (
            <div className="rounded-lg border border-edsync-amber/30 bg-edsync-amber/10 p-4 text-sm text-edsync-amber">
              Checkout was cancelled. You can restart anytime.
            </div>
          )}
          <div className="rounded-lg border border-edsync-border bg-edsync-card p-5">
            <p className="text-sm font-semibold text-edsync-subtle">Enrollment</p>
            <p className="mt-2 font-display text-4xl font-bold">{item.price.label}</p>
            <p className="mt-2 text-sm leading-6 text-edsync-subtle">
              Sign in before enrollment so EdSync can keep access, progress, grades, and certificates tied to your account.
            </p>
            <div className="mt-5">
              <CatalogEnrollButton productId={item.id} isFree={item.price.isFree} />
            </div>
          </div>

          <div className="rounded-lg border border-edsync-border bg-edsync-card p-5">
            <div className="flex gap-3">
              <Building2 className="h-5 w-5 flex-shrink-0 text-edsync-blue" />
              <div>
                <p className="font-semibold">{item.organization.name}</p>
                <p className="mt-1 text-sm text-edsync-subtle">
                  {item.portal ? `${item.portal.name} - ${item.portal.audience}` : "Main EdSync catalog"}
                </p>
                {item.portal && (
                  <Link href={`/org/${item.portal.slug}`} className="mt-3 inline-flex text-sm font-semibold text-edsync-blue hover:underline">
                    View organization catalog
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-edsync-emerald" />
              <p className="text-sm leading-6 text-edsync-subtle">
                Public previews use safe HTTPS media. Enrollment and full course access require an authenticated account.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

