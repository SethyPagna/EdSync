import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCENTS,
  APPEARANCE_EVENT,
  THEMES,
  appearanceBootScript,
  counterpartTheme,
  hasStoredTheme,
  normalizeThemePreference,
  readAppearance,
  resolveTheme,
  setAppearance,
  themeMode,
  type AccentId,
  type ThemeId,
} from "./theme";

type Rgba = [number, number, number, number];
type Context = { theme: ThemeId; accent: AccentId; density: "comfortable" | "compact" };
type Rule = { selectors: string[]; declarations: [string, string][]; order: number };

const tokensCss = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

const REQUIRED_TOKENS = [
  "bg", "surface", "surface-2", "elevated", "border", "border-strong", "text", "text-muted", "text-faint",
  "accent", "accent-hover", "accent-soft", "accent-contrast", "success", "success-soft", "warning", "warning-soft",
  "danger", "danger-soft", "info", "info-soft", "focus", "scrim", "shadow-sm", "shadow", "shadow-lg",
  "radius-sm", "radius-md", "radius-lg", "radius-xl", "control-h",
];

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseRules(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match, order) => ({
    selectors: splitTopLevel(match[1].trim(), ","),
    declarations: splitTopLevel(match[2], ";").map((declaration) => {
      const index = declaration.indexOf(":");
      return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()] as [string, string];
    }),
    order,
  }));
}

const rules = parseRules(tokensCss);

function matchSelector(selector: string, context: Context): number | null {
  const attributes: Record<string, string> = {
    "data-theme": context.theme,
    "data-accent": context.accent,
    "data-density": context.density,
  };
  let rest = selector.trim();
  let specificity = 0;
  while (rest) {
    if (rest.startsWith(":root")) {
      rest = rest.slice(5);
    } else if (rest.startsWith(":is(")) {
      let depth = 0;
      let end = 3;
      for (; end < rest.length; end += 1) {
        if (rest[end] === "(") depth += 1;
        if (rest[end] === ")" && --depth === 0) break;
      }
      const options = splitTopLevel(rest.slice(4, end), ",");
      if (!options.some((option) => matchSelector(option, context) !== null)) return null;
      rest = rest.slice(end + 1);
    } else {
      const attribute = rest.match(/^\[([\w-]+)(?:="([^"]*)")?\]/);
      if (!attribute) throw new Error(`Unsupported selector in tokens.css: ${selector}`);
      const actual = attributes[attribute[1]];
      if (actual === undefined || (attribute[2] !== undefined && attribute[2] !== actual)) return null;
      rest = rest.slice(attribute[0].length);
    }
    specificity += 1;
  }
  return specificity;
}

function declaredTokens(context: Context): Map<string, string> {
  const winners = new Map<string, { value: string; specificity: number; order: number }>();
  for (const rule of rules) {
    const specificity = Math.max(-1, ...rule.selectors.map((selector) => matchSelector(selector, context) ?? -1));
    if (specificity < 0) continue;
    for (const [property, value] of rule.declarations) {
      if (!property.startsWith("--")) continue;
      const current = winners.get(property);
      if (!current || specificity >= current.specificity) winners.set(property, { value, specificity, order: rule.order });
    }
  }
  return new Map([...winners].map(([property, { value }]) => [property.slice(2), value]));
}

function resolveVars(value: string, tokens: Map<string, string>, depth = 0): string {
  if (depth > 10) throw new Error(`Token cycle while resolving ${value}`);
  return value.replace(/var\(--([\w-]+)\)/g, (_, name: string) => {
    const next = tokens.get(name);
    if (next === undefined) throw new Error(`Undefined token --${name}`);
    return resolveVars(next, tokens, depth + 1);
  });
}

function parseColor(input: string): Rgba {
  const value = input.trim();
  if (value === "transparent") return [0, 0, 0, 0];
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const rgb = value.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const [channels, alpha] = rgb[1].split("/");
    const [r, g, b] = channels.trim().split(/[\s,]+/).map(Number);
    return [r, g, b, alpha === undefined ? 1 : Number(alpha)];
  }
  const mix = value.match(/^color-mix\(in srgb,(.*)\)$/);
  if (mix) {
    const [first, second] = splitTopLevel(mix[1], ",").map((part) => {
      const weight = part.match(/\s(\d+(?:\.\d+)?)%$/);
      return { color: parseColor(weight ? part.slice(0, weight.index) : part), weight: weight ? Number(weight[1]) / 100 : null };
    });
    const p1 = first.weight ?? 1 - (second.weight ?? 0.5);
    const p2 = second.weight ?? 1 - p1;
    const alpha = first.color[3] * p1 + second.color[3] * p2;
    const channel = (i: number) =>
      alpha === 0 ? 0 : (first.color[i] * first.color[3] * p1 + second.color[i] * second.color[3] * p2) / alpha;
    return [channel(0), channel(1), channel(2), alpha];
  }
  throw new Error(`Unsupported color: ${value}`);
}

function composite(color: Rgba, backdrop: Rgba): Rgba {
  const a = color[3];
  return [0, 1, 2].map((i) => color[i] * a + backdrop[i] * (1 - a)).concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba) {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: Rgba, background: Rgba) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function themeTokens(context: Context) {
  const declared = declaredTokens(context);
  const value = (name: string) => resolveVars(declared.get(name) ?? `var(--${name})`, declared);
  const pageBg = parseColor(value("bg"));
  const colorOf = (raw: string) => composite(parseColor(resolveVars(raw, declared)), pageBg);
  const color = (name: string) => colorOf(value(name));
  return { declared, value, color, colorOf };
}

type Check = { fg: string; bg: string[]; min: number };

// text-faint is limited to placeholders and non-essential meta, so it follows the 3:1 non-text/large-text bar.
const CHECKS: Check[] = [
  { fg: "text", bg: ["bg", "surface", "surface-2", "elevated"], min: 4.5 },
  { fg: "text-muted", bg: ["bg", "surface", "surface-2", "elevated"], min: 4.5 },
  { fg: "text-faint", bg: ["bg", "surface", "surface-2", "elevated"], min: 3 },
  { fg: "accent-contrast", bg: ["accent", "accent-hover"], min: 4.5 },
  { fg: "accent", bg: ["bg", "surface", "elevated", "accent-soft"], min: 4.5 },
  { fg: "success", bg: ["surface", "success-soft"], min: 4.5 },
  { fg: "warning", bg: ["surface", "warning-soft"], min: 4.5 },
  { fg: "danger", bg: ["surface", "danger-soft"], min: 4.5 },
  { fg: "info", bg: ["surface", "info-soft"], min: 4.5 },
  { fg: "focus", bg: ["bg", "surface"], min: 3 },
  { fg: "border-strong", bg: ["surface"], min: 3 },
];

const combos = THEMES.flatMap((theme) =>
  ACCENTS.map((accent) => ({ theme: theme.id, accent: accent.id, density: "comfortable" as const })),
);

describe("tokens.css", () => {
  it.each(THEMES.map((theme) => theme.id))("%s defines every contract token", (theme) => {
    const { declared, value } = themeTokens({ theme, accent: "theme", density: "comfortable" });
    const missing = REQUIRED_TOKENS.filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
    for (const name of REQUIRED_TOKENS) expect(() => value(name)).not.toThrow();
  });

  it.each(combos)("$theme × $accent meets WCAG AA", (context) => {
    const { color } = themeTokens(context);
    const failures = CHECKS.flatMap((check) =>
      check.bg
        .map((bg) => ({ bg, ratio: contrast(color(check.fg), color(bg)) }))
        .filter(({ ratio }) => ratio < check.min)
        .map(({ bg, ratio }) => `${check.fg} on ${bg}: ${ratio.toFixed(2)} < ${check.min}`),
    );
    expect(failures).toEqual([]);
  });

  it("uses the dark accent variant only for dark themes", () => {
    for (const theme of THEMES) {
      for (const accent of ACCENTS.filter((item) => item.id !== "theme")) {
        const { value } = themeTokens({ theme: theme.id, accent: accent.id, density: "comfortable" });
        expect(value("accent")).toBe(theme.mode === "dark" ? accent.dark : accent.light);
      }
    }
  });

  it("keeps THEMES swatches and the default accent in sync with the stylesheet", () => {
    for (const theme of THEMES) {
      const { value } = themeTokens({ theme: theme.id, accent: "theme", density: "comfortable" });
      expect(theme.swatch).toEqual({ bg: value("bg"), surface: value("surface"), accent: value("accent") });
    }
    const themeAccent = ACCENTS.find((accent) => accent.id === "theme");
    expect(themeAccent?.light).toBe(THEMES.find((theme) => theme.id === "porcelain")?.swatch.accent);
    expect(themeAccent?.dark).toBe(THEMES.find((theme) => theme.id === "graphite")?.swatch.accent);
  });

  it("tightens control height for compact density", () => {
    expect(themeTokens({ theme: "porcelain", accent: "theme", density: "comfortable" }).value("control-h")).toBe("34px");
    expect(themeTokens({ theme: "graphite", accent: "teal", density: "compact" }).value("control-h")).toBe("32px");
  });
});

type StyleRule = { context: string[]; selectors: string[]; declarations: Map<string, string> };

function parseStylesheet(source: string): StyleRule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: StyleRule[] = [];
  const preludes: string[] = [];
  let buffer = "";
  for (const char of text) {
    if (char === "{") {
      preludes.push(buffer.slice(buffer.lastIndexOf(";") + 1).replace(/\s+/g, " ").trim());
      buffer = "";
    } else if (char === "}") {
      const prelude = preludes.pop() ?? "";
      if (!prelude.startsWith("@")) {
        found.push({
          context: preludes.filter((entry) => entry.startsWith("@")),
          selectors: splitTopLevel(prelude, ","),
          declarations: new Map(
            splitTopLevel(buffer, ";").map((declaration) => {
              const index = declaration.indexOf(":");
              return [declaration.slice(0, index).trim(), declaration.slice(index + 1).replace(/\s+/g, " ").trim()];
            }),
          ),
        });
      }
      buffer = "";
    } else {
      buffer += char;
    }
  }
  return found;
}

const stylesheet = (file: string) => parseStylesheet(readFileSync(join(process.cwd(), "src/styles", file), "utf8"));
const globalsRules = stylesheet("globals.css");
const workspaceRules = stylesheet("workspace.css");
const showcaseRules = stylesheet("showcase.css");

function rulesFor(rules: StyleRule[], selector: string, context?: string[]) {
  return rules.filter(
    (rule) => rule.selectors.includes(selector) && (context === undefined || rule.context.join("|") === context.join("|")),
  );
}

function declaration(rules: StyleRule[], selector: string, property: string, context?: string[]) {
  const matches = rulesFor(rules, selector, context).filter((rule) => rule.declarations.has(property));
  return matches.at(-1)?.declarations.get(property);
}

describe("component stylesheets", () => {
  it("draws the global focus indicator as an outline that shadow and ring utilities cannot hide", () => {
    expect(declaration(globalsRules, ":focus-visible", "outline", ["@layer base"])).toBe("2px solid var(--focus)");
    expect(declaration(globalsRules, ":focus-visible", "outline-offset", ["@layer base"])).toBe("2px");
    expect(declaration(globalsRules, ":focus-visible", "box-shadow", ["@layer base"])).toBe("var(--focus-ring)");
  });

  it("does not clip segmented tooltips and focus rings with a scroll container", () => {
    const segmented = rulesFor(globalsRules, ".segmented", ["@layer components"]);
    expect(segmented.length).toBeGreaterThan(0);
    for (const rule of segmented) {
      expect([...rule.declarations.keys()].filter((property) => property.startsWith("overflow"))).toEqual([]);
    }
  });

  it.each(THEMES.map((theme) => theme.id))("keeps danger button hover text at WCAG AA in %s", (theme) => {
    const hover = declaration(globalsRules, ".btn-danger:hover:not(:disabled)", "background", ["@layer components"]);
    expect(hover).toBeDefined();
    const { color, colorOf } = themeTokens({ theme, accent: "theme", density: "comfortable" });
    expect(contrast(color("danger"), colorOf(hover ?? ""))).toBeGreaterThanOrEqual(4.5);
  });

  it("staggers the typing indicator dots", () => {
    expect(declaration(globalsRules, ".typing-dot", "animation", ["@layer components"])).toContain("typing");
    expect(declaration(globalsRules, ".typing-dot:nth-child(2)", "animation-delay", ["@layer components"])).toBe("0.2s");
    expect(declaration(globalsRules, ".typing-dot:nth-child(3)", "animation-delay", ["@layer components"])).toBe("0.4s");
  });

  it("falls back to two dashboard columns on phones, unlayered so it beats the grid-cols-4 utility", () => {
    expect(
      declaration(workspaceRules, ".workspace-content .grid-cols-4", "grid-template-columns", ["@media (max-width: 639px)"]),
    ).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("keeps the marketing hover, active, scrim and :has() rules", () => {
    for (const selector of [".edsync-emil-shot-frame:hover figcaption p", ".edsync-emil-shot-frame:hover figcaption span"]) {
      expect(declaration(showcaseRules, selector, "max-height", [])).toBe("8rem");
      expect(declaration(showcaseRules, selector, "opacity", [])).toBe("1");
    }
    expect(declaration(showcaseRules, ".edsync-emil-shot-frame figcaption p", "opacity", [])).toBe("0");
    expect(declaration(showcaseRules, ".edsync-emil-shot-frame::after", "background", [])).toContain("linear-gradient");
    expect(declaration(showcaseRules, ".edsync-emil-workflow-visual::after", "display", [])).toBe("none");
    expect(declaration(showcaseRules, ".edsync-workflow-open:hover", "background", [])).toBe(
      "color-mix(in srgb, var(--accent) 16%, transparent)",
    );
    for (const selector of [".edsync-emil-icon:active", ".edsync-emil-signin:active", ".edsync-emil-jump:active"]) {
      expect(declaration(showcaseRules, selector, "transform", [])).toBe("scale(0.97)");
    }
    for (const selector of [".edsync-emil-jump:hover", ".edsync-emil-signin:hover", "html.dark .edsync-emil-signin:hover"]) {
      expect(rulesFor(showcaseRules, selector, []).length).toBeGreaterThan(0);
    }
    expect(declaration(showcaseRules, ".edsync-emil-actions::-webkit-scrollbar", "display", ["@media (max-width: 980px)"])).toBe(
      "none",
    );

    const workflowCard = ".edsync-emil-workflow-card:has(.edsync-emil-workflow-visual)";
    expect(declaration(showcaseRules, workflowCard, "height", [])).toBe("min(96svh, 58rem)");
    expect(declaration(showcaseRules, workflowCard, "height", ["@media (max-width: 900px)"])).toBe("auto");
    expect(declaration(showcaseRules, workflowCard, "height", ["@media (max-width: 760px)"])).toBe("auto");
    expect(declaration(showcaseRules, `${workflowCard} .edsync-emil-workflow-screen`, "height", [])).toBe("100%");
  });

  it("drops selectors and tokens the theme system no longer defines", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/showcase.css"), "utf8");
    expect(source).not.toContain("--blue-rgb");
    expect(source).not.toContain('html[data-theme="dark"]');
  });
});

describe("theme runtime", () => {
  let systemDark = false;

  beforeEach(() => {
    window.localStorage.clear();
    const root = document.documentElement;
    root.className = "";
    for (const name of ["theme", "accent", "density", "sidebar"]) delete root.dataset[name];
    systemDark = false;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark") && systemDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves system and explicit preferences", () => {
    expect(resolveTheme("system", false)).toBe("porcelain");
    expect(resolveTheme("system", true)).toBe("graphite");
    expect(resolveTheme("rosewood", false)).toBe("rosewood");
    expect(resolveTheme("sand", true)).toBe("sand");
  });

  it("reports the mode of every theme", () => {
    for (const theme of THEMES) expect(themeMode(theme.id)).toBe(theme.mode);
  });

  it("pairs each theme with a counterpart of the opposite mode", () => {
    for (const theme of THEMES) {
      const counterpart = counterpartTheme(theme.id);
      expect(themeMode(counterpart)).not.toBe(theme.mode);
      expect(counterpartTheme(counterpart)).toBe(theme.id);
    }
  });

  it("migrates legacy light/dark values", () => {
    expect(normalizeThemePreference("light")).toBe("porcelain");
    expect(normalizeThemePreference("dark")).toBe("graphite");
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("ocean")).toBe("ocean");
    expect(normalizeThemePreference("neon")).toBeNull();
    expect(normalizeThemePreference(undefined)).toBeNull();

    window.localStorage.setItem("edsync-theme", "dark");
    expect(readAppearance()).toEqual({ theme: "graphite", accent: "theme", density: "comfortable" });
    expect(hasStoredTheme()).toBe(true);
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("rejects the Object.prototype key %s", (key) => {
    expect(normalizeThemePreference(key)).toBeNull();
    window.localStorage.setItem("edsync-theme", key);
    expect(readAppearance().theme).toBe("system");
    expect(hasStoredTheme()).toBe(false);

    setAppearance({ theme: key as ThemeId });
    expect(document.documentElement.dataset.theme).toBe("porcelain");
  });

  it("falls back to defaults for missing or invalid values", () => {
    window.localStorage.setItem("edsync-accent", "neon");
    window.localStorage.setItem("edsync-density", "tiny");
    expect(readAppearance()).toEqual({ theme: "system", accent: "theme", density: "comfortable" });
    expect(hasStoredTheme()).toBe(false);
  });

  it("writes only the patched keys, applies them to <html> and notifies listeners", () => {
    const listener = vi.fn();
    window.addEventListener(APPEARANCE_EVENT, listener);
    setAppearance({ theme: "midnight", accent: "rose" });
    window.removeEventListener(APPEARANCE_EVENT, listener);

    const root = document.documentElement;
    expect(window.localStorage.getItem("edsync-theme")).toBe("midnight");
    expect(window.localStorage.getItem("edsync-accent")).toBe("rose");
    expect(window.localStorage.getItem("edsync-density")).toBeNull();
    expect(root.dataset.theme).toBe("midnight");
    expect(root.dataset.accent).toBe("rose");
    expect(root.dataset.density).toBe("comfortable");
    expect(root.classList.contains("dark")).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ theme: "midnight", accent: "rose", density: "comfortable" });

    setAppearance({ theme: "system", density: "compact" });
    expect(root.dataset.theme).toBe("porcelain");
    expect(root.dataset.density).toBe("compact");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("boot script applies stored appearance before paint", () => {
    window.localStorage.setItem("edsync-theme", "dark");
    window.localStorage.setItem("edsync-accent", "teal");
    window.localStorage.setItem("edsync-density", "compact");
    window.localStorage.setItem("edsync-sidebar", "expanded");
    new Function(appearanceBootScript)();

    const root = document.documentElement;
    expect(root.dataset.theme).toBe("graphite");
    expect(root.dataset.accent).toBe("teal");
    expect(root.dataset.density).toBe("compact");
    expect(root.dataset.sidebar).toBe("expanded");
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("boot script follows the system scheme by default", () => {
    systemDark = true;
    new Function(appearanceBootScript)();

    const root = document.documentElement;
    expect(root.dataset.theme).toBe("graphite");
    expect(root.dataset.accent).toBe("theme");
    expect(root.dataset.density).toBe("comfortable");
    expect(root.dataset.sidebar).toBe("rail");
    expect(root.classList.contains("dark")).toBe(true);
  });
});
