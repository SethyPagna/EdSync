// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/security/http-errors";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  complete: vi.fn(),
  checkout: vi.fn(),
  requirePermission: vi.fn(),
  context: {
    tenant: { id: "tenant-school" },
    portal: null,
    membership: null as null | { status: string },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(async () => ({ id: "admin-1", email: "admin@example.com", user_metadata: { role: "teacher" } })),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/billing", () => ({ completeTransaction: mocks.complete, createCheckout: mocks.checkout }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { billingManage: "billing.manage" },
  getPermissionSet: vi.fn(async () => new Set(["billing.manage"])),
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: vi.fn(async () => mocks.context),
}));

import { GET, POST } from "./route";

async function post(body: unknown) {
  const response = await POST(
    new Request("https://edsync.test/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    undefined,
  );
  return { status: response.status, payload: (await response.json()) as { data: unknown; error: string | null } };
}

function sqlCalls() {
  return mocks.query.mock.calls.map(([sql]) => String(sql));
}

describe("billing route", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([]);
    mocks.complete.mockReset();
    mocks.checkout.mockReset();
    mocks.requirePermission.mockReset();
    mocks.requirePermission.mockResolvedValue(new Set(["billing.manage"]));
    mocks.context.membership = null;
  });

  it("rejects malformed JSON with 400", async () => {
    const { status, payload } = await post("{nope");
    expect(status).toBe(400);
    expect(payload.error).toBe("Invalid billing request.");
  });

  it("maps an unknown checkout price to 404 instead of 500", async () => {
    mocks.checkout.mockRejectedValueOnce(new NotFoundError("Price not found."));
    const { status, payload } = await post({ action: "checkout", priceId: "price-missing" });
    expect(status).toBe(404);
    expect(payload.error).toBe("Price not found.");
  });

  it("only lets billing managers mark transactions paid", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new ForbiddenError("Missing permission: billing.manage"));
    const { status } = await post({ action: "mark_paid", transactionId: "txn-1" });
    expect(status).toBe(403);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("marks a transaction paid inside the caller's tenant", async () => {
    mocks.complete.mockResolvedValueOnce({ status: "paid", transactionId: "txn-1", userId: "buyer-1", productId: "product-1", entitlementGranted: true });
    const { status } = await post({ action: "mark_paid", transactionId: "txn-1" });
    expect(status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith({ tenantId: "tenant-school", transactionId: "txn-1", sourceType: "manual_payment" });
  });

  it.each([
    ["not_found", 404],
    ["not_payable", 409],
    ["user_mismatch", 409],
  ])("maps a %s transaction to %s", async (outcome, status) => {
    mocks.complete.mockResolvedValueOnce({ status: outcome });
    expect((await post({ action: "mark_paid", transactionId: "txn-1" })).status).toBe(status);
  });

  it("does not add prices to another tenant's product", async () => {
    const { status } = await post({ action: "create_price", productId: "product-other", amountCents: 500, currency: "usd", billingInterval: "one_time" });
    expect(status).toBe(404);
    expect(sqlCalls().some((sql) => sql.includes("INSERT INTO billing_prices"))).toBe(false);
  });

  it("does not re-link another tenant's product into the caller's portal", async () => {
    const { status } = await post({ action: "update_catalog", productId: "product-other", portalId: "portal-1", status: "active" });
    expect(status).toBe(404);
    expect(sqlCalls().some((sql) => sql.includes("tenant_object_links") && !sql.startsWith("SELECT"))).toBe(false);
  });

  it("does not sell a lesson that belongs to another tenant", async () => {
    mocks.query.mockImplementation(async (sql: string) => (sql.includes("FROM billing_products") ? [{ id: "product-1" }] : []));
    const { status, payload } = await post({
      action: "update_product",
      productId: "product-1",
      title: "Algebra",
      productType: "course",
      courseId: "lesson-foreign",
    });
    expect(status).toBe(404);
    expect(payload.error).toBe("Course not found.");
    expect(sqlCalls().some((sql) => sql.includes("UPDATE billing_products"))).toBe(false);
  });

  it("refuses tenant-wide billing data to signed-in users who are not organization members", async () => {
    const response = await GET(new Request("https://learn.acme.test/api/billing"), undefined);
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: string }).error).toBe("Organization membership required.");
    expect(sqlCalls().some((sql) => sql.includes("FROM billing_products"))).toBe(false);
  });

  it("returns the organization catalog to active members", async () => {
    mocks.context.membership = { status: "active" };
    const response = await GET(new Request("https://learn.acme.test/api/billing"), undefined);
    expect(response.status).toBe(200);
    const productQuery = mocks.query.mock.calls.find(([sql]) => String(sql).includes("FROM billing_products"));
    expect(productQuery?.[1]).toEqual(["tenant-school"]);
  });
});
