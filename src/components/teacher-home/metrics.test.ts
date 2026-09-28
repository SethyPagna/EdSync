import { describe, expect, it } from "vitest";
import { averageScore, csvCell, numericScore } from "./metrics";

describe("teacher score summaries", () => {
  it("counts a real zero but ignores null and malformed scores", () => {
    expect(averageScore([null, undefined, 0, 80, "100", "", "bad", 200])).toBe(60);
    expect(numericScore(null)).toBeNull();
    expect(averageScore([null, undefined, ""])).toBeNull();
  });

  it("weights every result equally rather than repeatedly halving the running mean", () => {
    expect(averageScore([90, 90, 0])).toBe(60);
  });
});

describe("report CSV cells", () => {
  it("escapes quotes and spreadsheet formulas", () => {
    expect(csvCell('Ada "A"')).toBe('"Ada ""A"""');
    expect(csvCell("=HYPERLINK(\"https://example.com\")")).toBe('"\'=HYPERLINK(""https://example.com"")"');
  });
});
