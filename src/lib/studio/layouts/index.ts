import type { LayoutDef } from "../scene";
import { BOARD_LAYOUTS } from "./boards";
import { COMPARE_LAYOUTS } from "./compare";
import { DOC_LAYOUTS } from "./docs";
import { HERO_LAYOUTS } from "./hero";
import { LEARNING_LAYOUTS } from "./learning";
import { LIST_LAYOUTS } from "./lists";
import { MEDIA_LAYOUTS } from "./media";
import { SEQUENCE_LAYOUTS } from "./sequence";

/** Every auto-layout, in a stable order (the order is the final tie-break). */
export const LAYOUTS: readonly LayoutDef[] = [
  ...HERO_LAYOUTS,
  ...LIST_LAYOUTS,
  ...SEQUENCE_LAYOUTS,
  ...COMPARE_LAYOUTS,
  ...MEDIA_LAYOUTS,
  ...LEARNING_LAYOUTS,
  ...BOARD_LAYOUTS,
  ...DOC_LAYOUTS,
];

export const LAYOUT_IDS: readonly string[] = LAYOUTS.map((layout) => layout.id);

const byId = new Map(LAYOUTS.map((layout) => [layout.id, layout]));

export function getLayout(id: string | undefined | null): LayoutDef | undefined {
  return id ? byId.get(id) : undefined;
}

export { FALLBACK_LAYOUT_ID, FLOW_LAYOUT_ID, HERO_LAYOUT_IDS } from "./ids";

export { createKit, defineLayout, hashString, seededRandom, analyze, orientationOf } from "./kit";
export type { ContentShape, EngineContent, EngineContext, LayoutSpec } from "./kit";
