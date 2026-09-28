import type { SceneDeck, SceneElement } from "@/lib/studio/scene";
import { studioId, useStudio } from "../../store";

export const STUDIO_ELEMENT_DRAG_MIME = "application/x-edsync-studio-elements";

export function centeredBox(deck: Pick<SceneDeck, "width" | "height">, width = 0.36, aspect = 1) {
  const naturalHeight = (width * deck.width) / (Math.max(0.1, aspect) * deck.height);
  const height = Math.min(0.66, naturalHeight);
  const fittedWidth = width * (height / naturalHeight);
  return { x: (1 - fittedWidth) / 2, y: (1 - height) / 2, w: fittedWidth, h: height };
}

export function newElementId(): string {
  return studioId("el");
}

export function insertElements(elements: readonly SceneElement[]): void {
  const state = useStudio.getState();
  if (!state.deck || !state.activePageId) return;
  state.addElements([...elements], state.activePageId);
}

export function writeElementDrag(event: React.DragEvent<HTMLElement>, elements: readonly SceneElement[]): void {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(STUDIO_ELEMENT_DRAG_MIME, JSON.stringify({ v: 1, elements }));
  event.dataTransfer.setData("text/plain", "Add to design");
}
