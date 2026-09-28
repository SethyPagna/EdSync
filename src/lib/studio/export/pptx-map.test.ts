import { describe, expect, it } from "vitest";
import type { SceneDeck, TextElement, ShapeElement, ChartElement, TableElement } from "@/lib/studio/scene";
import { elementBox, mapChart, mapShape, mapTable, mapText, pptxColor, slideSize } from "./pptx-map";

const deck: SceneDeck = {
  v: 2, id: "deck", title: "Lesson", kind: "slides", formatId: "slides-16x9", width: 1280, height: 720,
  themeId: "porcelain", pages: [],
};
const base = { id: "one", role: "body" as const, x: 0.1, y: 0.2, w: 0.5, h: 0.3 };

describe("PowerPoint scene mapping", () => {
  it("keeps normalized layout and maps text styling to editable text", () => {
    const text: TextElement = { ...base, kind: "text", text: "Learning", style: "heading", color: "accent", fontSize: 40, fontWeight: 700, italic: true, align: "center", list: "bullet" };
    const size = slideSize(deck);
    expect(size.width).toBe(13.333);
    const box = elementBox(text, size);
    expect(box.x).toBeCloseTo(1.3333, 4);
    expect(box.y).toBeCloseTo(1.5, 4);
    expect(box.w).toBeCloseTo(6.6665, 4);
    expect(box.h).toBeCloseTo(2.25, 3);
    const options = mapText(text, deck);
    expect(options.fontSize).toBeCloseTo(30, 1);
    expect(options.bold).toBe(true);
    expect(options.italic).toBe(true);
    expect(options.align).toBe("center");
    expect(options.bullet).toEqual(expect.objectContaining({ type: "bullet" }));
    expect(options.color).toMatch(/^[0-9A-F]{6}$/);
  });

  it("maps native shapes, including arrows and custom fallback", () => {
    const line: ShapeElement = { ...base, kind: "shape", role: "line", shape: "arrow-line", stroke: "#123456", strokeWidth: 3 };
    expect(mapShape(line, deck)?.type).toBe("line");
    expect(mapShape(line, deck)?.options.line).toEqual(expect.objectContaining({ color: "123456", endArrowType: "triangle" }));
    expect(mapShape({ ...line, shape: "blob" }, deck)).toBeNull();
  });

  it("creates editable chart series and table rows", () => {
    const chart: ChartElement = { ...base, kind: "chart", role: "chart", chart: "column", data: [{ label: "A", value: 2 }, { label: "B", value: 5 }] };
    expect(mapChart(chart, deck)).toEqual(expect.objectContaining({ type: "bar", data: [{ name: "Data", labels: ["A", "B"], values: [2, 5] }] }));
    expect(mapChart(chart, deck)?.options.barDir).toBe("col");
    expect(mapChart({ ...chart, chart: "progress" }, deck)).toBeNull();
    const table: TableElement = { ...base, kind: "table", role: "table", rows: [["Name", "Score"], ["Alex", "80"]], header: true };
    expect(mapTable(table, deck).rows[1].map((cell) => cell.text)).toEqual(table.rows[1]);
    expect(mapTable(table, deck).rows[0][0].options?.bold).toBe(true);
    expect(mapTable(table, deck).options.autoPage).toBe(false);
  });

  it("parses theme-ready hex and rgb colors", () => {
    expect(pptxColor("#abc")).toBe("AABBCC");
    expect(pptxColor("rgb(10, 20, 255)")).toBe("0A14FF");
    expect(pptxColor("transparent")).toBeNull();
  });
});
