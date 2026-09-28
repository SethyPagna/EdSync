import { beforeEach, describe, expect, it } from "vitest";
import type { SceneDeck, SceneElement } from "@/lib/studio/scene";
import { useStudio } from "./store";

const first: SceneElement = { id: "one", kind: "shape", role: "shape", shape: "rect", x: 0.1, y: 0.1, w: 0.2, h: 0.2, fill: "accent" };
const second: SceneElement = { id: "two", kind: "shape", role: "shape", shape: "rect", x: 0.5, y: 0.4, w: 0.2, h: 0.2, fill: "accent" };
const base: SceneDeck = {
  v: 2,
  id: "deck-test",
  title: "Test",
  kind: "slides",
  formatId: "slides-16x9",
  width: 1280,
  height: 720,
  themeId: "classroom-daylight",
  pages: [
    { id: "page-one", background: { kind: "solid", color: "bg" }, elements: [first, second] },
    { id: "page-two", background: { kind: "solid", color: "bg" }, elements: [] },
  ],
};

beforeEach(() => useStudio.getState().replaceDeck(structuredClone(base)));

describe("studio store", () => {
  it("keeps a per-deck undo history across page switches", () => {
    const state = useStudio.getState();
    state.updateElement("one", { x: 0.3 });
    state.setActivePage("page-two");
    state.addPage();
    expect(useStudio.getState().deck?.pages).toHaveLength(3);
    useStudio.getState().undo();
    expect(useStudio.getState().deck?.pages).toHaveLength(2);
    useStudio.getState().undo();
    expect(useStudio.getState().deck?.pages[0].elements[0].x).toBe(0.1);
    useStudio.getState().redo();
    expect(useStudio.getState().deck?.pages[0].elements[0].x).toBe(0.3);
  });

  it("marks edits and leaves locked elements unchanged", () => {
    useStudio.getState().lockElements(true, ["one"]);
    const historyBefore = useStudio.getState().history.past.length;
    useStudio.getState().updateElement("one", { x: 0.9 });
    const element = useStudio.getState().deck?.pages[0].elements[0];
    expect(element).toMatchObject({ x: 0.1, locked: true, edited: true });
    expect(useStudio.getState().history.past).toHaveLength(historyBefore);
  });

  it("duplicates elements with new ids and can group them", () => {
    useStudio.getState().duplicateElements(["one", "two"]);
    const copies = useStudio.getState().deck!.pages[0].elements.slice(2);
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map((element) => element.id)).size).toBe(2);
    useStudio.getState().groupElements(copies.map((element) => element.id));
    const grouped = useStudio.getState().deck!.pages[0].elements.slice(2);
    expect(grouped[0].group).toBeTruthy();
    expect(grouped[0].group).toBe(grouped[1].group);
  });

  it("aligns selected elements and preserves their IDs", () => {
    useStudio.getState().alignElements("left", ["one", "two"]);
    const elements = useStudio.getState().deck!.pages[0].elements;
    expect(elements.map((element) => element.id)).toEqual(["one", "two"]);
    expect(elements.map((element) => element.x)).toEqual([0.1, 0.1]);
  });

  it("preserves spaces while typing a title and coalesces the edits into one undo step", () => {
    useStudio.getState().renameDeck("My ");
    useStudio.getState().renameDeck("My design");
    expect(useStudio.getState().deck?.title).toBe("My design");
    expect(useStudio.getState().history.past).toHaveLength(1);
    useStudio.getState().undo();
    expect(useStudio.getState().deck?.title).toBe("Test");
  });

  it("can reset brand color overrides", () => {
    useStudio.getState().setColorOverrides({ accent: "#123456" });
    expect(useStudio.getState().deck?.colorOverrides?.accent).toBe("#123456");
    useStudio.getState().setColorOverrides({});
    expect(useStudio.getState().deck?.colorOverrides).toEqual({});
  });

  it("can undo a template replacement without restoring another document's history", () => {
    const replacement = { ...structuredClone(base), title: "Template", pages: [structuredClone(base.pages[1])] };
    useStudio.getState().replaceDeck(replacement, { recordHistory: true });
    expect(useStudio.getState().deck?.title).toBe("Template");
    expect(useStudio.getState().history.past).toHaveLength(1);
    useStudio.getState().undo();
    expect(useStudio.getState().deck?.pages).toHaveLength(2);
    expect(useStudio.getState().deck?.title).toBe("Test");
    useStudio.getState().replaceDeck({ ...replacement, id: "other-document" });
    expect(useStudio.getState().history.past).toHaveLength(0);
  });

  it("inserts a panel kit as one undoable edit", () => {
    const kit = [
      { ...first, id: "kit-one" },
      { ...second, id: "kit-two" },
    ];
    useStudio.getState().addElements(kit);
    expect(useStudio.getState().deck?.pages[0].elements).toHaveLength(4);
    expect(useStudio.getState().selectionIds).toEqual(["kit-one", "kit-two"]);
    expect(useStudio.getState().history.past).toHaveLength(1);
    useStudio.getState().undo();
    expect(useStudio.getState().deck?.pages[0].elements).toHaveLength(2);
  });
});
