import type { SceneElement } from "@/lib/studio/scene";

const KINDS = new Set<SceneElement["kind"]>(["text", "shape", "image", "icon", "chart", "table"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isSceneElement(value: unknown): value is SceneElement {
  if (!value || typeof value !== "object") return false;
  const element = value as Record<string, unknown>;
  return typeof element.id === "string" && element.id.length > 0 &&
    typeof element.kind === "string" && KINDS.has(element.kind as SceneElement["kind"]) &&
    ["x", "y", "w", "h"].every((key) => typeof element[key] === "number" && Number.isFinite(element[key])) &&
    Number(element.x) >= 0 && Number(element.y) >= 0 &&
    Number(element.w) > 0 && Number(element.h) > 0 &&
    Number(element.x) + Number(element.w) <= 1.001 &&
    Number(element.y) + Number(element.h) <= 1.001;
}

export function placeDraggedElements(raw: string, pointer: { x: number; y: number }): SceneElement[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const payload = parsed as { v?: unknown; elements?: unknown };
  if (payload.v !== 1 || !Array.isArray(payload.elements) || payload.elements.length === 0 || payload.elements.length > 100 ||
      !payload.elements.every(isSceneElement)) return [];

  const elements = payload.elements as SceneElement[];
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.w));
  const bottom = Math.max(...elements.map((element) => element.y + element.h));
  const groupWidth = right - left;
  const groupHeight = bottom - top;
  const offsetX = clamp(pointer.x - groupWidth / 2, 0, 1 - groupWidth) - left;
  const offsetY = clamp(pointer.y - groupHeight / 2, 0, 1 - groupHeight) - top;
  return elements.map((element) => ({ ...element, x: element.x + offsetX, y: element.y + offsetY }));
}
