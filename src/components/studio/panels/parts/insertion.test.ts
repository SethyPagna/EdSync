import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneDeck, SceneElement } from "@/lib/studio/scene";
import { createBlankDeck, useStudio } from "../../store";
import { STUDIO_ELEMENT_DRAG_MIME, centeredBox, insertElements, writeElementDrag } from "./insertion";

describe("Studio panel insertion", () => {
  beforeEach(() => useStudio.getState().replaceDeck(createBlankDeck()));

  it("keeps wide and portrait assets centered and inside the page without stretching", () => {
    for (const aspect of [0.5, 1, 2.5]) {
      const box = centeredBox({ width: 1280, height: 720 }, 0.58, aspect);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1);
      expect(box.y + box.h).toBeLessThanOrEqual(1);
      expect((box.w * 1280) / (box.h * 720)).toBeCloseTo(aspect, 5);
    }
  });

  it("inserts a multi-element kit on the active page and selects every part", () => {
    const deck = useStudio.getState().deck as SceneDeck;
    const elements: SceneElement[] = [
      { id: "kit-1", kind: "shape", role: "card", shape: "rounded", x: 0.1, y: 0.2, w: 0.4, h: 0.3, group: "kit" },
      { id: "kit-2", kind: "text", role: "body", style: "body", text: "Hello", x: 0.15, y: 0.25, w: 0.3, h: 0.1, group: "kit" },
    ];
    insertElements(elements);
    const state = useStudio.getState();
    expect(state.deck?.pages[0].elements).toEqual(elements);
    expect(state.selectionIds).toEqual(["kit-1", "kit-2"]);
    expect(state.deck?.id).toBe(deck.id);
  });

  it("uses the canvas drag contract with complete scene elements", () => {
    const element: SceneElement = { id: "shape-1", kind: "shape", role: "shape", shape: "circle", x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
    const setData = vi.fn();
    const event = { dataTransfer: { setData, effectAllowed: "none" } } as unknown as Parameters<typeof writeElementDrag>[0];
    writeElementDrag(event, [element]);
    expect(event.dataTransfer.effectAllowed).toBe("copy");
    expect(JSON.parse(setData.mock.calls.find(([mime]) => mime === STUDIO_ELEMENT_DRAG_MIME)?.[1] as string)).toEqual({ v: 1, elements: [element] });
  });
});
