import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, generateInitials } from "@/lib/utils";
import { ICON_STROKE, toneFillClass, toneSoftClass, type Tone } from "./styles";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  accent: "badge-accent",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
};

export function Badge({ tone = "neutral", dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn("badge", BADGE_TONE[tone], className)} {...rest}>
      {dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function Kbd({ className, children }: { className?: string; children: ReactNode }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

export type ProgressBarProps = {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

export function ProgressBar({ value, max = 100, tone = "accent", label, size = "sm", className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(clamped)}
      className={cn("w-full overflow-hidden rounded-full bg-surface-2", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", toneFillClass[tone])}
        style={{ width: `${(clamped / safeMax) * 100}%` }}
      />
    </div>
  );
}

const AVATAR_TINTS: Tone[] = ["accent", "success", "warning", "info", "neutral"];

const AVATAR_SIZE: Record<AvatarSize, string> = {
  24: "h-6 w-6 text-[10px]",
  28: "h-7 w-7 text-[11px]",
  32: "h-8 w-8 text-xs",
  40: "h-10 w-10 text-sm",
};

export type AvatarSize = 24 | 28 | 32 | 40;

function tintFor(name: string): Tone {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  decorative?: boolean;
  className?: string;
};

export function Avatar({ name, src, size = 32, decorative = false, className }: AvatarProps) {
  const label = name.trim() || "User";
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium",
        toneSoftClass[tintFor(label)],
        AVATAR_SIZE[size],
        className,
      )}
    >
      <span aria-hidden>{generateInitials(label)}</span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({ icon: Icon, title, hint, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-muted">
        <Icon aria-hidden size={18} strokeWidth={ICON_STROKE} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {hint ? <p className="text-[13px] text-fg-muted">{hint}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
