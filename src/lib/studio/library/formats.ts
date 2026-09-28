import type { FormatDef } from "@/lib/studio/scene";

export type FormatGroupId = FormatDef["group"];

export interface LibraryFormat extends FormatDef {
  /** Short size label for pickers, e.g. "1280 × 720". */
  size: string;
  description: string;
}

type Row = [id: string, name: string, group: FormatGroupId, kind: FormatDef["kind"], width: number, height: number, description: string];

const ROWS: Row[] = [
  ["slides-16x9", "Presentation 16:9", "presentation", "slides", 1280, 720, "Widescreen slides, video calls"],
  ["slides-4x3", "Presentation 4:3", "presentation", "slides", 1024, 768, "Classic projector slides"],
  ["slides-16x10", "Presentation 16:10", "presentation", "slides", 1280, 800, "Laptop-native slides"],
  ["slides-9x16", "Vertical 9:16", "presentation", "slides", 720, 1280, "Phone-first lessons, reels"],
  ["slides-1x1", "Square 1:1", "presentation", "slides", 1080, 1080, "Carousels and square decks"],
  ["slides-ultrawide", "Ultrawide 21:9", "presentation", "slides", 2100, 900, "Wide screens and banners"],
  ["doc-a4", "A4", "document", "doc", 794, 1123, "Handouts, reports, notes"],
  ["doc-a4-landscape", "A4 landscape", "document", "doc", 1123, 794, "Wide handouts and tables"],
  ["doc-letter", "US Letter", "document", "doc", 816, 1056, "Worksheets and essays"],
  ["doc-letter-landscape", "Letter landscape", "document", "doc", 1056, 816, "Wide printables"],
  ["doc-legal", "US Legal", "document", "doc", 816, 1344, "Long forms and outlines"],
  ["doc-a5", "A5", "document", "doc", 559, 794, "Booklets and exit tickets"],
  ["doc-a3", "A3", "document", "doc", 1123, 1587, "Large printables"],
  ["ig-square", "Instagram post", "social", "social", 1080, 1080, "Square feed post"],
  ["ig-portrait", "Instagram portrait", "social", "social", 1080, 1350, "Portrait post, carousels"],
  ["ig-story", "Story", "social", "social", 1080, 1920, "Stories, reels, shorts"],
  ["linkedin-post", "LinkedIn post", "social", "social", 1200, 627, "Link and feed image"],
  ["linkedin-banner", "LinkedIn banner", "social", "social", 1584, 396, "Profile background"],
  ["x-header", "X header", "social", "social", 1500, 500, "Profile header"],
  ["youtube-thumbnail", "YouTube thumbnail", "social", "social", 1280, 720, "Video thumbnail"],
  ["facebook-cover", "Facebook cover", "social", "social", 820, 312, "Page cover photo"],
  ["poster", "Poster", "print", "design", 1200, 1800, "Classroom and event posters"],
  ["flyer", "Flyer", "print", "design", 816, 1056, "Letter-size flyers"],
  ["certificate", "Certificate", "print", "design", 1123, 794, "Awards and certificates"],
  ["whiteboard", "Whiteboard", "board", "design", 1600, 900, "Brainstorms and mind maps"],
  ["kanban", "Kanban board", "board", "design", 1400, 900, "Columns for tasks and projects"],
];

export const FORMATS: readonly LibraryFormat[] = ROWS.map(([id, name, group, kind, width, height, description]) => ({
  id,
  name,
  group,
  kind,
  width,
  height,
  size: `${width} × ${height}`,
  description,
}));

export const DEFAULT_FORMAT_ID = "slides-16x9";

const BY_ID = new Map(FORMATS.map((format) => [format.id, format]));

export function findFormat(id: string | null | undefined): LibraryFormat | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Unknown ids fall back to the default 16:9 presentation. */
export function getFormat(id: string | null | undefined): LibraryFormat {
  return findFormat(id) ?? (BY_ID.get(DEFAULT_FORMAT_ID) as LibraryFormat);
}

export const FORMAT_GROUPS: readonly { id: FormatGroupId; name: string; formats: readonly LibraryFormat[] }[] = (
  [
    ["presentation", "Presentations"],
    ["document", "Documents"],
    ["social", "Social"],
    ["print", "Print"],
    ["board", "Boards"],
  ] as const
).map(([id, name]) => ({ id, name, formats: FORMATS.filter((format) => format.group === id) }));

export type Orientation = "landscape" | "portrait" | "square";

export function formatOrientation(format: Pick<FormatDef, "width" | "height">): Orientation {
  const ratio = format.width / format.height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return "square";
}

/** Finds a library format with the same pixel size, if any. */
export function formatForSize(width: number, height: number): LibraryFormat | undefined {
  return FORMATS.find((format) => format.width === width && format.height === height);
}
