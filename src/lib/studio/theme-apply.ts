/**
 * Theme application: swapping a deck's theme is a recolor (elements use color tokens),
 * plus swapping theme-default page backgrounds. User hex colors are never touched.
 */
import { findDeckTheme, findFontPair, fontStack } from "@/lib/studio/library";
import { refitTextElement } from "./fit";
import { HERO_LAYOUT_IDS } from "./layouts/ids";
import { createApproxMeasurer } from "./measure";
import { COLOR_TOKENS, isColorToken, type ColorOverrides } from "./paint";
import type { Background, ColorToken, DeckTheme, FontPair, Paint, SceneDeck, SceneElement, ShapeElement, TextMeasurer } from "./scene";

/** Structural equality for backgrounds (key order independent). */
export function sameBackground(a: Background | undefined, b: Background | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as unknown as Record<string, unknown>)[key] !== (b as unknown as Record<string, unknown>)[key]) return false;
  }
  return true;
}

const tokenPaint = (paint: Paint | undefined) => paint === undefined || paint === "transparent" || isColorToken(paint);

/** True when a background only uses theme tokens (so it follows any theme). */
export function isTokenBackground(bg: Background): boolean {
  switch (bg.kind) {
    case "solid":
      return tokenPaint(bg.color);
    case "gradient":
      return tokenPaint(bg.from) && tokenPaint(bg.to) && tokenPaint(bg.via);
    case "pattern":
      return tokenPaint(bg.color) && tokenPaint(bg.on);
    default:
      return false;
  }
}

/** True for a theme-provided (or token-only) background, i.e. one the user did not customize. */
export function isDefaultBackground(bg: Background, theme: DeckTheme): boolean {
  return sameBackground(bg, theme.background) || sameBackground(bg, theme.heroBackground) || isTokenBackground(bg);
}

/**
 * True when a page background is one the engine put there: the theme's page or hero
 * background, or the background its layout builds (`layoutBg`). Anything else, including
 * token-only presets the user picked, counts as the user's choice.
 */
export function isGeneratedBackground(bg: Background, theme: DeckTheme, layoutBg?: Background): boolean {
  return sameBackground(bg, theme.background) || sameBackground(bg, theme.heroBackground) || sameBackground(bg, layoutBg);
}

export function isHeroLayout(layoutId: string | undefined): boolean {
  return Boolean(layoutId && HERO_LAYOUT_IDS.includes(layoutId));
}

/**
 * Background for a page after a theme change. With `previousTheme`, backgrounds equal to the
 * old theme's defaults are swapped for the new theme's; without it only the plain `bg` fill
 * and token-only hero backgrounds are swapped. Custom backgrounds (hex, images) are kept.
 */
export function themedBackground(bg: Background, layoutId: string | undefined, theme: DeckTheme, previousTheme?: DeckTheme): Background {
  const hero = isHeroLayout(layoutId);
  const heroBg = theme.heroBackground ?? theme.background;
  if (previousTheme) {
    const wasContent = sameBackground(bg, previousTheme.background);
    const wasHero = sameBackground(bg, previousTheme.heroBackground);
    if (hero && (wasContent || wasHero)) return heroBg;
    if (wasContent) return theme.background;
    if (wasHero) return heroBg;
    return bg;
  }
  if (bg.kind === "solid" && bg.color === "bg") return hero ? heroBg : theme.background;
  if (hero && isTokenBackground(bg)) return heroBg;
  return bg;
}

function retuneCard(el: SceneElement, prevRadius: number, nextRadius: number): SceneElement {
  if (el.edited || el.kind !== "shape" || el.role !== "card") return el;
  if (el.shape !== "rounded" && el.shape !== "rect") return el;
  if ((el.radius ?? 0) !== prevRadius) return el;
  const next: ShapeElement = { ...el, shape: nextRadius > 0 ? "rounded" : "rect", radius: nextRadius };
  if (!nextRadius) delete next.radius;
  return next;
}

/**
 * Applies a theme (and optionally a font pair) to a deck without changing its layout.
 * The previous theme defaults to the library theme the deck names, so its default
 * backgrounds and card radius are swapped precisely. When the font pair changes, text is
 * refit to its box (shrunk toward the style minimum, the box grown only if that is not enough).
 * Returns a new deck; the input is not mutated.
 */
export function applyDeckTheme(
  deck: SceneDeck,
  theme: DeckTheme,
  fontPair?: FontPair,
  previousTheme: DeckTheme | undefined = findDeckTheme(deck.themeId),
  measure?: TextMeasurer,
): SceneDeck {
  const s = Math.min(deck.width, deck.height) / 720;
  const prevRadius = previousTheme ? Math.round(Math.max(0, previousTheme.radius) * s) : undefined;
  const nextRadius = Math.round(Math.max(0, theme.radius) * s);
  const pairId = fontPair?.id ?? theme.fontPairId;
  const newPair = pairId !== (deck.fontPairId ?? previousTheme?.fontPairId) ? (fontPair ?? findFontPair(pairId)) : undefined;
  const meter = newPair ? (measure ?? createApproxMeasurer()) : undefined;
  const size = { width: deck.width, height: deck.height, kind: deck.kind };
  const oldRadius = prevRadius !== undefined && prevRadius !== nextRadius ? prevRadius : undefined;
  const restyle = (el: SceneElement): SceneElement => {
    const next = oldRadius === undefined ? el : retuneCard(el, oldRadius, nextRadius);
    return newPair && meter && next.kind === "text" ? refitTextElement(next, newPair, size, meter) : next;
  };
  return {
    ...deck,
    themeId: theme.id,
    fontPairId: pairId,
    pages: deck.pages.map((page) => ({
      ...page,
      background: themedBackground(page.background, page.layoutId, theme, previousTheme),
      elements: oldRadius !== undefined || newPair ? page.elements.map(restyle) : page.elements,
    })),
  };
}

const kebab = (token: ColorToken) => token.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

/** CSS custom properties for a deck theme: `--deck-<token>` colors, radius and fonts. */
export function buildThemeVars(theme: DeckTheme, overrides?: ColorOverrides, fontPair?: FontPair): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const token of COLOR_TOKENS) vars[`--deck-${kebab(token)}`] = overrides?.[token] ?? theme.colors[token];
  vars["--deck-radius"] = `${Math.max(0, theme.radius)}px`;
  if (fontPair) {
    vars["--deck-font-heading"] = fontStack(fontPair.heading);
    vars["--deck-font-body"] = fontStack(fontPair.body);
    vars["--deck-weight-heading"] = String(fontPair.headingWeight);
    vars["--deck-weight-body"] = String(fontPair.bodyWeight);
  }
  return vars;
}
