import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { completeTransaction, createCheckout, grantEntitlement } from "@/lib/billing";
import { HttpError } from "@/lib/security/http-errors";

type Transaction = { id: string; product_id: string | null; status: string; metadata: string | null };

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1",
    product_id: "product-1",
    status: "pending",
    metadata: JSON.stringify({ userId: "buyer-1" }),
    ...overrides,
  };
}

function routeQueries(row: Transaction | null, options: { granted?: boolean } = {}) {
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM billing_transactions")) return row ? [row] : [];
    if (sql.includes("UPDATE billing_transactions")) return [{ status: "paid" }];
    if (sql.includes("INSERT INTO entitlements")) return options.granted === false ? [] : [{ id: "entitlement-1" }];
    return [];
  });
}

function sqlCalls() {
  return mocks.query.mock.calls.map(([sql]) => String(sql));
}

describe("grantEntitlement", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("inserts only when no grant exists for the same source", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "entitlement-1" }]).mockResolvedValueOnce([]);
    const input = { tenantId: "tenant-1", userId: "buyer-1", productId: "product-1", sourceType: "stripe_checkout", sourceId: "txn-1" };
    await expect(grantEntitlement(input)).resolves.toEqual({ granted: true, entitlementId: "entitlement-1" });
    await expect(grantEntitlement(input)).resolves.toEqual({ granted: false, entitlementId: null });
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(params.slice(6)).toEqual(["tenant-1", "buyer-1", "product-1", "txn-1"]);
  });

  it("grants one entitlement per transaction whichever path completes it", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE entitlements (
      id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, product_id TEXT, source_type TEXT, source_id TEXT,
      status TEXT, starts_at TEXT, metadata TEXT, created_at TEXT, updated_at TEXT
    )`);
    mocks.query.mockImplementation(async (sql: string, params: SQLInputValue[] = []) => db.prepare(sql).all(...params));
    const base = { tenantId: "tenant-1", userId: "buyer-1", productId: "product-1", sourceId: "txn-1" };
    await expect(grantEntitlement({ ...base, sourceType: "manual_payment" })).resolves.toMatchObject({ granted: true });
    await expect(grantEntitlement({ ...base, sourceType: "stripe_checkout" })).resolves.toEqual({ granted: false, entitlementId: null });
    await expect(grantEntitlement({ ...base, sourceId: "txn-2", sourceType: "stripe_checkout" })).resolves.toMatchObject({ granted: true });
    expect(db.prepare("SELECT source_type, source_id FROM entitlements ORDER BY source_id").all()).toEqual([
      { source_type: "manual_payment", source_id: "txn-1" },
      { source_type: "stripe_checkout", source_id: "txn-2" },
    ]);
    db.close();
  });
});

describe("createCheckout with Stripe", () => {
  const env = { provider: process.env.PAYMENT_PROVIDER, key: process.env.STRIPE_SECRET_KEY };
  const request = { tenantId: "tenant-1", userId: "buyer-1", priceId: "price-1", successUrl: "https://edsync.test/ok", cancelUrl: "https://edsync.test/no" };

  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockImplementation(async (sql: string) =>
      sql.includes("FROM billing_prices")
        ? [{ id: "price-1", product_id: "product-1", amount_cents: 4900, currency: "usd", billing_interval: "one_time" }]
        : [],
    );
    process.env.PAYMENT_PROVIDER = "stripe";
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (env.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = env.provider;
    if (env.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = env.key;
  });

  async function checkoutError(response: Response) {
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const error = await createCheckout(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    return error as HttpError;
  }

  it("maps a non-JSON provider reply to a 502 instead of a client JSON error", async () => {
    const error = await checkoutError(new Response("<html>Bad gateway</html>", { status: 502 }));
    expect(error.status).toBe(502);
    expect(error.message).toBe("Payment provider is unavailable.");
  });

  it("hides Stripe's own error text from the buyer and logs it", async () => {
    const error = await checkoutError(
      Response.json({ error: { type: "invalid_request_error", message: "Invalid API Key provided: sk_live_****1234" } }, { status: 401 }),
    );
    expect(error.status).toBe(502);
    expect(error.message).toBe("Payment provider is unavailable.");
    expect(console.error).toHaveBeenCalledWith("Stripe checkout failed", {
      status: 401,
      type: "invalid_request_error",
      message: "Invalid API Key provided: sk_live_****1234",
    });
  });

  it("stores the Stripe session id and returns its redirect URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" })));
    const result = await createCheckout(request);
    expect(result).toMatchObject({ provider: "stripe", mode: "redirect", url: "https://checkout.stripe.test/cs_test_1" });
    const update = mocks.query.mock.calls.find(([sql]) => String(sql).includes("SET provider_transaction_id"));
    expect(update?.[1]).toEqual(["cs_test_1", result.transactionId]);
  });
});

describe("completeTransaction", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("marks a pending transaction paid and grants the product to its buyer", async () => {
    routeQueries(transaction());
    const result = await completeTransaction({ tenantId: "tenant-1", transactionId: "txn-1", expectedUserId: "buyer-1", sourceType: "stripe_checkout" });
    expect(result).toEqual({ status: "paid", transactionId: "txn-1", userId: "buyer-1", productId: "product-1", entitlementGranted: true });
    expect(mocks.query.mock.calls[0]?.[1]).toEqual(["txn-1", "tenant-1"]);
    expect(sqlCalls().some((sql) => sql.includes("UPDATE billing_transactions"))).toBe(true);
  });

  it("refuses to grant a transaction to anyone but the buyer who started it", async () => {
    routeQueries(transaction());
    const result = await completeTransaction({ tenantId: "tenant-1", transactionId: "txn-1", expectedUserId: "attacker", sourceType: "stripe_checkout" });
    expect(result).toEqual({ status: "user_mismatch" });
    expect(sqlCalls().some((sql) => sql.includes("UPDATE") || sql.includes("INSERT"))).toBe(false);
  });

  it("reports unknown or foreign-tenant transactions as not found", async () => {
    routeQueries(null);
    await expect(completeTransaction({ tenantId: "tenant-2", transactionId: "txn-1", sourceType: "manual_payment" })).resolves.toEqual({
      status: "not_found",
    });
  });

  it("never revives refunded or void transactions", async () => {
    routeQueries(transaction({ status: "refunded" }));
    await expect(completeTransaction({ tenantId: "tenant-1", transactionId: "txn-1", sourceType: "manual_payment" })).resolves.toEqual({
      status: "not_payable",
    });
    expect(sqlCalls().some((sql) => sql.includes("INSERT INTO entitlements"))).toBe(false);
  });

  it("is idempotent for an already paid transaction", async () => {
    routeQueries(transaction({ status: "paid" }), { granted: false });
    const result = await completeTransaction({ tenantId: "tenant-1", transactionId: "txn-1", sourceType: "manual_payment" });
    expect(result).toMatchObject({ status: "paid", entitlementGranted: false });
    expect(sqlCalls().some((sql) => sql.includes("UPDATE billing_transactions"))).toBe(false);
  });

  it("treats transactions without a recorded buyer as unowned", async () => {
    routeQueries(transaction({ metadata: "{not json" }));
    await expect(completeTransaction({ tenantId: "tenant-1", transactionId: "txn-1", sourceType: "manual_payment" })).resolves.toEqual({
      status: "user_mismatch",
    });
  });
});
