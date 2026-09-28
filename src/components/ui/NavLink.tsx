"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { activeHref, isPathActive } from "./helpers";

export type NavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  siblings?: readonly string[];
  exact?: boolean;
};

export function NavLink({ href, siblings, exact = false, ...rest }: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const base = href.split(/[?#]/)[0];
  const active = exact
    ? pathname === base
    : siblings && siblings.length > 0
      ? activeHref(pathname, siblings) === href
      : isPathActive(pathname, href);

  return <Link href={href} aria-current={active ? "page" : undefined} data-active={active || undefined} {...rest} />;
}
