"use client";

import Link from "next/link";
import { Fragment, isValidElement, useRef, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton, buttonClass } from "./Button";
import { formatHotkey } from "./helpers";
import { useIsMac } from "./hooks";
import { usePortalContainer } from "./portal";
import { ICON_STROKE } from "./styles";

export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  separator?: false;
};

export type MenuSeparator = { separator: true; label?: string };

export type MenuItem = MenuAction | MenuSeparator;

export type MenuProps = {
  items: ReadonlyArray<MenuItem | false | null | undefined>;
  trigger?: ReactNode;
  label?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  header?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const ITEM_CLASS =
  "menu-item flex w-full cursor-default select-none items-center gap-2.5 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** Drops falsy entries plus leading, trailing and doubled separators (a labeled one wins). */
function tidyItems(items: MenuProps["items"]): MenuItem[] {
  const result: MenuItem[] = [];
  for (const item of items) {
    if (!item) continue;
    const last = result.at(-1);
    if (item.separator) {
      if (!last) {
        if (item.label) result.push(item);
      } else if (last.separator) {
        if (item.label) result[result.length - 1] = item;
      } else {
        result.push(item);
      }
      continue;
    }
    result.push(item);
  }
  while (result.at(-1)?.separator) result.pop();
  return result;
}

function renderTrigger(trigger: ReactNode, label: string) {
  if (isValidElement(trigger)) return trigger;
  if (trigger === undefined || trigger === null || typeof trigger === "boolean") {
    return <IconButton icon={Ellipsis} label={label} />;
  }
  return (
    <button type="button" className={buttonClass("ghost")}>
      {trigger}
    </button>
  );
}

function MenuActionContent({ item, isMac }: { item: MenuAction; isMac: boolean }) {
  const Icon = item.icon;
  return (
    <>
      {Icon ? (
        <Icon
          aria-hidden
          size={16}
          strokeWidth={ICON_STROKE}
          className={cn("shrink-0", item.danger ? "text-danger" : "text-fg-muted")}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.shortcut ? (
        <span className="ml-4 shrink-0 text-xs text-fg-faint">{formatHotkey(item.shortcut, isMac)}</span>
      ) : null}
    </>
  );
}

export function Menu({
  items,
  trigger,
  label = "More",
  align = "end",
  side = "bottom",
  header,
  open,
  onOpenChange,
  className,
}: MenuProps) {
  const container = usePortalContainer();
  const isMac = useIsMac();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visibleItems = tidyItems(items);
  // Focus the trigger before the item runs: a Dialog it opens records the active element and restores it on close.
  const select = (item: MenuAction) => {
    triggerRef.current?.focus({ preventScroll: true });
    item.onSelect?.();
  };

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild ref={triggerRef}>
        {renderTrigger(trigger, label)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container ?? undefined}>
        <DropdownMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          loop
          className={cn("menu z-50 min-w-44 max-w-[min(20rem,calc(100vw-16px))]", className)}
        >
          {header}
          {visibleItems.map((item, index) => {
            if (item.separator) {
              return (
                <Fragment key={`separator-${index}`}>
                  {index > 0 ? <DropdownMenu.Separator className="menu-separator" /> : null}
                  {item.label ? (
                    <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-xs font-medium text-fg-faint">
                      {item.label}
                    </DropdownMenu.Label>
                  ) : null}
                </Fragment>
              );
            }
            const itemClass = cn(
              ITEM_CLASS,
              item.danger ? "text-danger data-[highlighted]:bg-danger-soft" : "data-[highlighted]:bg-surface-2",
            );
            const key = `${index}-${item.label}`;
            if (item.href && !item.disabled) {
              return (
                <DropdownMenu.Item key={key} asChild className={itemClass} onSelect={() => select(item)}>
                  <Link href={item.href}>
                    <MenuActionContent item={item} isMac={isMac} />
                  </Link>
                </DropdownMenu.Item>
              );
            }
            return (
              <DropdownMenu.Item
                key={key}
                disabled={item.disabled}
                className={itemClass}
                onSelect={() => select(item)}
              >
                <MenuActionContent item={item} isMac={isMac} />
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
