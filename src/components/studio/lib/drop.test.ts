import { describe, expect, it } from "vitest";
import { placeDraggedElements } from "./drop";

const elements = [
  { id: "one", kind: "shape", role: "shape", shape: "rect", x: 0.1, y: 0.2, w: 0.2, h: 0.2 },
  { id: "two", kind: "shape", role: "shape", shape: "circle", x: 0.35, y: 0.25, w: 0.1, h: 0.1 },
];

describe("Studio panel drag placement", () => {
  it("moves a kit as one group to the pointer", () => {
    const placed = placeDraggedElements(JSON.stringify({ v: 1, elements }), { x: 0.75, y: 0.7 });
    expect(placed).toHaveLength(2);
    expect(placed[0].x).toBeCloseTo(0.575);
    expect(placed[0].y).toBeCloseTo(0.6);
    expect(placed[1].x - placed[0].x).toBeCloseTo(0.25);
  });

  it("keeps the group inside the page near an edge", () => {
    const placed = placeDraggedElements(JSON.stringify({ v: 1, elements }), { x: 1, y: 1 });
    expect(Math.max(...placed.map((element) => element.x + element.w))).toBeCloseTo(1);
    expect(Math.max(...placed.map((element) => element.y + element.h))).toBeCloseTo(1);
  });

  it("rejects malformed or non-scene drag data", () => {
    expect(placeDraggedElements("not json", { x: 0.5, y: 0.5 })).toEqual([]);
    expect(placeDraggedElements(JSON.stringify({ v: 1, elements: [{ ...elements[0], x: Infinity }] }), { x: 0.5, y: 0.5 })).toEqual([]);
  });
});
