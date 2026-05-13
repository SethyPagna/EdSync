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
    <div className="rounded-lg border border-edsync-border bg-edsync-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-edsync-subtle">{label}</p>
          <p className="mt-3 font-display text-3xl font-bold leading-none text-edsync-text sm:text-4xl">
            {value}
          </p>
        </div>
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-current/10 ${tone}`}>
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
    <aside className="rounded-lg border border-edsync-border bg-edsync-surface p-4 sm:p-5">
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
              {item}
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
      <summary className="btn-secondary list-none justify-center px-3 py-2 text-sm marker:hidden">
        {label}
      </summary>
      <div className="absolute right-0 z-30 mt-2 grid min-w-48 gap-1 rounded-lg border border-edsync-border bg-edsync-surface p-2 shadow-2xl shadow-slate-200/60 dark:shadow-black/30">
        {children}
      </div>
    </details>
  );
}

