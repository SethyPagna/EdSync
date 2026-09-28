import Link from "next/link";
import { useId, type HTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE, toneSoftClass, type Tone } from "./styles";

export type CardPadding = "none" | "sm" | "md";

const PADDING: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
};

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li" | "aside" | "button";
  href?: string;
  interactive?: boolean;
  padding?: CardPadding;
};

export function Card({ as = "div", href, interactive = false, padding = "md", className, ...rest }: CardProps) {
  const classes = cn("card min-w-0", (interactive || href || as === "button") && "card-hover", PADDING[padding], className);

  if (href) return <Link href={href} className={cn("block", classes)} {...rest} />;
  if (as === "button") return <button type="button" className={cn("block w-full text-left", classes)} {...rest} />;
  const Tag = as;
  return <Tag className={classes} {...rest} />;
}

export type CardHeaderProps = {
  title: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  meta?: ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
};

export function CardHeader({ title, icon: Icon, action, meta, as: Heading = "h3", className }: CardHeaderProps) {
  return (
    <div className={cn("mb-3 flex min-h-7 min-w-0 items-center gap-2", className)}>
      {Icon ? <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-fg-muted" /> : null}
      <Heading className="min-w-0 truncate text-sm font-semibold text-fg">{title}</Heading>
      {meta ? <span className="shrink-0 text-xs text-fg-muted tabular-nums">{meta}</span> : null}
      {action ? <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

export type SectionProps = {
  title: ReactNode;
  action?: ReactNode;
  count?: number;
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ title, action, count, id, className, children }: SectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-8 items-center gap-2">
        <h2 id={headingId} className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {count !== undefined ? <span className="text-[13px] text-fg-faint tabular-nums">{count}</span> : null}
        {action ? <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type StatTileProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
};

export function StatTile({ label, value, icon: Icon, hint, tone = "neutral", href, className }: StatTileProps) {
  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-sm", toneSoftClass[tone])}>
            <Icon aria-hidden size={14} strokeWidth={ICON_STROKE} />
          </span>
        ) : null}
        <span className="min-w-0 truncate text-xs font-medium text-fg-muted">{label}</span>
      </div>
      <div className="truncate text-2xl font-semibold leading-none tracking-tight text-fg tabular-nums">{value}</div>
      {hint ? <div className="truncate text-xs text-fg-faint">{hint}</div> : null}
    </>
  );
  const classes = cn("card flex min-w-0 flex-col gap-2.5 p-3.5", className);

  if (href) {
    return (
      <Link href={href} className={cn(classes, "card-hover")}>
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}
