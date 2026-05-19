import { describe, expect, it } from "vitest";
import {
  AUTOMATION_ID_MAX_LENGTH,
  AUTOMATION_RECIPES,
  AUTOMATION_TITLE_MAX_LENGTH,
  normalizeAutomationEnabled,
  normalizeAutomationRulePayload,
  validateAutomationActions,
  validateAutomationConditions,
  validateAutomationRuleId,
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
    expect(validateAutomationRuleId("automation-1")).toBe("automation-1");
    expect(validateAutomationTrigger("learner.inactive")).toBe("learner.inactive");
    expect(() => validateAutomationRuleId("bad id")).toThrow("short identifier");
    expect(() => validateAutomationRuleId("x".repeat(AUTOMATION_ID_MAX_LENGTH + 1))).toThrow("short identifier");
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

  it("normalizes automation enabled state without string coercion", () => {
    expect(normalizeAutomationEnabled(undefined)).toBe(true);
    expect(normalizeAutomationEnabled(null, false)).toBe(false);
    expect(normalizeAutomationEnabled(true)).toBe(true);
    expect(normalizeAutomationEnabled(false)).toBe(false);
    expect(() => normalizeAutomationEnabled("false")).toThrow("true or false");
    expect(() =>
      normalizeAutomationRulePayload({
        title: "Deadline reminder",
        triggerKey: "deadline.upcoming",
        actions: [{ type: "notify" }],
        enabled: "false",
      }),
    ).toThrow("true or false");
  });
});
