import { describe, expect, it } from "vitest";
import { generateInitials } from "./utils";

describe("generateInitials", () => {
  it("uses the first two normalized name parts", () => {
    expect(generateInitials("  Ada   Lovelace  ")).toBe("AL");
  });

  it("falls back to an EdSync initial for blank display names", () => {
    expect(generateInitials("   ")).toBe("E");
  });
});
