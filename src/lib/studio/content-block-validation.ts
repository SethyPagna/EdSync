import { validateStudioJsonObject, validateStudioTitle } from "@/lib/studio/validation";

const CONTENT_BLOCK_TYPES = new Set([
  "rich_text",
  "sheet",
  "slide_deck",
  "practice_set",
  "design_template",
  "lesson_section",
]);

const CONTENT_BLOCK_STATUSES = new Set(["draft", "published", "archived"]);
const MAX_CONTENT_BLOCK_TAGS = 12;
const MAX_CONTENT_BLOCK_TAG_LENGTH = 32;

export type ContentBlockStatus = "draft" | "published" | "archived";

export function normalizeContentBlockType(value: unknown) {
  const blockType = String(value ?? "rich_text").trim();
  return CONTENT_BLOCK_TYPES.has(blockType) ? blockType : "rich_text";
}

export function normalizeContentBlockStatus(value: unknown): ContentBlockStatus {
  const status = String(value ?? "draft").trim();
  return CONTENT_BLOCK_STATUSES.has(status) ? (status as ContentBlockStatus) : "draft";
}

export function validateContentBlockTitle(value: unknown) {
  return validateStudioTitle(value);
}

export function validateContentBlockData(value: unknown) {
  return validateStudioJsonObject(value);
}

export function normalizeContentBlockTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const tag of value) {
    const normalized = String(tag ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, MAX_CONTENT_BLOCK_TAG_LENGTH);

    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
    if (tags.length >= MAX_CONTENT_BLOCK_TAGS) break;
  }

  return tags;
}
