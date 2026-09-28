import { describe, expect, it } from "vitest";
import type { SceneDeck } from "./scene";
import { readStudioDocument, studioPlainText, writeStudioDocument } from "./document";

const deck: SceneDeck = {
  v: 2,
  id: "deck-1",
  title: "Science lesson",
  kind: "slides",
  formatId: "slides-16x9",
  width: 1280,
  height: 720,
  themeId: "classroom-daylight",
  pages: [{
    id: "page-1",
    background: { kind: "solid", color: "bg" },
    elements: [{ id: "title-1", kind: "text", role: "title", style: "title", text: "Water cycle", x: 0.1, y: 0.1, w: 0.8, h: 0.2 }],
  }],
};

describe("studio document", () => {
  it("round-trips a scene-v2 deck and derives searchable text", () => {
    const loaded = readStudioDocument(writeStudioDocument(deck));
    expect(loaded).toEqual({ deck, outline: undefined, convertedFromLegacy: false });
    expect(studioPlainText(deck)).toBe("Water cycle");
  });

  it("converts legacy Fabric objects, background, seed and notes without dropping pages", () => {
    const loaded = readStudioDocument({
      app: "EdSync Studio",
      version: 1,
      project: { id: "old-deck", title: "Old lesson", kind: "slide", width: 1280, height: 720 },
      pages: [
        {
          id: "old-1", name: "Opening", notes: "Explain slowly",
          snapshot: { objects: [
            { type: "rect", selectable: false, left: 0, top: 0, width: 1280, height: 720, fill: "#f1f1f1" },
            { type: "textbox", left: 128, top: 72, width: 640, height: 144, text: "The title", fontSize: 48, fill: "#222222" },
            { type: "circle", left: 960, top: 144, width: 100, height: 100, fill: "#ff0000" },
          ] },
        },
        { id: "old-2", seed: { title: "Second page", body: "Remaining content" }, snapshot: null },
      ],
    });
    expect(loaded?.convertedFromLegacy).toBe(true);
    expect(loaded?.deck.pages).toHaveLength(2);
    expect(loaded?.deck.pages[0].background).toEqual({ kind: "solid", color: "#f1f1f1" });
    expect(loaded?.deck.pages[0].notes).toBe("Explain slowly");
    expect(loaded?.deck.pages[0].elements).toMatchObject([{ kind: "text", text: "The title", x: 0.1, y: 0.1 }, { kind: "shape", shape: "circle" }]);
    expect(loaded?.deck.pages[1].elements).toMatchObject([{ kind: "text", text: "Second page" }, { kind: "text", text: "Remaining content" }]);
  });

  it("rejects unrelated and malformed payloads", () => {
    expect(readStudioDocument({ title: "A note" })).toBeNull();
    expect(readStudioDocument({ app: "EdSync Studio", version: 2, deck: { pages: [] } })).toBeNull();
    expect(readStudioDocument(writeStudioDocument({ ...deck, width: 0 }))).toBeNull();
    expect(readStudioDocument(writeStudioDocument({ ...deck, pages: [{ ...deck.pages[0], background: null }] } as unknown as SceneDeck))).toBeNull();
    expect(readStudioDocument(writeStudioDocument({ ...deck, pages: [{ ...deck.pages[0], elements: [{ id: "bad", kind: "text", text: "Missing geometry" }] }] } as unknown as SceneDeck))).toBeNull();
  });
});
