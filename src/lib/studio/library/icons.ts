import { ICON_DATA, type IconCategoryId, type IconDef } from "./icon-data";

export type { IconCategoryId, IconDef } from "./icon-data";

export const ICONS: readonly IconDef[] = ICON_DATA;

export const ICON_CATEGORIES: readonly { id: IconCategoryId; name: string }[] = [
  { id: "education", name: "Education" },
  { id: "science", name: "Science" },
  { id: "math", name: "Math" },
  { id: "arts", name: "Arts & media" },
  { id: "communication", name: "Communication" },
  { id: "people", name: "People" },
  { id: "data", name: "Charts & data" },
  { id: "status", name: "Status" },
  { id: "arrows", name: "Arrows" },
  { id: "time", name: "Time" },
  { id: "nature", name: "Nature" },
  { id: "places", name: "Places & travel" },
  { id: "tech", name: "Tech" },
  { id: "rewards", name: "Rewards" },
  { id: "objects", name: "Objects" },
];

const ICON_BY_KEY = new Map<string, IconDef>();
for (const icon of ICONS) {
  ICON_BY_KEY.set(icon.id, icon);
  for (const alias of icon.aliases ?? []) if (!ICON_BY_KEY.has(alias)) ICON_BY_KEY.set(alias, icon);
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_]+/g, "-");

/** Looks up an icon by id or alias (case and spacing tolerant). */
export function getIcon(id: string | null | undefined): IconDef | undefined {
  return id ? ICON_BY_KEY.get(normalize(id)) : undefined;
}

export function iconsInCategory(category: IconCategoryId): IconDef[] {
  return ICONS.filter((icon) => icon.category === category);
}

/** Ranked search over id, name, aliases, keywords and category. Empty query returns everything. */
export function searchIcons(query: string, limit = Infinity): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICONS.slice(0, limit);
  const slug = normalize(q);
  const scored: { icon: IconDef; score: number }[] = [];
  for (const icon of ICONS) {
    const name = icon.name.toLowerCase();
    let score = 0;
    if (icon.id === slug || name === q || icon.aliases?.includes(slug)) score = 100;
    else if (icon.id.startsWith(slug) || name.startsWith(q)) score = 50;
    else if (icon.id.includes(slug) || name.includes(q)) score = 30;
    else if (icon.keywords.some((keyword) => keyword.startsWith(q))) score = 20;
    else if (icon.keywords.some((keyword) => keyword.includes(q)) || icon.category.startsWith(q)) score = 10;
    if (score > 0) scored.push({ icon, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name))
    .slice(0, limit)
    .map((entry) => entry.icon);
}

export interface IconSvgOptions {
  color?: string;
  strokeWidth?: number;
  size?: number;
  /** Fill for closed paths; "none" keeps the outline look. */
  fill?: string;
}

const attr = (value: string) => value.replace(/["<>]/g, "");

/** Standalone, self-colored SVG markup for an icon, or null for unknown ids. */
export function iconSvg(id: string, options: IconSvgOptions = {}): string | null {
  const icon = getIcon(id);
  if (!icon) return null;
  const color = attr(options.color ?? "currentColor");
  const size = options.size ?? 24;
  const strokeWidth = options.strokeWidth ?? 2;
  const fill = attr(options.fill ?? "none");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="${fill}" stroke="${color}" color="${color}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${icon.paths}</svg>`
  );
}

/** `data:` URL of `iconSvg`, for <img> tags and Fabric image loading. */
export function iconDataUrl(id: string, options: IconSvgOptions = {}): string | null {
  const svg = iconSvg(id, options);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
