"use client";

import { useCallback, useRef, type ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "./Display";
import { formatHotkey } from "./helpers";
import { useHotkey, useIsMac } from "./hooks";
import { assignRef } from "./refs";
import { ICON_STROKE } from "./styles";

export type SearchInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  shortcut?: string;
  label?: string;
  inputClassName?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  shortcut,
  label,
  className,
  inputClassName,
  onKeyDown,
  ref,
  ...rest
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMac = useIsMac();
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  useHotkey(
    shortcut ?? "",
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    { enabled: Boolean(shortcut) },
  );

  return (
    <div className={cn("relative flex min-w-0 flex-1 items-center sm:max-w-xs", className)}>
      <Search
        aria-hidden
        size={16}
        strokeWidth={ICON_STROKE}
        className="pointer-events-none absolute left-2.5 text-fg-faint"
      />
      <input
        ref={setRefs}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label ?? (rest.id || rest["aria-labelledby"] ? undefined : placeholder)}
        data-autofocus={rest.autoFocus ? "" : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Escape" || !value) return;
          event.preventDefault();
          onChange("");
        }}
        className={cn("input w-full pl-8 pr-8 [&::-webkit-search-cancel-button]:appearance-none", inputClassName)}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-sm text-fg-faint transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X aria-hidden size={14} strokeWidth={ICON_STROKE} />
        </button>
      ) : shortcut ? (
        <Kbd className="pointer-events-none absolute right-2 hidden sm:inline-flex">{formatHotkey(shortcut, isMac)}</Kbd>
      ) : null}
    </div>
  );
}
