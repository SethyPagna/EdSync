import { ChevronDown, Ellipsis, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type MetricTileProps = {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: string;
  detail?: string;
  compact?: boolean;
};

export function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "text-edsync-blue",
  detail,
  compact = false,
}: MetricTileProps) {
  return (
    <div
      className={`premium-card group min-w-0 transition hover:-translate-y-0.5 ${
        compact ? "rounded-xl p-2.5 sm:p-3" : "rounded-2xl p-4 sm:p-5"
      }`}
      title={detail}
    >
      <div
        className={`flex items-start justify-between ${compact ? "gap-2" : "gap-4"}`}
      >
        <div className="min-w-0">
          <p
            className={`${compact ? "text-[11px]" : "text-sm"} truncate font-semibold text-edsync-subtle`}
          >
            {label}
          </p>
          <p
            className={`break-words font-display font-bold leading-none text-edsync-text ${
              compact ? "mt-1 text-xl sm:text-2xl" : "mt-3 text-3xl sm:text-4xl"
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex flex-shrink-0 items-center justify-center bg-current/10 shadow-sm transition group-hover:scale-105 ${
            compact ? "h-8 w-8 rounded-lg" : "h-12 w-12 rounded-2xl"
          } ${tone}`}
        >
          <Icon className={compact ? "h-4 w-4" : "h-6 w-6"} />
        </div>
      </div>
      {detail && <p className="edsync-hover-detail">{detail}</p>}
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
    <details className="compact-guide">
      <summary>
        <Icon className={tone} size={18} />
        <span>{title}</span>
        <ChevronDown size={16} />
      </summary>
      <p className="mt-3 text-sm leading-6 text-edsync-subtle">{description}</p>
      {items.length > 0 && (
        <ul className="mt-3 grid gap-2 text-sm text-edsync-subtle">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </details>
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
      <div className="premium-overlay action-menu-panel animate-overlay-in absolute right-0 z-30 mt-2 grid max-h-[min(70vh,28rem)] w-[min(18rem,calc(100vw-2rem))] gap-1 overflow-y-auto rounded-2xl p-2">
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
