import type { StudioItemKind } from "@/types";

export const STUDIO_TITLE_MAX_LENGTH = 160;
export const STUDIO_CONTENT_MAX_BYTES = 600_000;

const STUDIO_KINDS = new Set(["note", "doc", "sheet", "slide", "practice", "import", "design"]);
const STUDIO_STATUSES = new Set(["draft", "published", "archived"]);

export type StudioDocumentStatus = "draft" | "published" | "archived";

export function normalizeStudioKind(kind: unknown): Exclude<StudioItemKind, "lesson"> {
  const value = String(kind ?? "doc");
  if (value === "lesson") return "doc";
  return STUDIO_KINDS.has(value) ? (value as Exclude<StudioItemKind, "lesson">) : "doc";
}

export function validateStudioTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title) throw new Error("Title is required.");
  if (title.length > STUDIO_TITLE_MAX_LENGTH) {
    throw new Error(`Title must be ${STUDIO_TITLE_MAX_LENGTH} characters or fewer.`);
  }
  return title;
}

export function validateStudioStatus(
  value: unknown,
  options: { allowArchived?: boolean; fallback?: StudioDocumentStatus } = {},
): StudioDocumentStatus {
  const fallback = options.fallback ?? "draft";
  const allowArchived = options.allowArchived ?? true;
  if (value === undefined || value === null || value === "") return fallback;

  const status = String(value);
  if (!STUDIO_STATUSES.has(status) || (!allowArchived && status === "archived")) {
    throw new Error("Choose a supported Studio status.");
  }
  return status as StudioDocumentStatus;
}

export function validateStudioJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const json = JSON.stringify(value);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > STUDIO_CONTENT_MAX_BYTES) {
    throw new Error("Studio content is too large. Split it into smaller items before saving.");
  }

  return value as Record<string, unknown>;
}
