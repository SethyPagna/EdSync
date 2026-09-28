import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  products: [] as Array<Record<string, unknown>>,
  prices: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { enrollCatalogItem, getPublicCatalogItem, listPublicCatalog } from "@/lib/catalog";
import { ConflictError } from "@/lib/security/http-errors";

function product(id: string, enrollmentMode: string) {
  return {
    id,
    tenant_id: "tenant-school",
    course_id: null,
    title: `Course ${id}`,
    description: null,
    product_type: "course",
    status: "active",
    metadata: JSON.stringify({ visibility: "public", enrollmentMode }),
    tenant_name: "Acme School",
    tenant_slug: "acme",
    portal_id: null,
    portal_slug: null,
    portal_name: null,
    portal_audience: null,
    portal_catalog_settings: null,
    lesson_title: null,
    lesson_subject: null,
    lesson_grade_level: null,
    lesson_duration: null,
    lesson_thumbnail_url: null,
  };
}

function price(productId: string, amountCents: number) {
  return { id: `price-${productId}`, product_id: productId, amount_cents: amountCents, currency: "usd", billing_interval: "one_time" };
}

describe("public catalog pricing", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.products = [];
    mocks.prices = [];
    mocks.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM billing_products bp")) {
        return sql.includes("WHERE bp.id = ?") ? mocks.products.filter((row) => row.id === params[0]) : mocks.products;
      }
      if (sql.includes("FROM billing_prices")) return mocks.prices.filter((row) => params.includes(row.product_id));
      return [];
    });
  });

  it("marks a paid product whose price was deactivated as unavailable instead of free", async () => {
    mocks.products = [product("paid-no-price", "paid")];
    const item = await getPublicCatalogItem("paid-no-price");
    expect(item?.price).toMatchObject({ id: null, label: "Unavailable", isFree: false });
    await expect(
      enrollCatalogItem({ item: item!, userId: "student-1", successUrl: "https://edsync.test/ok", cancelUrl: "https://edsync.test/no" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("keeps explicitly free products and zero-priced products free", async () => {
    mocks.products = [product("free-mode", "free"), product("zero-price", "paid")];
    mocks.prices = [price("zero-price", 0)];
    expect((await getPublicCatalogItem("free-mode"))?.price).toMatchObject({ id: null, label: "Free", isFree: true });
    expect((await getPublicCatalogItem("zero-price"))?.price).toMatchObject({ id: "price-zero-price", label: "Free", isFree: true });
  });

  it("labels a priced product with its amount", async () => {
    mocks.products = [product("priced", "paid")];
    mocks.prices = [price("priced", 4900)];
    expect((await getPublicCatalogItem("priced"))?.price).toMatchObject({ label: "$49.00", isFree: false });
  });

  it("leaves unpriced paid products out of the free filter", async () => {
    mocks.products = [product("paid-no-price", "paid"), product("free-mode", "free")];
    const free = await listPublicCatalog({ price: "free" });
    expect(free.map((item) => item.id)).toEqual(["free-mode"]);
  });
});
