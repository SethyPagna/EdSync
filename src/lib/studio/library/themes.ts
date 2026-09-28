import type { Background, ColorToken, DeckTheme, Paint } from "@/lib/studio/scene";

type Colors = Record<ColorToken, string>;

/** bg, surface, surface2, text, muted, accent, accent2, accentSoft, onAccent, border, success, warning, danger */
type ColorRow = [string, string, string, string, string, string, string, string, string, string, string, string, string];

function colors(row: ColorRow): Colors {
  const [bg, surface, surface2, text, muted, accent, accent2, accentSoft, onAccent, border, success, warning, danger] = row;
  return { bg, surface, surface2, text, muted, accent, accent2, accentSoft, onAccent, border, success, warning, danger };
}

const solid = (color: Paint): Background => ({ kind: "solid", color });

function gradient(from: Paint, to: Paint, angle: number, via?: Paint): Background {
  return via ? { kind: "gradient", from, via, to, angle } : { kind: "gradient", from, to, angle };
}

function theme(
  id: string,
  name: string,
  mode: DeckTheme["mode"],
  row: ColorRow,
  options: Omit<DeckTheme, "id" | "name" | "mode" | "colors">,
): DeckTheme {
  return { id, name, mode, colors: colors(row), ...options };
}

export const DECK_THEMES: readonly DeckTheme[] = [
  theme("porcelain", "Porcelain", "light",
    ["#FFFFFF", "#F6F7F9", "#EEF0F3", "#111418", "#5B6472", "#3D4ED7", "#0E8F7E", "#ECEEFC", "#FFFFFF", "#E3E6EB", "#1A7445", "#8F5600", "#C22F2D"],
    { fontPairId: "modern", radius: 16, background: solid("bg"), heroBackground: gradient("bg", "accentSoft", 135), decor: "blobs", cardStyle: "soft", tags: ["light", "minimal", "modern", "default"] }),
  theme("paper-ink", "Paper & Ink", "light",
    ["#FAF8F3", "#FFFFFF", "#F1EDE4", "#16130F", "#5E574C", "#1A1A1A", "#B4442C", "#ECE7DC", "#FFFFFF", "#E2DCCF", "#2F6B3A", "#8A5A00", "#B4442C"],
    { fontPairId: "editorial", radius: 4, background: solid("bg"), heroBackground: { kind: "pattern", pattern: "lines", color: "border", on: "bg" }, decor: "lines", cardStyle: "outline", tags: ["light", "editorial", "serif", "writing"] }),
  theme("graphite", "Graphite", "dark",
    ["#1C1D20", "#25262A", "#2E3035", "#ECEDEF", "#A3A7AF", "#93A5FF", "#5EEAD4", "#2C3150", "#11131C", "#3A3C42", "#62C98E", "#E6B04F", "#F2837B"],
    { fontPairId: "clean", radius: 14, background: solid("bg"), heroBackground: gradient("bg", "accentSoft", 160), decor: "dots", cardStyle: "soft", tags: ["dark", "minimal", "professional"] }),
  theme("midnight", "Midnight", "dark",
    ["#0B0F1A", "#121828", "#1A2236", "#F2F4F8", "#9AA3B6", "#A98DFA", "#38BDF8", "#231C3A", "#130B26", "#262E42", "#4ADE80", "#FBBF24", "#F87171"],
    { fontPairId: "tech", radius: 16, background: solid("bg"), heroBackground: gradient("bg", "accentSoft", 135, "#1E1B4B"), decor: "blobs", cardStyle: "glass", tags: ["dark", "night", "focus", "modern"] }),
  theme("chalkboard", "Chalkboard", "dark",
    ["#1F3A2E", "#264536", "#2D5040", "#F4F1E8", "#C8D2C7", "#F6D776", "#F2A7B5", "#34513F", "#1F2A1A", "#3E5E4D", "#9BE3A6", "#F6D776", "#F7A38F"],
    { fontPairId: "handwritten", radius: 6, background: solid("bg"), heroBackground: gradient("surface", "bg", 180), decor: "frame", cardStyle: "outline", tags: ["dark", "classroom", "chalk", "kids", "math"] }),
  theme("blueprint", "Blueprint", "dark",
    ["#0A2F6B", "#0F3A80", "#15468F", "#F5F9FF", "#C9DBF5", "#7FDBFF", "#FFD166", "#1A4C94", "#06213F", "#2A5BA6", "#8EF0B0", "#FFD166", "#FF9A8B"],
    { fontPairId: "tech", radius: 4, background: { kind: "pattern", pattern: "grid", color: "border", on: "bg" }, heroBackground: gradient("surface", "bg", 160), decor: "lines", cardStyle: "outline", tags: ["dark", "science", "engineering", "grid", "coding"] }),
  theme("ocean", "Ocean", "light",
    ["#F2F8FB", "#FFFFFF", "#E3F0F6", "#0B2530", "#46616F", "#0E7490", "#0284C7", "#D5EEF4", "#FFFFFF", "#D3E4EC", "#15803D", "#8F5600", "#B91C1C"],
    { fontPairId: "clean", radius: 18, background: solid("bg"), heroBackground: gradient("accentSoft", "bg", 160), decor: "waves", cardStyle: "soft", tags: ["light", "calm", "science", "geography"] }),
  theme("forest", "Forest", "dark",
    ["#0F2A22", "#143429", "#1A3F32", "#ECF5EF", "#A7C4B5", "#7ED6A4", "#E9C46A", "#1D4637", "#0B2118", "#24503F", "#7ED6A4", "#E9C46A", "#F4978E"],
    { fontPairId: "magazine", radius: 18, background: solid("bg"), heroBackground: gradient("bg", "surface2", 135), decor: "blobs", cardStyle: "soft", tags: ["dark", "nature", "biology", "calm"] }),
  theme("sunrise", "Sunrise", "light",
    ["#FFF9F2", "#FFFFFF", "#FDEEDC", "#2A1709", "#6B513D", "#C2410C", "#D97706", "#FFE8D6", "#FFFFFF", "#F3DFC9", "#15803D", "#92400E", "#B91C1C"],
    { fontPairId: "friendly", radius: 20, background: solid("bg"), heroBackground: gradient("#FFF1E0", "#FFD6DE", 135, "#FFE0CC"), decor: "blobs", cardStyle: "shadow", tags: ["light", "warm", "gradient", "friendly"] }),
  theme("terracotta", "Terracotta", "light",
    ["#F7EFE7", "#FFFAF5", "#EFE2D6", "#2B1A12", "#654C3E", "#A8472A", "#3F6F5E", "#F2DDD0", "#FFFFFF", "#E5D3C3", "#2F6B3A", "#8A5A00", "#A8322A"],
    { fontPairId: "elegant", radius: 10, background: solid("bg"), heroBackground: gradient("bg", "accentSoft", 120), decor: "corner", cardStyle: "flat", tags: ["light", "warm", "earthy", "arts"] }),
  theme("sage", "Sage", "light",
    ["#F3F5F1", "#FCFDFB", "#E7ECE4", "#161B16", "#525D55", "#3C6A4D", "#A86B12", "#E1ECE3", "#FFFFFF", "#DDE3D8", "#2D7443", "#855900", "#B03E2C"],
    { fontPairId: "readable", radius: 16, background: solid("bg"), heroBackground: gradient("bg", "accentSoft", 150), decor: "blobs", cardStyle: "soft", tags: ["light", "calm", "nature", "accessible"] }),
  theme("lavender", "Lavender", "light",
    ["#F7F5FC", "#FFFFFF", "#EEE9F9", "#1E1733", "#5A5370", "#6D4AD9", "#C23D7A", "#ECE5FD", "#FFFFFF", "#E3DCF3", "#1A7445", "#8F5600", "#C22F2D"],
    { fontPairId: "classic", radius: 18, background: solid("bg"), heroBackground: gradient("accentSoft", "bg", 135), decor: "dots", cardStyle: "soft", tags: ["light", "soft", "literature", "arts"] }),
  theme("blossom", "Blossom", "light",
    ["#FFF6F7", "#FFFFFF", "#FDE8EC", "#33121B", "#6E4650", "#C2255C", "#7C3AED", "#FCE4EC", "#FFFFFF", "#F6D5DD", "#1A7445", "#8F5600", "#B42318"],
    { fontPairId: "elegant", radius: 22, background: solid("bg"), heroBackground: gradient("surface2", "bg", 135), decor: "blobs", cardStyle: "shadow", tags: ["light", "pink", "soft", "social"] }),
  theme("citrus", "Citrus", "light",
    ["#FFFEF5", "#FFFFFF", "#FEF6C7", "#1C1A05", "#5A5628", "#E8590C", "#4D7C0F", "#FFF0C2", "#1C1A05", "#F0E6B0", "#3F6212", "#92400E", "#B91C1C"],
    { fontPairId: "bold", radius: 14, background: solid("bg"), heroBackground: gradient("surface2", "bg", 160), decor: "dots", cardStyle: "flat", tags: ["light", "bright", "energetic", "social"] }),
  theme("nordic", "Nordic", "light",
    ["#F4F6F8", "#FFFFFF", "#E9EDF1", "#1B2430", "#55606D", "#2E5E8C", "#B07534", "#E1EAF3", "#FFFFFF", "#DCE2E8", "#2D6A4F", "#8A5A00", "#B03A2E"],
    { fontPairId: "modern", radius: 8, background: solid("bg"), heroBackground: gradient("bg", "surface2", 180), decor: "lines", cardStyle: "outline", tags: ["light", "minimal", "cool", "professional"] }),
  theme("neon-night", "Neon Night", "dark",
    ["#0A0A12", "#13131F", "#1C1C2B", "#F5F5FF", "#A4A4C0", "#FF4FB1", "#3CF0FF", "#2A1230", "#1A0010", "#2A2A40", "#39FF88", "#FFE14D", "#FF6B6B"],
    { fontPairId: "bold", radius: 12, background: solid("bg"), heroBackground: gradient("#1B0B2E", "#0A1A2A", 135, "bg"), decor: "grain", cardStyle: "glass", tags: ["dark", "neon", "gaming", "coding", "social"] }),
  theme("parchment", "Parchment", "light",
    ["#F8F1E1", "#FFF9EC", "#EFE3C8", "#2A2116", "#62533C", "#8A4B12", "#3D5A80", "#F0E0C0", "#FFFFFF", "#E3D3B0", "#3F6B2F", "#855400", "#9B2C2C"],
    { fontPairId: "academic", radius: 6, background: solid("bg"), heroBackground: gradient("surface", "surface2", 180), decor: "frame", cardStyle: "outline", tags: ["light", "serif", "history", "literature", "vintage"] }),
  theme("monochrome", "Monochrome", "light",
    ["#FFFFFF", "#F5F5F5", "#EBEBEB", "#0A0A0A", "#595959", "#0A0A0A", "#737373", "#EDEDED", "#FFFFFF", "#E0E0E0", "#1F6F43", "#7A5200", "#B42318"],
    { fontPairId: "editorial", radius: 0, background: solid("bg"), heroBackground: solid("bg"), decor: "none", cardStyle: "outline", tags: ["light", "minimal", "print", "black and white"] }),
  theme("kids-playful", "Kids Playful", "light",
    ["#FFFBEF", "#FFFFFF", "#FFF0C9", "#1F2544", "#51577A", "#2F6FEB", "#E8453C", "#E3ECFF", "#FFFFFF", "#F2E3B5", "#15803D", "#A15C00", "#C62828"],
    { fontPairId: "playful", radius: 24, background: solid("bg"), heroBackground: { kind: "pattern", pattern: "confetti", color: "accent2", on: "bg" }, decor: "dots", cardStyle: "shadow", tags: ["light", "kids", "primary", "bright", "fun"] }),
  theme("aurora", "Aurora", "dark",
    ["#0B1026", "#121A3A", "#1A2450", "#F3F6FF", "#AAB5D8", "#7DF9C8", "#B794F6", "#16304A", "#04241A", "#26305C", "#7DF9C8", "#FCD34D", "#FB8C8C"],
    { fontPairId: "modern", radius: 18, background: gradient("bg", "#10244A", 160), heroBackground: gradient("bg", "#0E5B5B", 135, "#1B2F6B"), decor: "blobs", cardStyle: "glass", tags: ["dark", "gradient", "space", "launch"] }),
];

export const DEFAULT_DECK_THEME_ID = "porcelain";

const THEME_BY_ID = new Map(DECK_THEMES.map((deckTheme) => [deckTheme.id, deckTheme]));

export function findDeckTheme(id: string | null | undefined): DeckTheme | undefined {
  return id ? THEME_BY_ID.get(id) : undefined;
}

export function getDeckTheme(id: string | null | undefined): DeckTheme {
  return findDeckTheme(id) ?? (THEME_BY_ID.get(DEFAULT_DECK_THEME_ID) as DeckTheme);
}

/** Theme colors with per-deck brand overrides applied. */
export function themeColors(deckTheme: DeckTheme, overrides?: Partial<Record<ColorToken, string>>): Record<ColorToken, string> {
  if (!overrides) return deckTheme.colors;
  const out = { ...deckTheme.colors };
  for (const [token, value] of Object.entries(overrides)) {
    if (isColorToken(token) && typeof value === "string" && value) out[token] = value;
  }
  return out;
}

const COLOR_TOKENS = new Set<string>([
  "bg", "surface", "surface2", "text", "muted", "accent", "accent2", "accentSoft", "onAccent", "border", "success", "warning", "danger",
]);

export function isColorToken(value: string): value is ColorToken {
  return COLOR_TOKENS.has(value);
}

/** Resolves a Paint (token, hex/rgb, "transparent") against a color map. */
export function resolvePaint(paint: string | undefined, palette: Record<ColorToken, string>, fallback = "transparent"): string {
  if (!paint) return fallback;
  return isColorToken(paint) ? (palette[paint] ?? fallback) : paint;
}
