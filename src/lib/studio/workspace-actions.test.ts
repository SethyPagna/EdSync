import { describe, expect, it } from "vitest";
import {
  addSheetColumn,
  addSheetRow,
  applySlideTheme,
  createDesignBlockInsert,
  createDesignTemplateInsert,
  createTextBlockInsert,
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
import { DESIGN_BLOCKS, DESIGN_TEMPLATES } from "@/lib/learning/design-system";

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

  it("creates rich editable inserts for text, templates, and design blocks", () => {
    const text = createTextBlockInsert("Quick check");
    const template = createDesignTemplateInsert(
      DESIGN_TEMPLATES.find((item) => item.id === "animation-pack") ?? DESIGN_TEMPLATES[0],
    );
    const block = createDesignBlockInsert(
      DESIGN_BLOCKS.find((item) => item.id === "ai-practice-loop") ?? DESIGN_BLOCKS[0],
    );

    expect(text.html).toContain("data-edsync-insert");
    expect(template.html).toContain("data-edsync-design-template");
    expect(template.html).toContain("Reusable blocks");
    expect(block.html).toContain("data-edsync-design-block");
    expect(block.html).toContain("retry missed");
    expect(block.plainText).toContain("AI Practice Loop");
  });
});
