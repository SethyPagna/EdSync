import { Ellipsis, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type MetricTileProps = {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: string;
  detail?: string;
};

export function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "text-edsync-blue",
  detail,
}: MetricTileProps) {
  return (
    <div className="premium-card group min-w-0 rounded-2xl p-4 transition hover:-translate-y-0.5 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-edsync-subtle">{label}</p>
          <p className="mt-3 break-words font-display text-3xl font-bold leading-none text-edsync-text sm:text-4xl">
            {value}
          </p>
        </div>
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-current/10 shadow-sm transition group-hover:scale-105 ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {detail && <p className="mt-3 text-sm leading-5 text-edsync-subtle">{detail}</p>}
    </div>
  );
}

type GuidePanelProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  items?: string[];
  tone?: string;
};

export function GuidePanel({
  title,
  description,
  icon: Icon,
  items = [],
  tone = "text-edsync-blue",
}: GuidePanelProps) {
  return (
    <aside className="min-w-0 rounded-lg border border-edsync-border bg-edsync-surface p-4 sm:p-5">
      <div className="flex gap-3">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-current/10 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-edsync-text">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-edsync-subtle">{description}</p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <p key={item} className="rounded-lg border border-edsync-border bg-edsync-card px-3 py-2 text-sm text-edsync-subtle">
              <span className="break-words">{item}</span>
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}

type ActionMenuProps = {
  label?: string;
  children: React.ReactNode;
};

export function ActionMenu({ label = "Actions", children }: ActionMenuProps) {
  return (
    <details className="group relative inline-block text-left">
      <summary
        className="premium-icon-button list-none marker:hidden [&::-webkit-details-marker]:hidden"
        aria-label={label}
        title={label}
      >
        <Ellipsis className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="premium-overlay animate-overlay-in absolute right-0 z-30 mt-2 grid max-h-[min(70vh,28rem)] w-[min(18rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-2xl p-2">
        {children}
      </div>
    </details>
  );
}

type InfoPopoverProps = {
  label: string;
  children: React.ReactNode;
};

export function InfoPopover({ label, children }: InfoPopoverProps) {
  return (
    <details className="group relative inline-block">
      <summary
        className="premium-icon-button list-none marker:hidden [&::-webkit-details-marker]:hidden"
        aria-label={label}
        title={label}
      >
        <Info className="h-4 w-4" />
      </summary>
      <div className="premium-overlay animate-overlay-in absolute right-0 z-40 mt-2 max-h-[min(70vh,24rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-3 text-sm leading-5 text-edsync-subtle">
        {children}
      </div>
    </details>
  );
}
