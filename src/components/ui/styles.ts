export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export const ICON_SIZE = 16;
export const ICON_STROKE = 1.75;

export const toneSoftClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export const toneFillClass: Record<Tone, string> = {
  neutral: "bg-fg-muted",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export const tabListClass =
  "flex min-w-0 items-center gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]";

export const tabItemClass =
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-[13px] font-medium text-fg-muted transition-colors duration-150 hover:text-fg aria-selected:border-fg aria-selected:text-fg aria-[current=page]:border-fg aria-[current=page]:text-fg";
