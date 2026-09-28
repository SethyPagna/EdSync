import type { Background, ColorToken, Paint } from "@/lib/studio/scene";
import { contrastRatio, isHexColor } from "./contrast";
import { resolvePaint } from "./themes";

export type PatternKind = Extract<Background, { kind: "pattern" }>["pattern"];
export type BackgroundGroup = "theme" | "solid" | "soft" | "bold" | "pattern";

export interface BackgroundPreset {
  id: string;
  name: string;
  group: BackgroundGroup;
  /**
   * True when the preset reads well with dark text. Set only for fixed-colour presets;
   * use presetIsLight for theme-dependent ones.
   */
  light?: boolean;
  background: Background;
}

const solid = (color: Paint): Background => ({ kind: "solid", color });
const linear = (from: Paint, to: Paint, angle: number, via?: Paint): Background =>
  via ? { kind: "gradient", from, via, to, angle } : { kind: "gradient", from, to, angle };
const pattern = (kind: PatternKind, color: Paint, on: Paint): Background => ({ kind: "pattern", pattern: kind, color, on });

type Row = [id: string, name: string, group: BackgroundGroup, light: boolean | undefined, background: Background];

const ROWS: Row[] = [
  ["theme-bg", "Theme", "theme", undefined, solid("bg")],
  ["theme-surface", "Surface", "theme", undefined, solid("surface")],
  ["theme-tint", "Tint", "theme", undefined, solid("accentSoft")],
  ["theme-glow", "Glow", "theme", undefined, linear("bg", "accentSoft", 135)],
  ["theme-accent", "Accent", "theme", undefined, solid("accent")],
  ["theme-duo", "Duotone", "theme", undefined, linear("accent", "accent2", 135)],
  ["white", "White", "solid", true, solid("#FFFFFF")],
  ["paper", "Paper", "solid", true, solid("#FAF7F0")],
  ["mist", "Mist", "solid", true, solid("#EEF1F5")],
  ["butter", "Butter", "solid", true, solid("#FFF4C7")],
  ["ink", "Ink", "solid", false, solid("#111418")],
  ["chalk-green", "Chalk green", "solid", false, solid("#1F3A2E")],
  ["navy", "Navy", "solid", false, solid("#0B1B33")],
  ["morning", "Morning", "soft", true, linear("#FDFBFB", "#EBEDEE", 180)],
  ["peach", "Peach", "soft", true, linear("#FFF1EB", "#FFE0D2", 135)],
  ["mint", "Mint", "soft", true, linear("#E6F8F0", "#F7FFFB", 160)],
  ["sky", "Sky", "soft", true, linear("#E0F2FE", "#F8FAFC", 180)],
  ["lilac", "Lilac", "soft", true, linear("#F3E8FF", "#FDF4FF", 135)],
  ["sand", "Sand", "soft", true, linear("#FAF5EC", "#F1E6D4", 160)],
  ["cotton-candy", "Cotton candy", "soft", true, linear("#FDE2F3", "#E0EAFF", 135)],
  ["aurora", "Aurora", "bold", false, linear("#0F766E", "#7C3AED", 135, "#2563EB")],
  ["sunset", "Sunset", "bold", false, linear("#C2410C", "#BE185D", 135)],
  ["deep-ocean", "Deep ocean", "bold", false, linear("#0369A1", "#1E3A8A", 160)],
  ["berry", "Berry", "bold", false, linear("#6D28D9", "#BE185D", 135)],
  ["night-sky", "Night sky", "bold", false, linear("#0B1026", "#1E293B", 180, "#1B2F6B")],
  ["forest", "Forest", "bold", false, linear("#14532D", "#0F766E", 135)],
  ["citrus", "Citrus", "bold", true, linear("#FDE047", "#FB923C", 135)],
  ["dots", "Dots", "pattern", undefined, pattern("dots", "border", "bg")],
  ["grid", "Grid", "pattern", undefined, pattern("grid", "border", "bg")],
  ["ruled", "Ruled", "pattern", undefined, pattern("lines", "border", "surface")],
  ["diagonal", "Diagonal", "pattern", undefined, pattern("diagonal", "accentSoft", "bg")],
  ["waves", "Waves", "pattern", undefined, pattern("waves", "accentSoft", "bg")],
  ["confetti", "Confetti", "pattern", undefined, pattern("confetti", "accent", "bg")],
  ["graph-paper", "Graph paper", "pattern", true, pattern("grid", "#CFE3F5", "#FFFFFF")],
  ["blueprint", "Blueprint", "pattern", false, pattern("grid", "#2A5BA6", "#0A2F6B")],
  ["chalk-dots", "Chalk dots", "pattern", false, pattern("dots", "#3E5E4D", "#1F3A2E")],
];

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = ROWS.map(([id, name, group, light, background]) =>
  light === undefined ? { id, name, group, background } : { id, name, group, light, background },
);

export const BACKGROUND_GROUPS: readonly { id: BackgroundGroup; name: string }[] = [
  { id: "theme", name: "Theme" },
  { id: "solid", name: "Solid" },
  { id: "soft", name: "Soft gradients" },
  { id: "bold", name: "Bold gradients" },
  { id: "pattern", name: "Patterns" },
];

export function getBackgroundPreset(id: string): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id);
}

/** Paints that text sits on for this background (for contrast and text-color decisions). */
export function backgroundStops(background: Background): Paint[] {
  switch (background.kind) {
    case "solid":
      return [background.color];
    case "gradient":
      return background.via ? [background.from, background.via, background.to] : [background.from, background.to];
    case "pattern":
      return [background.on];
    case "image":
      return background.overlay ? [background.overlay] : [];
  }
}

/** Whether dark text reads better than white text on this preset under the given theme colours. */
export function presetIsLight(preset: BackgroundPreset, colors: Record<ColorToken, string>): boolean {
  if (preset.light !== undefined) return preset.light;
  return backgroundStops(preset.background)
    .map((paint) => resolvePaint(paint, colors))
    .filter(isHexColor)
    .every((stop) => contrastRatio("#111418", stop) >= contrastRatio("#FFFFFF", stop));
}

const esc = (value: string) => value.replace(/[<>&"']/g, "");

const TILES: Record<PatternKind, { width: number; height: number; body: (color: string) => string }> = {
  dots: { width: 24, height: 24, body: (c) => `<circle cx='12' cy='12' r='1.6' fill='${c}'/>` },
  grid: { width: 32, height: 32, body: (c) => `<path d='M32 .5H.5V32' fill='none' stroke='${c}' stroke-width='1'/>` },
  lines: { width: 32, height: 32, body: (c) => `<path d='M0 31.5H32' stroke='${c}' stroke-width='1'/>` },
  diagonal: {
    width: 16,
    height: 16,
    body: (c) => `<path d='M-4 4L4-4M0 16L16 0M12 20L20 12' stroke='${c}' stroke-width='1.5'/>`,
  },
  waves: {
    width: 48,
    height: 16,
    body: (c) => `<path d='M0 8Q12 0 24 8T48 8' fill='none' stroke='${c}' stroke-width='1.5'/>`,
  },
  confetti: {
    width: 120,
    height: 120,
    body: (c) =>
      [
        `<rect x='14' y='10' width='10' height='4' rx='2' fill='${c}' transform='rotate(30 19 12)'/>`,
        `<circle cx='70' cy='18' r='3' fill='${c}' opacity='.7'/>`,
        `<path d='M100 30l6 10h-12z' fill='${c}' opacity='.55'/>`,
        `<rect x='40' y='50' width='12' height='4' rx='2' fill='${c}' opacity='.6' transform='rotate(-35 46 52)'/>`,
        `<circle cx='18' cy='70' r='2.5' fill='${c}' opacity='.85'/>`,
        `<rect x='84' y='74' width='10' height='4' rx='2' fill='${c}' transform='rotate(65 89 76)'/>`,
        `<path d='M52 96l5 9h-10z' fill='${c}' opacity='.8'/>`,
        `<circle cx='104' cy='106' r='3' fill='${c}' opacity='.5'/>`,
        `<rect x='8' y='104' width='9' height='4' rx='2' fill='${c}' opacity='.65' transform='rotate(-15 12 106)'/>`,
      ].join(""),
  },
};

export function patternTileSize(kind: PatternKind): { width: number; height: number } {
  const { width, height } = TILES[kind];
  return { width, height };
}

/** One seamless, transparent tile of the pattern in `color` (resolved CSS color). */
export function patternTileSvg(kind: PatternKind, color: string): string {
  const tile = TILES[kind];
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${tile.width}' height='${tile.height}' viewBox='0 0 ${tile.width} ${tile.height}'>${tile.body(esc(color))}</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** CSS `background` shorthand value for DOM previews (thumbnails, panels). */
export function backgroundCss(background: Background, resolvePaint: (paint: Paint) => string): string {
  switch (background.kind) {
    case "solid":
      return resolvePaint(background.color);
    case "gradient": {
      const stops = backgroundStops(background).map(resolvePaint).join(", ");
      return `linear-gradient(${background.angle}deg, ${stops})`;
    }
    case "pattern": {
      const { width, height } = TILES[background.pattern];
      const tile = svgDataUrl(patternTileSvg(background.pattern, resolvePaint(background.color)));
      return `url("${tile}") 0 0 / ${width}px ${height}px repeat, ${resolvePaint(background.on)}`;
    }
    case "image": {
      const image = `url("${background.src.replace(/"/g, "%22")}") center / cover no-repeat`;
      if (!background.overlay) return image;
      const percent = Math.round(Math.min(1, Math.max(0, background.overlayOpacity ?? 0.4)) * 100);
      const overlay = `color-mix(in srgb, ${resolvePaint(background.overlay)} ${percent}%, transparent)`;
      return `linear-gradient(${overlay}, ${overlay}), ${image}`;
    }
  }
}
