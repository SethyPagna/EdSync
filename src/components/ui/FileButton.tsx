"use client";

import { useRef, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Button, IconButton, type ButtonProps } from "./Button";

export type FileButtonProps = Omit<ButtonProps, "onClick" | "onChange" | "type"> & {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
};

export function FileButton({
  onFiles,
  accept,
  multiple = false,
  label,
  icon = Upload,
  iconRight,
  loading,
  variant,
  size,
  disabled,
  children,
  ...rest
}: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.click();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) onFiles(files);
  };

  return (
    <>
      {label && children === undefined ? (
        <IconButton
          aria-busy={loading || undefined}
          {...rest}
          icon={icon}
          label={label}
          variant={variant === "primary" || variant === "secondary" ? variant : "ghost"}
          size={size === "sm" ? "sm" : "md"}
          disabled={disabled || loading}
          onClick={openPicker}
        />
      ) : (
        <Button
          {...rest}
          icon={icon}
          iconRight={iconRight}
          loading={loading}
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={openPicker}
        >
          {children ?? label ?? "Upload"}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        disabled={disabled}
        onChange={handleChange}
      />
    </>
  );
}
