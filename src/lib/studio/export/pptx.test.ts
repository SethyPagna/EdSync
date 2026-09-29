import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PptxGenJS from "pptxgenjs";
import type { SceneDeck } from "@/lib/studio/scene";
import { buildNativePptx } from "./pptx";

beforeEach(() => vi.stubGlobal("PptxGenJS", PptxGenJS));
afterEach(() => vi.unstubAllGlobals());

describe("buildNativePptx", () => {
  it("packages editable slide content and notes as a PowerPoint file", async () => {
    const deck: SceneDeck = {
      v: 2, id: "deck", title: "Learning", kind: "slides", formatId: "slides-16x9", width: 1280, height: 720, themeId: "porcelain",
      pages: [{
        id: "page", background: { kind: "solid", color: "bg" }, notes: "Explain the chart.",
        elements: [
          { id: "heading", kind: "text", role: "title", x: 0.1, y: 0.1, w: 0.8, h: 0.1, style: "heading", text: "Learning" },
          { id: "box", kind: "shape", role: "shape", x: 0.1, y: 0.3, w: 0.3, h: 0.25, shape: "rounded", fill: "accent" },
          { id: "chart", kind: "chart", role: "chart", x: 0.5, y: 0.3, w: 0.4, h: 0.3, chart: "bar", data: [{ label: "A", value: 2 }, { label: "B", value: 3 }] },
          { id: "table", kind: "table", role: "table", x: 0.1, y: 0.65, w: 0.8, h: 0.2, rows: [["Name", "Score"], ["A", "2"]], header: true },
        ],
      }],
    };
    const blob = await buildNativePptx(deck);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
    const names = new TextDecoder("latin1").decode(bytes);
    expect(names).toContain("ppt/slides/slide1.xml");
    expect(names).toContain("ppt/notesSlides/notesSlide1.xml");
    expect(names).toContain("ppt/charts/chart1.xml");
  }, 30_000);
});
