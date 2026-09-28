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
      aria-label={`${labels.view}: ${item.title}`}
      className={`premium-card group overflow-hidden rounded-2xl ${
        featured ? "border-edsync-blue/40" : ""
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-edsync-surface">
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug text-edsync-text">
            {item.title}
          </h3>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-edsync-blue transition group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-edsync-subtle">
          {item.metadata.previewSummary ||
            item.description ||
            labels.preview}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-edsync-subtle">
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
      </div>
    </Link>
  );
}
