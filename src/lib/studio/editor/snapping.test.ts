import { describe, expect, it } from "vitest";
import { snapElementPosition, type SnapRect } from "./snapping";

const rect = (id: string, x: number, y: number, w: number, h: number, hidden = false): SnapRect => ({
  id,
  x,
  y,
  w,
  h,
  hidden,
});

describe("snapElementPosition", () => {
  it("centers an element on both page axes without mutating its geometry", () => {
    const moving = rect("moving", 0.446, 0.454, 0.1, 0.1);

    const result = snapElementPosition(moving, []);

    expect(result.x).toBeCloseTo(0.45);
    expect(result.y).toBeCloseTo(0.45);
    expect(result.guides).toEqual([
      { kind: "alignment", axis: "x", at: 0.5, source: "page", movingAnchor: "center", targetAnchor: "center" },
      { kind: "alignment", axis: "y", at: 0.5, source: "page", movingAnchor: "center", targetAnchor: "center" },
    ]);
    expect(moving).toEqual(rect("moving", 0.446, 0.454, 0.1, 0.1));
  });

  it("snaps to the left and bottom page edges", () => {
    const result = snapElementPosition(rect("moving", 0.004, 0.696, 0.2, 0.3), []);

    expect(result.x).toBe(0);
    expect(result.y).toBeCloseTo(0.7);
    expect(result.guides).toMatchObject([
      { kind: "alignment", axis: "x", at: 0, movingAnchor: "start" },
      { kind: "alignment", axis: "y", at: 1, movingAnchor: "end" },
    ]);
  });

  it("aligns moving edges to peer edges", () => {
    const result = snapElementPosition(
      rect("moving", 0.405, 0.205, 0.1, 0.1),
      [rect("peer", 0.2, 0.2, 0.2, 0.2)],
    );

    expect(result.x).toBeCloseTo(0.4);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.guides).toMatchObject([
      { kind: "alignment", axis: "x", source: "peer", targetId: "peer", movingAnchor: "start", targetAnchor: "end" },
      { kind: "alignment", axis: "y", source: "peer", targetId: "peer", movingAnchor: "start", targetAnchor: "start" },
    ]);
  });

  it("aligns moving centers to peer centers", () => {
    const result = snapElementPosition(
      rect("moving", 0.252, 0.248, 0.1, 0.1),
      [rect("peer", 0.2, 0.2, 0.2, 0.2)],
    );

    expect(result.x).toBeCloseTo(0.25);
    expect(result.y).toBeCloseTo(0.25);
    expect(result.guides).toMatchObject([
      { kind: "alignment", axis: "x", source: "peer", movingAnchor: "center", targetAnchor: "center" },
      { kind: "alignment", axis: "y", source: "peer", movingAnchor: "center", targetAnchor: "center" },
    ]);
  });

  it("places an element equally between its nearest horizontal neighbors", () => {
    const result = snapElementPosition(
      rect("moving", 0.426, 0.2, 0.1, 0.1),
      [rect("left", 0.08, 0.2, 0.2, 0.1), rect("right", 0.68, 0.2, 0.2, 0.1)],
    );

    expect(result.x).toBeCloseTo(0.43);
    expect(result.guides.find((guide) => guide.axis === "x")).toEqual({
      kind: "spacing",
      axis: "x",
      gap: expect.closeTo(0.15),
      arrangement: "between",
      peerIds: ["left", "right"],
      segments: [
        { from: 0.28, to: expect.closeTo(0.43) },
        { from: expect.closeTo(0.53), to: 0.68 },
      ],
    });
  });

  it("places an element equally between its nearest vertical neighbors", () => {
    const result = snapElementPosition(
      rect("moving", 0.365, 0.42, 0.1, 0.1),
      [rect("top", 0.3, 0.1, 0.2, 0.15), rect("bottom", 0.3, 0.7, 0.2, 0.1)],
    );

    expect(result.y).toBeCloseTo(0.425);
    expect(result.guides.find((guide) => guide.axis === "y")).toMatchObject({
      kind: "spacing",
      axis: "y",
      arrangement: "between",
      peerIds: ["top", "bottom"],
      gap: expect.closeTo(0.175),
    });
  });

  it("repeats the gap between two previous peers", () => {
    const result = snapElementPosition(
      rect("moving", 0.496, 0.3, 0.1, 0.1),
      [rect("far", 0.1, 0.3, 0.1, 0.1), rect("near", 0.3, 0.3, 0.1, 0.1)],
    );

    expect(result.x).toBeCloseTo(0.5);
    expect(result.guides.find((guide) => guide.axis === "x")).toMatchObject({
      kind: "spacing",
      arrangement: "after",
      peerIds: ["far", "near"],
      gap: expect.closeTo(0.1),
    });
  });

  it("repeats the gap between two following peers", () => {
    const result = snapElementPosition(
      rect("moving", 0.304, 0.3, 0.1, 0.1),
      [rect("near", 0.5, 0.3, 0.1, 0.1), rect("far", 0.7, 0.3, 0.1, 0.1)],
    );

    expect(result.x).toBeCloseTo(0.3);
    expect(result.guides.find((guide) => guide.axis === "x")).toMatchObject({
      kind: "spacing",
      arrangement: "before",
      peerIds: ["near", "far"],
      gap: expect.closeTo(0.1),
    });
  });

  it("ignores hidden, self, and off-row peers and respects the threshold", () => {
    const moving = rect("moving", 0.426, 0.6, 0.1, 0.1);
    const result = snapElementPosition(moving, [
      rect("moving", 0.424, 0.6, 0.1, 0.1),
      rect("hidden", 0.425, 0.6, 0.1, 0.1, true),
      rect("left", 0.08, 0.1, 0.2, 0.1),
      rect("right", 0.68, 0.1, 0.2, 0.1),
    ]);

    expect(result).toEqual({ x: moving.x, y: moving.y, guides: [] });
    expect(snapElementPosition(rect("moving", 0.012, 0.3, 0.1, 0.1), [], { threshold: 0.005 }).x).toBe(0.012);
  });
});
