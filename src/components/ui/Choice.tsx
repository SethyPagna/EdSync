"use client";

import { useCallback, useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { joinIds } from "./helpers";
import { assignRef } from "./refs";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  hideLabel?: boolean;
  labelPosition?: "start" | "end";
  size?: "sm" | "md";
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export function Switch({
  checked,
  onChange,
  label,
  description,
  hideLabel = false,
  labelPosition = "end",
  size = "md",
  disabled = false,
  id,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const labelId = `${switchId}-label`;
  const descriptionId = description ? `${switchId}-description` : undefined;
  const small = size === "sm";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3",
        labelPosition === "start" && "flex-row-reverse justify-between",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={joinIds(descriptionId, describedBy)}
        aria-invalid={invalid}
        disabled={disabled}
        data-state={checked ? "on" : "off"}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed",
          small ? "h-4 w-7" : "h-5 w-9",
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none block rounded-full shadow-sm transition-transform duration-150 motion-reduce:transition-none",
            small ? "h-3 w-3" : "h-3.5 w-3.5",
            checked ? cn("bg-on-accent", small ? "translate-x-3" : "translate-x-[18px]") : "translate-x-0.5 bg-fg-muted",
          )}
        />
      </button>
      <span className={cn("min-w-0", hideLabel && "sr-only")}>
        <label id={labelId} htmlFor={switchId} className="block select-none text-[13px] text-fg">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="block text-xs text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export type CheckboxProps = Omit<ComponentProps<"input">, "type" | "onChange"> & {
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
};

export function Checkbox({
  onChange,
  label,
  description,
  indeterminate = false,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const input = (
    <input
      ref={setRefs}
      id={inputId}
      type="checkbox"
      aria-describedby={joinIds(descriptionId, describedBy)}
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-accent disabled:cursor-not-allowed",
        label ? "mt-0.5" : undefined,
        label ? undefined : className,
      )}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
      {...rest}
    />
  );

  if (!label) return input;

  return (
    <div className={cn("flex items-start gap-2.5", rest.disabled && "opacity-50", className)}>
      {input}
      <span className="min-w-0">
        <label htmlFor={inputId} className="block select-none text-[13px] text-fg">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="block text-xs text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}
