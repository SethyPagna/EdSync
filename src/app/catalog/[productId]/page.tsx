import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Clock3,
  GraduationCap,
  Languages,
} from "lucide-react";
import CatalogEnrollButton from "@/components/CatalogEnrollButton";
import PublicTopbar from "@/components/public/PublicTopbar";
import { getPublicCatalogItem } from "@/lib/catalog";
import { validateCatalogProductId } from "@/lib/validation/catalog";
import { getPublicCopy } from "@/lib/public/i18n";
import { publicLanguageQuerySuffix, type PublicLanguageSearchParams } from "@/lib/public/languages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId: rawProductId } = await params;
  let productId: string;
  try {
    productId = validateCatalogProductId(rawProductId);
  } catch {
    return {
      title: "Course",
      description: "Course preview.",
    };
  }
  const item = await getPublicCatalogItem(productId);
  return {
    title: item ? item.title : "Course",
    description:
      item?.metadata.previewSummary ||
      item?.description ||
      "Course preview.",
  };
}

export default async function CatalogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<PublicLanguageSearchParams & { enrolled?: string; checkout?: string }>;
}) {
  const { productId: rawProductId } = await params;
  const resolvedSearchParams = await searchParams;
  let productId: string;
  try {
    productId = validateCatalogProductId(rawProductId);
  } catch {
    notFound();
  }
  const item = await getPublicCatalogItem(productId);
  if (!item) notFound();
  const host = (await headers()).get("host")?.trim().toLowerCase().split(":")[0];
  const isDemoSite = process.env.EDSYNC_DEMO_MODE === "1" &&
    Boolean(host && host === process.env.EDSYNC_DEMO_HOSTNAME?.trim().toLowerCase());
  const cookieStore = await cookies();
  const publicLanguage = resolvedSearchParams?.language ?? cookieStore.get("edsync-language")?.value;
  const copy = getPublicCopy(publicLanguage);
  const languageQuery = publicLanguageQuerySuffix(publicLanguage);
  const displayPrice = item.price.isFree ? copy.free : item.price.label;
  const previewSummary = item.metadata.previewSummary || item.description || "Course preview.";
  const enrollLabels = {
    enrolled: copy.start,
    requestSent: copy.start,
    alreadyEnrolled: copy.start,
    enrollFree: `${copy.start} ${copy.free.toLowerCase()}`,
    startCheckout: copy.start,
    working: `${copy.start}...`,
    error: copy.emptyCopy,
    connectionError: copy.emptyCopy,
    manualSuccess: copy.start,
    activeSuccess: copy.start,
    enrolledSuccess: copy.start,
    unavailable: "Unavailable",
  };

  return (
    <main className="premium-shell min-h-screen text-edsync-text">
      <PublicTopbar
        active="course"
        organizationName={item.portal?.name || item.organization.name}
        organizationCode={item.organization.slug}
        portalSlug={item.portal?.slug}
        language={publicLanguage}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Link href={`/catalog${languageQuery}`} className="btn-ghost w-fit px-0">
            {copy.catalogLabel}
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
                  {displayPrice}
                </span>
                {item.metadata.category && (
                  <span className="rounded-full bg-edsync-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                    {item.metadata.category}
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{item.title}</h1>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-edsync-subtle">
                {previewSummary}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-edsync-subtle">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {item.lesson.durationMinutes ? `${item.lesson.durationMinutes} min` : copy.anyDuration}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              {item.metadata.difficulty || item.lesson.gradeLevel || copy.difficulty}
            </span>
            {item.metadata.language && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edsync-border bg-edsync-surface px-3 py-1.5">
                <Languages className="h-3.5 w-3.5" />
                {item.metadata.language}
              </span>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {resolvedSearchParams?.enrolled && (
            <div className="rounded-lg border border-edsync-emerald/30 bg-edsync-emerald/10 p-4 text-sm text-edsync-emerald">
              Enrolled.
            </div>
          )}
          {resolvedSearchParams?.checkout === "cancelled" && (
            <div className="rounded-lg border border-edsync-amber/30 bg-edsync-amber/10 p-4 text-sm text-edsync-amber">
              Checkout cancelled.
            </div>
          )}
          <div className="premium-panel rounded-2xl p-5">
            <p className="font-display text-3xl font-semibold">{displayPrice}</p>
            <div className="mt-4">
              {isDemoSite ? <><Link href="/catalog#demo-roles" className="btn-primary w-full justify-center">
                Explore sample workspace <ArrowRight className="h-4 w-4" />
              </Link><p className="mt-3 text-xs text-edsync-subtle">This is sample content. Enrollment and checkout are disabled in the read-only demo.</p></> : <CatalogEnrollButton
                productId={item.id}
                isFree={item.price.isFree}
                available={item.price.isFree || Boolean(item.price.id)}
                language={publicLanguage}
                labels={enrollLabels}
              />}
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-edsync-border pt-4 text-sm">
              <Building2 className="h-4 w-4 shrink-0 text-edsync-blue" />
              <span className="min-w-0 flex-1 truncate text-edsync-subtle">{item.portal?.name || item.organization.name}</span>
              {item.portal && (
                <Link href={`/org/${item.portal.slug}${languageQuery}`} className="inline-flex items-center gap-1 text-edsync-blue hover:underline" aria-label={`${copy.academies}: ${item.portal.name}`}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
