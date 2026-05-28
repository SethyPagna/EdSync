import { describe, expect, it } from "vitest";
import { hasCatalogFilters, normalizeCatalogFilters } from "@/lib/catalog/filters";

describe("catalog filters", () => {
  it("normalizes search, portal, tenant, and price filters", () => {
    expect(
      normalizeCatalogFilters({
        q: "  Algebra  ",
        portal: " Main ",
        tenant: " EdSync ",
        featured: "true",
        price: "free",
      }),
    ).toMatchObject({
      query: "Algebra",
      portalSlug: "main",
      tenantSlug: "edsync",
      featuredOnly: true,
      price: "free",
    });
  });

  it("caps and defaults optional filters", () => {
    const filters = normalizeCatalogFilters({
      price: "expensive",
      maxDuration: "9999",
      category: "x".repeat(100),
    });

    expect(filters.price).toBe("all");
    expect(filters.maxDuration).toBe(600);
    expect(filters.category).toHaveLength(80);
  });

  it("detects active filters", () => {
    expect(hasCatalogFilters(normalizeCatalogFilters())).toBe(false);
    expect(hasCatalogFilters(normalizeCatalogFilters({ language: "Spanish" }))).toBe(false);
    expect(hasCatalogFilters(normalizeCatalogFilters({ courseLanguage: "English" }))).toBe(true);
  });

  it("keeps public language separate from course language filters", () => {
    const filters = normalizeCatalogFilters({
      language: "Spanish",
      courseLanguage: "English",
    });

    expect(filters.language).toBe("Spanish");
    expect(filters.courseLanguage).toBe("English");
  });
});
