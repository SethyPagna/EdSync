import { describe, expect, it } from "vitest";
import {
  WORK_POINTS_MAX,
  isWorkType,
  validateWorkPoints,
  validateWorkStatus,
  validateWorkType,
} from "@/lib/work/validation";

describe("work validation", () => {
  it("validates work types", () => {
    expect(isWorkType("quiz")).toBe(true);
    expect(isWorkType("activity")).toBe(true);
    expect(isWorkType("memo")).toBe(false);
    expect(validateWorkType(undefined)).toBe("task");
    expect(() => validateWorkType("memo")).toThrow("supported work type");
  });

  it("validates work statuses", () => {
    expect(validateWorkStatus(undefined)).toBe("draft");
    expect(validateWorkStatus("published")).toBe("published");
    expect(validateWorkStatus("archived")).toBe("archived");
    expect(() => validateWorkStatus("archived", { allowArchived: false })).toThrow("supported work status");
    expect(() => validateWorkStatus("deleted")).toThrow("supported work status");
  });

  it("normalizes point values into safe bounds", () => {
    expect(validateWorkPoints(undefined)).toBe(100);
    expect(validateWorkPoints(-5)).toBe(0);
    expect(validateWorkPoints(WORK_POINTS_MAX + 1)).toBe(WORK_POINTS_MAX);
    expect(() => validateWorkPoints("many")).toThrow("valid number");
  });
});
