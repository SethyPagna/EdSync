import { describe, expect, it } from "vitest";
import { sqlInPlaceholders, sqlPlaceholders } from "./sql";

describe("SQL helpers", () => {
  it("builds positional placeholders", () => {
    expect(sqlPlaceholders(3)).toBe("?, ?, ?");
    expect(sqlInPlaceholders(["a", "b"])).toBe("?, ?");
  });

  it("rejects invalid placeholder counts", () => {
    expect(() => sqlPlaceholders(0)).toThrow("positive integer");
    expect(() => sqlPlaceholders(1.5)).toThrow("positive integer");
  });
});
