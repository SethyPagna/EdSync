import { describe, expect, it } from "vitest";
import { CATALOG_PRODUCT_ID_MAX_LENGTH, validateCatalogProductId } from "@/lib/validation/catalog";

describe("catalog validation", () => {
  it("validates public catalog product ids", () => {
    expect(validateCatalogProductId(" product-1 ")).toBe("product-1");
    expect(validateCatalogProductId("catalog_item:preview.1")).toBe("catalog_item:preview.1");
    expect(() => validateCatalogProductId("")).toThrow("required");
    expect(() => validateCatalogProductId("bad id")).toThrow("short identifier");
    expect(() => validateCatalogProductId("x".repeat(CATALOG_PRODUCT_ID_MAX_LENGTH + 1))).toThrow("short identifier");
  });
});
