import type { SceneDeck, ScenePage } from "@/lib/studio/scene";
import { syncFabricPage } from "./adapter";

export async function renderPageImage(page: ScenePage, deck: SceneDeck, options: { scale?: number; format?: "png" | "jpeg" } = {}): Promise<string> {
  if (typeof document === "undefined") throw new Error("Image export is available in the browser.");
  const fabric = await import("fabric");
  const element = document.createElement("canvas");
  element.width = deck.width;
  element.height = deck.height;
  const canvas = new fabric.StaticCanvas(element, { width: deck.width, height: deck.height, renderOnAddRemove: false, enableRetinaScaling: false });
  try {
    await syncFabricPage(canvas, page, deck);
    canvas.renderAll();
    return canvas.toDataURL({ format: options.format ?? "png", multiplier: Math.max(0.25, Math.min(options.scale ?? 1, 4)) });
  } finally {
    await canvas.dispose();
  }
}
