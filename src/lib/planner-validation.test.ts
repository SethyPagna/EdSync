import { describe, expect, it } from "vitest";
import {
  PLANNER_TITLE_MAX_LENGTH,
  normalizePlannerDateTime,
  normalizePlannerEventType,
  normalizePlannerPriority,
  normalizePlannerText,
  validatePlannerDateOrder,
} from "@/lib/planner-validation";

describe("planner validation", () => {
  it("validates planner text boundaries", () => {
    expect(normalizePlannerText(" Class update ", "Title", PLANNER_TITLE_MAX_LENGTH)).toBe("Class update");
    expect(normalizePlannerText("", "Details", 20, false)).toBeNull();
    expect(() => normalizePlannerText("", "Title", 20)).toThrow("required");
    expect(() => normalizePlannerText("x".repeat(PLANNER_TITLE_MAX_LENGTH + 1), "Title", PLANNER_TITLE_MAX_LENGTH)).toThrow("characters");
  });

  it("normalizes priorities, event types, and date values", () => {
    expect(normalizePlannerPriority("high")).toBe("high");
    expect(normalizePlannerPriority("urgent")).toBe("normal");
    expect(normalizePlannerEventType("office_hours", "class")).toBe("office_hours");
    expect(normalizePlannerEventType("bad", "class")).toBe("class");
    expect(normalizePlannerDateTime("2026-05-16T09:30", "Start")).toBe("2026-05-16T09:30");
    expect(() => normalizePlannerDateTime("not a date", "Start")).toThrow("valid date");
  });

  it("rejects end times before start times", () => {
    expect(() =>
      validatePlannerDateOrder({ startsAt: "2026-05-16T10:00", endsAt: "2026-05-16T09:00" }),
    ).toThrow("after start");
    expect(() =>
      validatePlannerDateOrder({ startsAt: "2026-05-16T09:00", endsAt: "2026-05-16T10:00" }),
    ).not.toThrow();
  });
});
