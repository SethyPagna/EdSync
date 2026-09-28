"use client";

import { Moon, Sun } from "lucide-react";
import { counterpartTheme, useAppearance, type ThemePreference } from "@/lib/ui/theme";

export type { ThemePreference } from "@/lib/ui/theme";

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
  onThemeChange?: (theme: ThemePreference) => void;
};

export default function ThemeToggle({ compact = false, className = "", onThemeChange }: ThemeToggleProps) {
  const { resolvedTheme, mode, setAppearance } = useAppearance();
  const Icon = mode === "dark" ? Sun : Moon;
  const label = mode === "dark" ? "Light theme" : "Dark theme";

  const toggleTheme = () => {
    const nextTheme = counterpartTheme(resolvedTheme);
    setAppearance({ theme: nextTheme });
    onThemeChange?.(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${compact ? "icon-btn" : "btn btn-secondary"} ${className}`}
      aria-label={label}
      data-tooltip={compact ? label : undefined}
    >
      <Icon aria-hidden size={16} strokeWidth={1.75} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
