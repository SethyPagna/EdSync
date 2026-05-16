import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Clock3,
  GraduationCap,
  Languages,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import CatalogEnrollButton from "@/components/CatalogEnrollButton";
import PublicTopbar from "@/components/public/PublicTopbar";
import { getPublicCatalogItem } from "@/lib/catalog";

export async function generateMetadata({
  params,
}: {
  params: { productId: string };
}): Promise<Metadata> {
  const item = await getPublicCatalogItem(params.productId);
  return {
    title: item ? item.title : "Course",
    description:
      item?.metadata.previewSummary ||
      item?.description ||
      "Preview an EdSync public course and enroll when ready.",
  };
}

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
    <main className="premium-shell min-h-screen text-edsync-text">
      <PublicTopbar
        active="course"
        organizationName={item.portal?.name || item.organization.name}
        organizationCode={item.organization.slug}
        portalSlug={item.portal?.slug}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Link href="/catalog" className="btn-ghost w-fit px-0">
            Back to catalog
          </Link>
          <div className="premium-panel animate-reveal-soft overflow-hidden rounded-[1.65rem]">
            <div className="relative aspect-video overflow-hidden bg-edsync-surface">
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
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-edsync-blue/20 via-edsync-surface to-edsync-emerald/20">
                  <BookOpenCheck className="h-16 w-16 text-edsync-blue" />
                </div>
              )}
              <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-edsync-surface/90 px-3 py-1.5 text-xs font-bold text-edsync-text shadow-sm backdrop-blur">
                  {item.price.label}
                </span>
                {item.metadata.category && (
                  <span className="rounded-full bg-edsync-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                    {item.metadata.category}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight">{item.title}</h1>
              <p className="mt-4 text-base leading-7 text-edsync-subtle">
                {item.metadata.previewSummary || item.description || "This public course is available through EdSync."}
              </p>
            </div>
          </div>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="premium-card rounded-2xl p-4">
              <Clock3 className="mb-3 h-5 w-5 text-edsync-blue" />
              <p className="font-semibold">Duration</p>
              <p className="text-sm text-edsync-subtle">{item.lesson.durationMinutes || "Flexible"} minutes</p>
            </div>
            <div className="premium-card rounded-2xl p-4">
              <GraduationCap className="mb-3 h-5 w-5 text-edsync-emerald" />
              <p className="font-semibold">Level</p>
              <p className="text-sm text-edsync-subtle">{item.metadata.difficulty || item.lesson.gradeLevel || "Open"}</p>
            </div>
            <div className="premium-card rounded-2xl p-4">
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
          <div className="premium-panel rounded-2xl p-5">
            <p className="text-sm font-semibold text-edsync-subtle">Enrollment</p>
            <p className="mt-2 font-display text-4xl font-bold">{item.price.label}</p>
            <p className="mt-2 text-sm leading-6 text-edsync-subtle">
              Sign in, choose your organization when one applies, then EdSync keeps access, progress, grades, and certificates tied to the right space.
            </p>
            <div className="mt-5">
              <CatalogEnrollButton productId={item.id} isFree={item.price.isFree} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="premium-card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-edsync-blue" />
                <div>
                  <p className="font-semibold">Individual learner</p>
                  <p className="mt-1 text-sm leading-6 text-edsync-subtle">
                    Join with your own account and continue from your student dashboard.
                  </p>
                </div>
              </div>
            </div>
            <div className="premium-card rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-edsync-emerald" />
                <div>
                  <p className="font-semibold">Organization member</p>
                  <p className="mt-1 text-sm leading-6 text-edsync-subtle">
                    Enter through your academy so access and reports stay scoped correctly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="premium-card rounded-2xl p-5">
            <div className="flex gap-3">
              <Building2 className="h-5 w-5 flex-shrink-0 text-edsync-blue" />
              <div>
                <p className="font-semibold">{item.organization.name}</p>
                <p className="mt-1 text-sm text-edsync-subtle">
                  {item.portal ? `${item.portal.name} - ${item.portal.audience}` : "Main EdSync catalog"}
                </p>
                {item.portal && (
                  <Link href={`/org/${item.portal.slug}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-edsync-blue hover:underline">
                    View organization catalog
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="premium-surface rounded-2xl p-4">
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
