import { describe, expect, it } from "vitest";
import {
  AUTOMATION_RECIPES,
  AUTOMATION_TITLE_MAX_LENGTH,
  normalizeAutomationRulePayload,
  validateAutomationActions,
  validateAutomationConditions,
  validateAutomationTitle,
  validateAutomationTrigger,
} from "@/lib/automation/rules";

describe("automation rule validation", () => {
  it("keeps starter recipes compatible with validation", () => {
    for (const recipe of AUTOMATION_RECIPES) {
      expect(normalizeAutomationRulePayload(recipe).title).toBe(recipe.title);
    }
  });

  it("validates title and trigger boundaries", () => {
    expect(validateAutomationTitle("  Deadline reminder  ")).toBe("Deadline reminder");
    expect(validateAutomationTrigger("learner.inactive")).toBe("learner.inactive");
    expect(() => validateAutomationTitle("")).toThrow("required");
    expect(() => validateAutomationTitle("x".repeat(AUTOMATION_TITLE_MAX_LENGTH + 1))).toThrow("characters");
    expect(() => validateAutomationTrigger("unknown.trigger")).toThrow("supported");
  });

  it("requires object conditions and supported actions", () => {
    expect(validateAutomationConditions({ inactiveDays: 5 })).toEqual({ inactiveDays: 5 });
    expect(validateAutomationActions([{ type: "notify", channel: "in_app" }])).toEqual([
      { type: "notify", channel: "in_app" },
    ]);
    expect(() => validateAutomationConditions([])).toThrow("object");
    expect(() => validateAutomationActions([])).toThrow("At least one");
    expect(() => validateAutomationActions([{ type: "delete_everything" }])).toThrow("Unsupported");
  });
});
