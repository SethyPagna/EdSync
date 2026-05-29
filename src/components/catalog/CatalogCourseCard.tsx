import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, Clock3 } from "lucide-react";
import type { PublicCatalogItem } from "@/lib/catalog";
import { publicLanguageQuerySuffix } from "@/lib/public/languages";

type CatalogCourseCardProps = {
  item: PublicCatalogItem;
  featured?: boolean;
  showOrganization?: boolean;
  language?: string | null;
  labels?: {
    featured: string;
    free: string;
    preview: string;
    flexible: string;
    view: string;
    minutes: string;
  };
};

export default function CatalogCourseCard({
  item,
  featured = false,
  showOrganization = true,
  language,
  labels = {
    featured: "Featured",
    free: "Free",
    preview: "Course preview.",
    flexible: "Flexible",
    view: "View",
    minutes: "min",
  },
}: CatalogCourseCardProps) {
  const detailUrl = `${item.detailUrl}${publicLanguageQuerySuffix(language)}`;

  return (
    <Link
      href={detailUrl}
      className={`premium-card group overflow-hidden rounded-2xl ${
        featured ? "border-edsync-blue/40" : ""
      }`}
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
            {item.price.isFree ? labels.free : item.price.label}
          </span>
          {(featured || item.metadata.category) && (
            <span className="rounded-full bg-edsync-blue px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              {featured ? labels.featured : item.metadata.category}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {featured && item.metadata.category && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="badge bg-edsync-amber/10 text-edsync-amber">
              {item.metadata.category}
            </span>
          </div>
        )}
        <h3 className="font-display text-xl font-bold leading-tight text-edsync-text">
          {item.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-edsync-subtle">
          {item.metadata.previewSummary ||
            item.description ||
            labels.preview}
        </p>
        <div className="mt-4 grid gap-2 text-xs text-edsync-subtle sm:grid-cols-2">
          {showOrganization && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{item.organization.name}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {item.lesson.durationMinutes ? `${item.lesson.durationMinutes} ${labels.minutes}` : labels.flexible}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-edsync-blue">
          <span>{labels.view}</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
