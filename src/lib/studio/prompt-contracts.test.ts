import { describe, expect, it } from "vitest";
import {
  AI_PROMPT_CONTRACTS,
  isAiPromptContractId,
  normalizeAiPromptContractId,
} from "@/lib/studio/catalog";

describe("AI prompt contract routing", () => {
  it("accepts known contract ids", () => {
    expect(isAiPromptContractId("clean-notes")).toBe(true);
    expect(isAiPromptContractId("create-slide-deck")).toBe(true);
  });

  it("rejects unknown task ids", () => {
    expect(isAiPromptContractId("delete-provider")).toBe(false);
    expect(isAiPromptContractId(null)).toBe(false);
  });

  it("normalizes unsafe values to the default contract", () => {
    expect(normalizeAiPromptContractId("generate-practice")).toBe("generate-practice");
    expect(normalizeAiPromptContractId("unknown")).toBe(AI_PROMPT_CONTRACTS[0]?.id);
  });
});
