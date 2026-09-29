import Link from "next/link";
import { ArrowRight, Atom, BookOpenCheck, Building2, Clock3, PenLine, Sigma } from "lucide-react";
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

function courseVisual(item: PublicCatalogItem) {
  const subject = `${item.metadata.category} ${item.lesson.subject ?? ""}`.toLowerCase();
  if (/science|biology|chemistry|physics/.test(subject)) {
    return { Icon: Atom, background: "from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950", foreground: "text-emerald-800 dark:text-emerald-200" };
  }
  if (/math|algebra|geometry/.test(subject)) {
    return { Icon: Sigma, background: "from-indigo-100 via-blue-50 to-sky-100 dark:from-indigo-950 dark:via-blue-950 dark:to-sky-950", foreground: "text-indigo-800 dark:text-indigo-200" };
  }
  if (/english|writing|literature/.test(subject)) {
    return { Icon: PenLine, background: "from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950 dark:via-orange-950 dark:to-rose-950", foreground: "text-amber-900 dark:text-amber-200" };
  }
  return { Icon: BookOpenCheck, background: "from-edsync-blue/20 via-edsync-surface to-edsync-emerald/20", foreground: "text-edsync-blue" };
}

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
  const visual = courseVisual(item);
  const VisualIcon = visual.Icon;

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
            role="img"
            className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
            style={{ backgroundImage: `url(${item.metadata.thumbnailUrl})` }}
            aria-label={`${item.title} thumbnail`}
          />
        ) : (
          <div
            role="img"
            aria-label={`${item.metadata.category || item.lesson.subject || "Course"} illustration for ${item.title}`}
            className={`relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br ${visual.background}`}
          >
            <span aria-hidden="true" className="absolute -left-10 -top-14 size-44 rounded-full border-[24px] border-white/30 dark:border-white/5" />
            <span className={`relative flex size-20 items-center justify-center rounded-[1.5rem] border border-white/60 bg-white/40 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/10 ${visual.foreground}`}>
              <VisualIcon className="size-10" strokeWidth={1.7} aria-hidden="true" />
            </span>
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
