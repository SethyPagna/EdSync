import { describe, expect, it } from "vitest";
import { buildImagePdf } from "./pdf";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("buildImagePdf", () => {
  it("writes two image pages and valid byte offsets for every PDF object", () => {
    const bytes = buildImagePdf([
      { bytes: jpeg, pixelWidth: 1280, pixelHeight: 720 },
      { bytes: jpeg, pixelWidth: 800, pixelHeight: 1100 },
    ]);
    const pdf = new TextDecoder("latin1").decode(bytes);
    expect(pdf).toMatch(/^%PDF-1\.4/);
    expect(pdf).toContain("/Count 2");
    expect(pdf.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
    expect(pdf).toContain("/MediaBox [0 0 960 540]");
    expect(pdf).toContain("/MediaBox [0 0 698.182 960]");
    const start = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(start, start + 4)).toBe("xref");
    const entries = pdf.slice(start).match(/xref\n0 9\n([\s\S]*?)trailer/)?.[1].trim().split("\n");
    expect(entries).toHaveLength(9);
    for (let id = 1; id < 9; id += 1) {
      const offset = Number(entries?.[id].slice(0, 10));
      expect(pdf.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
    }
  });

  it("rejects missing or incomplete page images", () => {
    expect(() => buildImagePdf([])).toThrow(/at least one/);
    expect(() => buildImagePdf([{ bytes: new Uint8Array([1, 2]), pixelWidth: 1, pixelHeight: 1 }])).toThrow(/complete JPEG/);
  });
});
