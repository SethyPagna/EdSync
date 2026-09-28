"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
  THEMES,
  themeMode,
  useAppearance,
  type Appearance,
  type Density,
  type ThemeId,
  type ThemePreference,
} from "@/lib/ui/theme";

export type AppearancePickerProps = {
  onChange?: (appearance: Appearance) => void;
  className?: string;
};

const DENSITIES: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const NEXT_KEYS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function moveInRadioGroup(event: KeyboardEvent<HTMLElement>, index: number, count: number, select: (index: number) => void) {
  let next: number;
  if (event.key in NEXT_KEYS) next = (index + NEXT_KEYS[event.key] + count) % count;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = count - 1;
  else return;
  event.preventDefault();
  select(next);
  const radios = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[next]?.focus();
}

export function AppearancePicker({ onChange, className }: AppearancePickerProps) {
  const appearance = useAppearance();
  const { theme, resolvedTheme, systemTheme, accent, density } = appearance;
  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const themeLabel = useId();
  const accentLabel = useId();
  const densityLabel = useId();

  const shownTheme = previewTheme ?? resolvedTheme;
  const themeOptions: ThemePreference[] = ["system", ...THEMES.map((option) => option.id)];

  const update = (patch: Partial<Appearance>) => {
    appearance.setAppearance(patch);
    onChange?.({ theme, accent, density, ...patch });
  };

  const selectTheme = (index: number) => update({ theme: themeOptions[index] });
  const selectAccent = (index: number) => update({ accent: ACCENTS[index].id });
  const selectDensity = (index: number) => update({ density: DENSITIES[index].value });
  const previewOn = (id: ThemeId) => () => setPreviewTheme(id);
  const previewOff = () => setPreviewTheme(null);

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <div
        aria-hidden
        data-theme={shownTheme}
        data-accent={accent}
        className={cn("rounded-lg border border-line bg-bg p-2", themeMode(shownTheme) === "dark" && "dark")}
      >
        <div className="flex gap-2">
          <div className="flex w-7 flex-col items-center gap-1.5 rounded-md border border-line bg-surface py-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-2 w-2 rounded-full bg-fg-faint" />
            <span className="h-2 w-2 rounded-full bg-fg-faint" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-line bg-surface p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-fg">
                {THEMES.find((option) => option.id === shownTheme)?.name}
              </span>
              <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-medium text-accent">Aa</span>
            </div>
            <span className="h-1.5 w-3/4 rounded-full bg-surface-2" />
            <div className="flex gap-1.5">
              <span className="h-4 w-10 rounded-sm bg-accent" />
              <span className="h-4 w-10 rounded-sm border border-line bg-surface-2" />
            </div>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <span id={themeLabel} className="label-micro">
          Theme
        </span>
        <div role="radiogroup" aria-labelledby={themeLabel} className="flex flex-col gap-2" onMouseLeave={previewOff}>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "system"}
            tabIndex={theme === "system" ? 0 : -1}
            onClick={() => selectTheme(0)}
            onKeyDown={(event) => moveInRadioGroup(event, 0, themeOptions.length, selectTheme)}
            onMouseEnter={previewOn(systemTheme)}
            onFocus={previewOn(systemTheme)}
            onBlur={previewOff}
            className="flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-accent"
          >
            <Monitor aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="font-medium">System</span>
            <span className="ml-auto text-xs text-fg-faint">{THEMES.find((option) => option.id === systemTheme)?.name}</span>
          </button>
          <div className="grid grid-cols-4 gap-1">
            {THEMES.map((option, offset) => {
              const index = offset + 1;
              const checked = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => selectTheme(index)}
                  onKeyDown={(event) => moveInRadioGroup(event, index, themeOptions.length, selectTheme)}
                  onMouseEnter={previewOn(option.id)}
                  onFocus={previewOn(option.id)}
                  onBlur={previewOff}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg aria-checked:text-fg"
                >
                  <span
                    className={cn(
                      "flex rounded-full border p-0.5 transition-colors",
                      checked ? "border-accent ring-1 ring-accent" : "border-line",
                    )}
                  >
                    <span
                      data-theme={option.id}
                      data-accent={accent}
                      className="block h-7 w-7 rounded-full"
                      style={{ background: "linear-gradient(135deg, var(--bg) 50%, var(--accent) 50%)" }}
                    />
                  </span>
                  <span className="max-w-full truncate">{option.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span id={accentLabel} className="label-micro">
          Accent
        </span>
        <div role="radiogroup" aria-labelledby={accentLabel} className="flex flex-wrap items-center gap-1">
          {ACCENTS.map((option, index) => {
            const checked = accent === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={option.name}
                data-tooltip={option.name}
                tabIndex={checked ? 0 : -1}
                onClick={() => selectAccent(index)}
                onKeyDown={(event) => moveInRadioGroup(event, index, ACCENTS.length, selectAccent)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                  checked ? "border-accent ring-1 ring-accent" : "border-transparent hover:border-line",
                )}
              >
                <span data-theme={resolvedTheme} data-accent={option.id} className="block h-5 w-5 rounded-full bg-accent" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span id={densityLabel} className="label-micro">
          Density
        </span>
        <div role="radiogroup" aria-labelledby={densityLabel} className="segmented flex w-full">
          {DENSITIES.map((option, index) => {
            const checked = density === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                data-active={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => selectDensity(index)}
                onKeyDown={(event) => moveInRadioGroup(event, index, DENSITIES.length, selectDensity)}
                className="segmented-item h-7 flex-1 px-3 text-[13px]"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default AppearancePicker;
