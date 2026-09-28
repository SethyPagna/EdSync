// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { StudioServerItem } from "@/lib/studio/api";
import type { SceneDeck } from "@/lib/studio/scene";
import { duplicateInput, filterStudioItems, itemGroup, recentLabel, renameInput } from "./model";

const deck: SceneDeck = {
  v: 2, id: "deck-1", title: "Lesson", kind: "slides", formatId: "slides-16x9", width: 1280, height: 720, themeId: "porcelain",
  pages: [{ id: "p1", background: { kind: "solid", color: "bg" }, elements: [{ id: "t1", kind: "text", role: "title", x: 0, y: 0, w: 1, h: 0.1, style: "title", text: "Water" }] }],
};
const item: StudioServerItem = {
  id: "item-1", kind: "slide", title: "Lesson", content: { app: "EdSync Studio", version: 2, deck }, plainText: "Water", status: "published",
  sourceType: "class", sourceId: "class-9", metadata: { classId: "class-9" }, createdAt: "2026-09-27 12:00:00", updatedAt: "2026-09-28 12:00:00",
};

describe("Studio hub model", () => {
  it("filters recent designs by group and title/content", () => {
    const social = { ...item, id: "social", kind: "design" as const, title: "Post", content: { ...item.content, deck: { ...deck, kind: "social", formatId: "ig-square" } }, updatedAt: "2026-09-29 12:00:00" };
    expect(itemGroup(social)).toBe("social");
    expect(filterStudioItems([item, social], "all", "").map((entry) => entry.id)).toEqual(["social", "item-1"]);
    expect(filterStudioItems([item, social], "slides", "water").map((entry) => entry.id)).toEqual(["item-1"]);
  });

  it("copies a design as a draft while keeping class assignment", () => {
    const copy = duplicateInput(item, "deck-2");
    expect(copy.status).toBe("draft");
    expect(copy.sourceType).toBe("class");
    expect(copy.sourceId).toBe("class-9");
    expect(copy.metadata.classId).toBe("class-9");
    expect((copy.content.deck as SceneDeck).id).toBe("deck-2");
    expect((copy.content.deck as SceneDeck).title).toBe("Lesson copy");
    expect(deck.id).toBe("deck-1");
  });

  it("renames both the server item and its scene deck", () => {
    const next = renameInput(item, "New name");
    expect(next.title).toBe("New name");
    expect((next.content?.deck as SceneDeck).title).toBe("New name");
  });

  it("treats SQLite timestamps as UTC", () => {
    expect(recentLabel("2026-09-28 12:00:00", Date.parse("2026-09-28T12:02:00Z"))).toMatch(/2 min/);
  });
});
