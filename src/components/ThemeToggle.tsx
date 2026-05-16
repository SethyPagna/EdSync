"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemePreference = "light" | "dark";

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
  onThemeChange?: (theme: ThemePreference) => void;
};

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("edsync-theme", theme);
  window.dispatchEvent(new CustomEvent("edsync-theme-change", { detail: { theme } }));
}

export default function ThemeToggle({
  compact = false,
  className = "",
  onThemeChange,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemePreference>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("edsync-theme");
    const publicLaunchDefault = Boolean(document.querySelector(".edsync-public-launch"));
    const nextTheme: ThemePreference = stored === "dark" || (!stored && publicLaunchDefault) ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.dataset.theme = nextTheme;

    const handleThemeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: ThemePreference }>).detail;
      if (detail?.theme === "dark" || detail?.theme === "light") {
        setTheme(detail.theme);
      }
    };

    window.addEventListener("edsync-theme-change", handleThemeEvent);
    return () => window.removeEventListener("edsync-theme-change", handleThemeEvent);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    onThemeChange?.(nextTheme);
  };

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Light theme" : "Dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${compact ? "premium-icon-button" : "btn-secondary px-4 py-2 text-sm"} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </button>
  );
}
