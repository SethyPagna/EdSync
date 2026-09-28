// Namespace import keeps this module importable from Server Components (layout.tsx reads the boot script).
import * as React from "react";

export type ThemeId = "porcelain" | "sand" | "sage" | "paper" | "graphite" | "midnight" | "ocean" | "rosewood";
export type ThemePreference = ThemeId | "system";
export type ThemeMode = "light" | "dark";
export type AccentId = "theme" | "indigo" | "teal" | "violet" | "rose" | "amber" | "ink";
export type Density = "comfortable" | "compact";
export type Appearance = { theme: ThemePreference; accent: AccentId; density: Density };

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  swatch: { bg: string; surface: string; accent: string };
};

export type AccentDefinition = { id: AccentId; name: string; light: string; dark: string };

export const THEMES: readonly ThemeDefinition[] = [
  { id: "porcelain", name: "Porcelain", mode: "light", swatch: { bg: "#f6f7f9", surface: "#ffffff", accent: "#3d4ed7" } },
  { id: "sand", name: "Sand", mode: "light", swatch: { bg: "#f7f3ec", surface: "#fffdf9", accent: "#a84b25" } },
  { id: "sage", name: "Sage", mode: "light", swatch: { bg: "#f3f5f1", surface: "#fcfdfb", accent: "#3c6a4d" } },
  { id: "paper", name: "Paper", mode: "light", swatch: { bg: "#fafafa", surface: "#ffffff", accent: "#111111" } },
  { id: "graphite", name: "Graphite", mode: "dark", swatch: { bg: "#1c1d20", surface: "#232428", accent: "#93a5ff" } },
  { id: "midnight", name: "Midnight", mode: "dark", swatch: { bg: "#0b0c0f", surface: "#121317", accent: "#a98dfa" } },
  { id: "ocean", name: "Ocean", mode: "dark", swatch: { bg: "#0b1a22", surface: "#10232d", accent: "#4fd1c5" } },
  { id: "rosewood", name: "Rosewood", mode: "dark", swatch: { bg: "#1d1416", surface: "#251a1d", accent: "#e8aa90" } },
];

export const ACCENTS: readonly AccentDefinition[] = [
  { id: "theme", name: "Theme", light: "#3d4ed7", dark: "#93a5ff" },
  { id: "indigo", name: "Indigo", light: "#4f46e5", dark: "#a5b4fc" },
  { id: "teal", name: "Teal", light: "#0e6b63", dark: "#4fd1c5" },
  { id: "violet", name: "Violet", light: "#6d28d9", dark: "#c4b5fd" },
  { id: "rose", name: "Rose", light: "#be123c", dark: "#fda4af" },
  { id: "amber", name: "Amber", light: "#96500a", dark: "#f5c04a" },
  { id: "ink", name: "Ink", light: "#111418", dark: "#ecedef" },
];

export const THEME_STORAGE_KEY = "edsync-theme";
export const ACCENT_STORAGE_KEY = "edsync-accent";
export const DENSITY_STORAGE_KEY = "edsync-density";
export const SIDEBAR_STORAGE_KEY = "edsync-sidebar";
export const APPEARANCE_EVENT = "edsync-appearance-change";
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", accent: "theme", density: "comfortable" };

const DEFAULT_LIGHT: ThemeId = "porcelain";
const DEFAULT_DARK: ThemeId = "graphite";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const LEGACY_THEMES: Record<string, ThemeId> = { light: DEFAULT_LIGHT, dark: DEFAULT_DARK };
const COUNTERPARTS: Record<ThemeId, ThemeId> = {
  porcelain: "graphite",
  graphite: "porcelain",
  sand: "rosewood",
  rosewood: "sand",
  sage: "ocean",
  ocean: "sage",
  paper: "midnight",
  midnight: "paper",
};

const themeIds = THEMES.map((theme) => theme.id);
const darkThemeIds = THEMES.filter((theme) => theme.mode === "dark").map((theme) => theme.id);
const accentIds = ACCENTS.map((accent) => accent.id);

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (themeIds as string[]).includes(value);
}

export function normalizeThemePreference(value: unknown): ThemePreference | null {
  if (value === "system" || isThemeId(value)) return value;
  if (typeof value === "string" && Object.hasOwn(LEGACY_THEMES, value)) return LEGACY_THEMES[value];
  return null;
}

function normalizeAccent(value: unknown): AccentId | null {
  return typeof value === "string" && (accentIds as string[]).includes(value) ? (value as AccentId) : null;
}

function normalizeDensity(value: unknown): Density | null {
  return value === "comfortable" || value === "compact" ? value : null;
}

export function themeMode(id: ThemeId): ThemeMode {
  return (darkThemeIds as string[]).includes(id) ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeId {
  if (preference === "system") return systemDark ? DEFAULT_DARK : DEFAULT_LIGHT;
  return preference;
}

export function counterpartTheme(id: ThemeId): ThemeId {
  return COUNTERPARTS[id];
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the document still updates.
  }
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function hasStoredTheme(): boolean {
  return typeof window !== "undefined" && normalizeThemePreference(readStorage(THEME_STORAGE_KEY)) !== null;
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  return {
    theme: normalizeThemePreference(readStorage(THEME_STORAGE_KEY)) ?? DEFAULT_APPEARANCE.theme,
    accent: normalizeAccent(readStorage(ACCENT_STORAGE_KEY)) ?? DEFAULT_APPEARANCE.accent,
    density: normalizeDensity(readStorage(DENSITY_STORAGE_KEY)) ?? DEFAULT_APPEARANCE.density,
  };
}

export function applyAppearance(appearance: Appearance, root: HTMLElement = document.documentElement) {
  const resolved = resolveTheme(appearance.theme, prefersDark());
  root.dataset.theme = resolved;
  root.dataset.accent = appearance.accent;
  root.dataset.density = appearance.density;
  root.classList.toggle("dark", themeMode(resolved) === "dark");
}

export function setAppearance(patch: Partial<Appearance>) {
  if (typeof window === "undefined") return;
  const theme = patch.theme === undefined ? undefined : normalizeThemePreference(patch.theme);
  const accent = patch.accent === undefined ? undefined : normalizeAccent(patch.accent);
  const density = patch.density === undefined ? undefined : normalizeDensity(patch.density);
  if (theme) writeStorage(THEME_STORAGE_KEY, theme);
  if (accent) writeStorage(ACCENT_STORAGE_KEY, accent);
  if (density) writeStorage(DENSITY_STORAGE_KEY, density);
  const next = { ...readAppearance(), ...(theme && { theme }), ...(accent && { accent }), ...(density && { density }) };
  applyAppearance(next);
  window.dispatchEvent(new CustomEvent<Appearance>(APPEARANCE_EVENT, { detail: next }));
}

type AppearanceSnapshot = Appearance & { systemDark: boolean };

const SERVER_SNAPSHOT: AppearanceSnapshot = { ...DEFAULT_APPEARANCE, systemDark: false };
let cachedKey = "";
let cachedSnapshot = SERVER_SNAPSHOT;

function getSnapshot(): AppearanceSnapshot {
  const appearance = readAppearance();
  const systemDark = prefersDark();
  const key = `${appearance.theme}|${appearance.accent}|${appearance.density}|${systemDark}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedSnapshot = { ...appearance, systemDark };
  }
  return cachedSnapshot;
}

function getServerSnapshot(): AppearanceSnapshot {
  return SERVER_SNAPSHOT;
}

const STORAGE_KEYS = new Set([THEME_STORAGE_KEY, ACCENT_STORAGE_KEY, DENSITY_STORAGE_KEY]);

function subscribe(onChange: () => void) {
  const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  const syncDocument = () => {
    applyAppearance(readAppearance());
    onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || STORAGE_KEYS.has(event.key)) syncDocument();
  };
  window.addEventListener(APPEARANCE_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  media?.addEventListener("change", syncDocument);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
    media?.removeEventListener("change", syncDocument);
  };
}

export function useAppearance() {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolvedTheme = resolveTheme(snapshot.theme, snapshot.systemDark);
  return {
    theme: snapshot.theme,
    resolvedTheme,
    mode: themeMode(resolvedTheme),
    systemTheme: resolveTheme("system", snapshot.systemDark),
    accent: snapshot.accent,
    density: snapshot.density,
    setAppearance,
  };
}

export const appearanceBootScript = `(function(){var d=document.documentElement;function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var T=${JSON.stringify(themeIds)},K=${JSON.stringify(darkThemeIds)},A=${JSON.stringify(accentIds)},L=${JSON.stringify(LEGACY_THEMES)},m=window.matchMedia?window.matchMedia(${JSON.stringify(DARK_QUERY)}):null;function a(){var t=g(${JSON.stringify(THEME_STORAGE_KEY)});t=L[t]||t;if(T.indexOf(t)<0)t=m&&m.matches?${JSON.stringify(DEFAULT_DARK)}:${JSON.stringify(DEFAULT_LIGHT)};var c=g(${JSON.stringify(ACCENT_STORAGE_KEY)});d.setAttribute("data-theme",t);d.setAttribute("data-accent",A.indexOf(c)<0?"theme":c);d.setAttribute("data-density",g(${JSON.stringify(DENSITY_STORAGE_KEY)})==="compact"?"compact":"comfortable");d.setAttribute("data-sidebar",g(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="expanded"?"expanded":"rail");d.classList.toggle("dark",K.indexOf(t)>=0)}a();if(m&&m.addEventListener)m.addEventListener("change",a);window.addEventListener("storage",a)})();`;
