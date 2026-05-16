import { describe, expect, it } from "vitest";
import {
  addSheetColumn,
  addSheetRow,
  applySlideTheme,
  csvToSheet,
  deleteSheetColumn,
  deleteSheetRow,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  normalizeStudioSlide,
  sheetToCsv,
  updateSlide,
  updateSheetCell,
  type StudioSlideSummary,
} from "@/lib/studio/workspace-actions";

const slides: StudioSlideSummary[] = [
  { id: "one", title: "One", notes: "A", accent: "#2563eb" },
  { id: "two", title: "Two", notes: "B", accent: "#10b981" },
];

describe("Studio workspace actions", () => {
  it("updates sheet cells without mutating the original sheet", () => {
    const sheet = [["A", "B"]];
    const nextSheet = updateSheetCell(sheet, 0, 1, "C");

    expect(nextSheet).toEqual([["A", "C"]]);
    expect(sheet).toEqual([["A", "B"]]);
  });

  it("adds and deletes sheet rows and columns", () => {
    const sheet = [
      ["Name", "Score"],
      ["Ada", "9"],
    ];

    expect(addSheetRow(sheet, 0)).toEqual([
      ["Name", "Score"],
      ["", ""],
      ["Ada", "9"],
    ]);
    expect(addSheetColumn(sheet, 0)).toEqual([
      ["Name", "", "Score"],
      ["Ada", "", "9"],
    ]);
    expect(deleteSheetRow(sheet, 1)).toEqual([["Name", "Score"]]);
    expect(deleteSheetColumn(sheet, 1)).toEqual([["Name"], ["Ada"]]);
  });

  it("round-trips quoted CSV cells", () => {
    const sheet = [
      ["Prompt", "Answer"],
      ["Use commas, safely", 'Quote "inside"'],
    ];

    expect(csvToSheet(sheetToCsv(sheet))).toEqual(sheet);
  });

  it("duplicates, deletes, and moves slides", () => {
    const duplicated = duplicateSlide(slides, "one");

    expect(duplicated).toHaveLength(3);
    expect(duplicated[1].title).toBe("One copy");
    expect(deleteSlide(duplicated, duplicated[1].id)).toHaveLength(2);
    expect(moveSlide(slides, "two", "up").map((slide) => slide.id)).toEqual(["two", "one"]);
  });

  it("normalizes slide authoring metadata and applies themes without losing content", () => {
    const normalized = normalizeStudioSlide(slides[0]);
    expect(normalized.kind).toBe("content");
    expect(normalized.transition).toBe("fade");
    expect(normalized.animation).toBe("rise");

    const updated = updateSlide(slides, "one", {
      kind: "quiz",
      layout: "quiz",
      body: "What is the central idea?",
      transition: "slide_left",
      animation: "scale",
    });
    expect(updated[0]).toMatchObject({
      kind: "quiz",
      layout: "quiz",
      body: "What is the central idea?",
      transition: "slide_left",
      animation: "scale",
    });

    const themed = applySlideTheme(updated, { id: "focus-dark", colors: { primary: "#60a5fa" } });
    expect(themed[0]).toMatchObject({
      body: "What is the central idea?",
      accent: "#60a5fa",
      themeId: "focus-dark",
    });
  });
});
