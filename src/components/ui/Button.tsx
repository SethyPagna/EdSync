import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, MouseEventHandler, ReactNode, Ref } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "./styles";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn("btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className);
}

type ButtonContentProps = {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  size: ButtonSize;
  children?: ReactNode;
};

function ButtonContent({ icon: Icon, iconRight: IconRight, loading, size, children }: ButtonContentProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <>
      {loading ? (
        <LoaderCircle aria-hidden size={iconSize} strokeWidth={ICON_STROKE} className="shrink-0 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden size={iconSize} strokeWidth={ICON_STROKE} className="shrink-0" />
      ) : null}
      {children}
      {IconRight ? <IconRight aria-hidden size={iconSize} strokeWidth={ICON_STROKE} className="shrink-0" /> : null}
    </>
  );
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      <ButtonContent icon={icon} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </ButtonContent>
    </button>
  );
}

export type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
};

export function LinkButton({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      <ButtonContent icon={icon} iconRight={iconRight} size={size}>
        {children}
      </ButtonContent>
    </Link>
  );
}

export type IconButtonVariant = "ghost" | "secondary" | "primary";
export type TooltipSide = "top" | "bottom" | "left" | "right";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLElement>, "children" | "onClick" | "type" | "disabled"> & {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
  active?: boolean;
  badge?: number | boolean;
  href?: string;
  tooltipSide?: TooltipSide;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  ref?: Ref<HTMLButtonElement>;
};

const ICON_BUTTON_VARIANT: Record<IconButtonVariant, string> = {
  ghost: "icon-btn",
  secondary: "btn btn-secondary btn-icon",
  primary: "btn btn-primary btn-icon",
};

function IconBadge({ badge }: { badge: number | boolean }) {
  if (badge === true) {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-bg"
      />
    );
  }
  if (typeof badge !== "number" || badge <= 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent tabular-nums ring-2 ring-bg"
    >
      {badge > 99 ? "99+" : badge}
    </span>
  );
}

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  active,
  badge,
  href,
  tooltipSide,
  type = "button",
  disabled,
  className,
  ref,
  ...rest
}: IconButtonProps) {
  const accessibleName = typeof badge === "number" && badge > 0 ? `${label} (${badge})` : label;
  const classes = cn(
    ICON_BUTTON_VARIANT[variant],
    "relative min-h-0 shrink-0 p-0",
    size === "sm" ? "h-7 w-7" : "h-8 w-8",
    active && variant === "ghost" && "bg-accent-soft text-accent hover:bg-accent-soft",
    className,
  );
  const content = (
    <>
      <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} />
      {badge !== undefined ? <IconBadge badge={badge} /> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        aria-label={accessibleName}
        aria-current={active ? "page" : undefined}
        data-active={active || undefined}
        data-tooltip={label}
        data-tooltip-side={tooltipSide}
        className={classes}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={accessibleName}
      aria-pressed={active}
      data-active={active || undefined}
      data-tooltip={label}
      data-tooltip-side={tooltipSide}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
}
