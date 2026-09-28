import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "./NavLink";
import { ICON_STROKE, tabItemClass, tabListClass } from "./styles";

export type SubNavItem = { href: string; label: string; icon?: LucideIcon };

export type SubNavProps = {
  items: readonly SubNavItem[];
  ariaLabel?: string;
  className?: string;
};

export function SubNav({ items, ariaLabel = "Sections", className }: SubNavProps) {
  const hrefs = items.map((item) => item.href);
  return (
    <nav aria-label={ariaLabel} className={cn(tabListClass, className)}>
      {items.map(({ href, label, icon: Icon }) => (
        <NavLink key={href} href={href} siblings={hrefs} className={tabItemClass}>
          {Icon ? <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0" /> : null}
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
