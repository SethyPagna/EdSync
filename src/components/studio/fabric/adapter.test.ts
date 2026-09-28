import { describe, expect, it } from "vitest";
import type { SceneElement } from "@/lib/studio/scene";
import { elementFrame, fabricFrameToElement } from "./adapter";

const source: SceneElement = { id: "shape-1", kind: "shape", role: "shape", shape: "rect", x: 0.25, y: 0.2, w: 0.5, h: 0.3 };
const deck = { width: 1280, height: 720 };

describe("Fabric geometry mapping", () => {
  it("converts normalized geometry to design pixels", () => {
    expect(elementFrame(source, deck)).toMatchObject({ left: 320, top: 144, width: 640, height: 216 });
  });

  it("writes Fabric movement and rotation back to scene geometry", () => {
    const changed = fabricFrameToElement({
      left: 640,
      top: 180,
      angle: 20,
      opacity: 0.5,
      visible: true,
      getScaledWidth: () => 320,
      getScaledHeight: () => 180,
    }, source, deck);
    expect(changed).toMatchObject({ id: "shape-1", x: 0.5, y: 0.25, w: 0.25, h: 0.25, rotation: 20, opacity: 0.5, edited: true });
  });
});
