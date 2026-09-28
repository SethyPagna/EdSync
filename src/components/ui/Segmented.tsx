"use client";

import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { rovingIndex } from "./helpers";
import { ICON_STROKE, tabItemClass, tabListClass } from "./styles";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  hideLabel?: boolean;
  disabled?: boolean;
};

export type SegmentedProps<T extends string | number> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
};

function focusSibling(event: KeyboardEvent<HTMLElement>, role: string, index: number) {
  const items = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(`[role="${role}"]`);
  items?.[index]?.focus();
}

function nextEnabled(items: readonly { disabled?: boolean }[], key: string, from: number) {
  const count = items.length;
  const first = rovingIndex(key, from, count);
  if (first === null) return null;
  const step = key === "Home" || key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  for (let offset = 0; offset < count; offset += 1) {
    const index = (((first + step * offset) % count) + count) % count;
    if (!items[index].disabled) return index;
  }
  return null;
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedProps<T>) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextEnabled(options, event.key, index);
    if (next === null) return;
    event.preventDefault();
    focusSibling(event, "radio", next);
    if (options[next].value !== value) onChange(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "segmented",
        fullWidth ? "flex w-full" : "inline-flex",
        options.some((option) => option.hideLabel) && "overflow-visible",
        className,
      )}
    >
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = index === selectedIndex;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.hideLabel ? option.label : undefined}
            data-tooltip={option.hideLabel ? option.label : undefined}
            data-active={selected}
            disabled={option.disabled}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "segmented-item inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-3 text-[13px]",
              option.hideLabel && (size === "sm" ? "w-6 px-0" : "w-7 px-0"),
              fullWidth && "flex-1",
            )}
          >
            {Icon ? <Icon aria-hidden size={size === "sm" ? 14 : 16} strokeWidth={ICON_STROKE} className="shrink-0" /> : null}
            {option.hideLabel ? null : <span>{option.label}</span>}
            {option.count !== undefined ? (
              <span className="text-fg-faint tabular-nums">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type TabItem<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
};

export type TabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  items: readonly TabItem<T>[];
  ariaLabel: string;
  idPrefix?: string;
  className?: string;
};

export function Tabs<T extends string>({ value, onChange, items, ariaLabel, idPrefix, className }: TabsProps<T>) {
  const selectedIndex = items.findIndex((item) => item.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : items.findIndex((item) => !item.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextEnabled(items, event.key, index);
    if (next === null) return;
    event.preventDefault();
    focusSibling(event, "tab", next);
    if (items[next].value !== value) onChange(items[next].value);
  };

  return (
    <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={cn(tabListClass, className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const selected = index === selectedIndex;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${item.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.value}` : undefined}
            aria-selected={selected}
            disabled={item.disabled}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => {
              if (!selected) onChange(item.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabItemClass}
          >
            {Icon ? <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0" /> : null}
            {item.label}
            {item.count !== undefined ? (
              <span className="text-xs font-normal text-fg-faint tabular-nums">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
