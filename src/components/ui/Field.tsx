import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { joinIds } from "./helpers";

export type FieldControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export type FieldA11y = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

export type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  hideLabel?: boolean;
  labelAction?: ReactNode;
  id?: string;
  className?: string;
  children: ReactElement<FieldControlProps> | ((id: string, a11y: FieldA11y) => ReactNode);
};

export function Field({
  label,
  hint,
  error,
  required = false,
  hideLabel = false,
  labelAction,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const element = typeof children !== "function" && isValidElement<FieldControlProps>(children) ? children : null;
  const controlId = id ?? element?.props.id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = joinIds(hintId, errorId);
  const invalid = Boolean(error);

  let control: ReactNode;
  if (typeof children === "function") {
    control = children(controlId, { id: controlId, describedBy, invalid });
  } else if (element) {
    control = cloneElement(element, {
      id: controlId,
      required: element.props.required ?? (required || undefined),
      "aria-describedby": joinIds(element.props["aria-describedby"], describedBy),
      "aria-invalid": invalid ? true : element.props["aria-invalid"],
    });
  } else {
    control = children;
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className={cn("flex min-h-5 items-center justify-between gap-2", hideLabel && !labelAction && "sr-only")}>
        <label htmlFor={controlId} className={cn("text-[13px] font-medium text-fg", hideLabel && "sr-only")}>
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          ) : null}
        </label>
        {labelAction}
      </div>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} aria-live="polite" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextInputProps = ComponentProps<"input"> & { invalid?: boolean };

export function TextInput({ type = "text", invalid, className, ...rest }: TextInputProps) {
  return (
    <input
      type={type}
      className={cn("input w-full", className)}
      data-autofocus={rest.autoFocus ? "" : undefined}
      {...rest}
      aria-invalid={invalid ? true : rest["aria-invalid"]}
    />
  );
}

export type TextAreaProps = ComponentProps<"textarea"> & { invalid?: boolean };

export function TextArea({ rows = 3, invalid, className, ...rest }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={cn("textarea w-full", className)}
      data-autofocus={rest.autoFocus ? "" : undefined}
      {...rest}
      aria-invalid={invalid ? true : rest["aria-invalid"]}
    />
  );
}

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = ComponentProps<"select"> & {
  options?: readonly SelectOption[];
  placeholder?: string;
  invalid?: boolean;
};

export function Select({ options, placeholder, invalid, className, children, ...rest }: SelectProps) {
  const showPlaceholder =
    placeholder !== undefined && rest.value === undefined && rest.defaultValue === undefined && !rest.multiple;
  return (
    <select
      className={cn("select w-full", className)}
      data-autofocus={rest.autoFocus ? "" : undefined}
      {...rest}
      defaultValue={showPlaceholder ? "" : rest.defaultValue}
      aria-invalid={invalid ? true : rest["aria-invalid"]}
    >
      {placeholder !== undefined ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}
