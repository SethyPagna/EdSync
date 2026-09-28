import { describe, expect, it } from "vitest";
import { referencedCategoryIds, weightedAverage } from "@/lib/grades/weighting";

describe("gradebook weighting", () => {
  const scores = [
    { category_id: "tests", percent: 90, status: "graded" },
    { category_id: "tests", percent: 70, status: "graded" },
    { category_id: "homework", percent: 100, status: "graded" },
    { category_id: "homework", percent: 0, status: "submitted" },
    { category_id: null, percent: 40, status: "graded" },
  ];

  it("weights category averages by the category weight", () => {
    // tests avg 80 (w3), homework avg 100 (w1), uncategorized 40 (w1) => (240 + 100 + 40) / 5 = 76
    expect(
      weightedAverage(scores, [
        { id: "tests", weight: 3 },
        { id: "homework", weight: 1 },
      ]),
    ).toBe(76);
  });

  it("differs from an unweighted average once categories are applied", () => {
    // Without categories every group weighs 1: (80 + 100 + 40) / 3
    expect(weightedAverage(scores, [])).toBe(73.33);
  });

  it("ignores ungraded scores and returns null when nothing is graded", () => {
    expect(weightedAverage([{ category_id: "tests", percent: 50, status: "submitted" }], [])).toBeNull();
    expect(weightedAverage([{ category_id: "tests", percent: null, status: "graded" }], [])).toBeNull();
  });

  it("lists the categories the scores reference", () => {
    expect(referencedCategoryIds(scores)).toEqual(["tests", "homework"]);
  });
});
