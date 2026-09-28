import type { FontPair } from "@/lib/studio/scene";

export type FontCategory = "sans" | "serif" | "display" | "handwriting" | "mono";

export interface FontFamilyDef {
  family: string;
  category: FontCategory;
  /** Weights the Google Fonts css2 API serves for this family. */
  weights: readonly number[];
  italic?: boolean;
}

export const FONT_FAMILIES: readonly FontFamilyDef[] = [
  { family: "Geist", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Inter", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Fraunces", category: "serif", weights: [400, 500, 600, 700], italic: true },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700], italic: true },
  { family: "Source Sans 3", category: "sans", weights: [400, 500, 600, 700] },
  { family: "DM Serif Display", category: "serif", weights: [400], italic: true },
  { family: "DM Sans", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Space Grotesk", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Poppins", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Montserrat", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700], italic: true },
  { family: "Bricolage Grotesque", category: "display", weights: [400, 500, 600, 700] },
  { family: "Instrument Sans", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Instrument Serif", category: "serif", weights: [400], italic: true },
  { family: "Nunito", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Merriweather", category: "serif", weights: [400, 700], italic: true },
  { family: "Open Sans", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Sora", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Manrope", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Lexend", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Atkinson Hyperlegible", category: "sans", weights: [400, 700] },
  { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700] },
  { family: "Patrick Hand", category: "handwriting", weights: [400] },
  { family: "Roboto Slab", category: "serif", weights: [400, 500, 600, 700] },
  { family: "JetBrains Mono", category: "mono", weights: [400, 500, 600, 700] },
];

const FAMILY_BY_NAME = new Map(FONT_FAMILIES.map((font) => [font.family.toLowerCase(), font]));

export function findFontFamily(family: string): FontFamilyDef | undefined {
  return FAMILY_BY_NAME.get(family.trim().toLowerCase());
}

/** Weights the family actually serves, closest match for each request. */
export function servedWeights(family: string, requested: readonly number[]): number[] {
  const available = findFontFamily(family)?.weights ?? [400];
  const picked = requested.map((weight) =>
    available.reduce((best, candidate) => (Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best)),
  );
  return [...new Set(picked)].sort((a, b) => a - b);
}

/** Google Fonts css2 `family=` value, e.g. "Playfair+Display:wght@600;700". */
export function googleFamilyQuery(family: string, weights: readonly number[]): string {
  const name = family.trim().replace(/\s+/g, "+");
  const served = servedWeights(family, weights);
  if (served.length === 1 && served[0] === 400) return name;
  return `${name}:wght@${served.join(";")}`;
}

const BODY_WEIGHTS = [400, 500, 600, 700] as const;

function pair(
  id: string,
  name: string,
  heading: string,
  body: string,
  headingWeight: number,
  mood: string[],
  bodyWeight = 400,
): FontPair {
  const googleFamilies =
    heading === body
      ? [googleFamilyQuery(heading, [headingWeight, ...BODY_WEIGHTS])]
      : [googleFamilyQuery(heading, [headingWeight]), googleFamilyQuery(body, BODY_WEIGHTS)];
  return { id, name, heading, body, headingWeight, bodyWeight, googleFamilies, mood };
}

export const FONT_PAIRS: readonly FontPair[] = [
  pair("modern", "Modern", "Geist", "Geist", 600, ["clean", "product", "neutral"]),
  pair("editorial", "Editorial", "Fraunces", "Inter", 600, ["literary", "warm", "story"]),
  pair("classic", "Classic", "Playfair Display", "Source Sans 3", 600, ["formal", "history", "elegant"]),
  pair("elegant", "Elegant", "DM Serif Display", "DM Sans", 400, ["refined", "arts", "ceremony"]),
  pair("tech", "Tech", "Space Grotesk", "Inter", 600, ["science", "coding", "data"]),
  pair("friendly", "Friendly", "Poppins", "Poppins", 600, ["approachable", "primary", "bright"]),
  pair("magazine", "Magazine", "Montserrat", "Lora", 700, ["bold", "report", "newsletter"]),
  pair("bold", "Bold", "Bricolage Grotesque", "Instrument Sans", 700, ["punchy", "social", "launch"]),
  pair("playful", "Playful", "Nunito", "Nunito", 700, ["kids", "rounded", "fun"]),
  pair("academic", "Academic", "Merriweather", "Open Sans", 700, ["scholarly", "syllabus", "research"]),
  pair("clean", "Clean", "Sora", "Manrope", 600, ["minimal", "calm", "professional"]),
  pair("readable", "Readable", "Lexend", "Lexend", 600, ["accessible", "dyslexia-friendly", "clear"]),
  pair("handwritten", "Handwritten", "Caveat", "Nunito", 700, ["chalk", "notes", "personal"]),
];

export const DEFAULT_FONT_PAIR_ID = "modern";

const PAIR_BY_ID = new Map(FONT_PAIRS.map((fontPair) => [fontPair.id, fontPair]));

export function findFontPair(id: string | null | undefined): FontPair | undefined {
  return id ? PAIR_BY_ID.get(id) : undefined;
}

export function getFontPair(id: string | null | undefined): FontPair {
  return findFontPair(id) ?? (PAIR_BY_ID.get(DEFAULT_FONT_PAIR_ID) as FontPair);
}
