import type { FontPair } from "@/lib/studio/scene";
import { findFontFamily, googleFamilyQuery, servedWeights, type FontCategory } from "./fonts";

const FALLBACKS: Record<FontCategory, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  display: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  handwriting: '"Segoe Print", "Comic Sans MS", cursive',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
};

/** CSS font-family value with sensible fallbacks, e.g. `"Lora", Georgia, serif`. */
export function fontStack(family: string): string {
  const name = family.trim();
  const category = findFontFamily(name)?.category ?? "sans";
  if (!name) return FALLBACKS[category];
  return `"${name.replace(/"/g, "")}", ${FALLBACKS[category]}`;
}

export function googleFontsHref(queries: readonly string[]): string {
  return `https://fonts.googleapis.com/css2?${queries.map((query) => `family=${query}`).join("&")}&display=swap`;
}

const STYLESHEET_TIMEOUT_MS = 4000;
const FACE_TIMEOUT_MS = 4000;
const stylesheets = new Map<string, Promise<void>>();

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

function injectStylesheet(query: string): Promise<void> {
  const known = stylesheets.get(query);
  if (known) return known;
  const existing = Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-studio-font]")).find(
    (link) => link.dataset.studioFont === query,
  );
  const loaded = new Promise<void>((resolve) => {
    if (existing?.sheet) {
      resolve();
      return;
    }
    const link = existing ?? document.createElement("link");
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    if (!existing) {
      link.rel = "stylesheet";
      link.href = googleFontsHref([query]);
      link.dataset.studioFont = query;
      document.head.appendChild(link);
    }
  });
  const settled = withTimeout(loaded, STYLESHEET_TIMEOUT_MS);
  stylesheets.set(query, settled);
  return settled;
}

async function loadFaces(faces: readonly { family: string; weight: number }[]): Promise<void> {
  const fontSet = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fontSet?.load) return;
  const requests = faces.map(({ family, weight }) => fontSet.load(`${weight} 1em "${family}"`));
  await withTimeout(Promise.allSettled(requests), FACE_TIMEOUT_MS);
}

/** Loads one family from Google Fonts (one stylesheet per family, deduplicated). No-op on the server. */
export async function ensureFontFamilyLoaded(family: string, weights: readonly number[] = [400]): Promise<void> {
  if (typeof document === "undefined" || !family.trim()) return;
  const served = servedWeights(family, weights);
  await injectStylesheet(googleFamilyQuery(family, served));
  await loadFaces(served.map((weight) => ({ family, weight })));
}

/** Loads both families of a pair and waits until the used weights are ready. No-op on the server. */
export async function ensureFontPairLoaded(pair: FontPair): Promise<void> {
  if (typeof document === "undefined") return;
  await Promise.all(pair.googleFamilies.map((query) => injectStylesheet(query)));
  await loadFaces([
    { family: pair.heading, weight: pair.headingWeight },
    { family: pair.body, weight: pair.bodyWeight },
    { family: pair.body, weight: 600 },
  ]);
}
