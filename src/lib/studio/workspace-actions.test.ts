import { describe, expect, it } from "vitest";
import {
  addSheetColumn,
  addSheetRow,
  csvToSheet,
  deleteSheetColumn,
  deleteSheetRow,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  sheetToCsv,
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
});
