// @vitest-environment node
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/billing", () => ({ completeTransaction: mocks.complete }));

import { POST } from "./route";

const SECRET = "whsec_test_secret";

const paidEvent = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      payment_status: "paid",
      metadata: { tenant_id: "tenant-1", user_id: "user-1", transaction_id: "txn-1" },
    },
  },
};

function sign(payload: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function webhook(payload: string, signature?: string) {
  return new Request("https://edsync.test/api/billing/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: payload,
  });
}

async function post(request: Request) {
  const response = await POST(request, undefined);
  return { status: response.status, payload: (await response.json()) as { data: Record<string, unknown> | null; error: string | null } };
}

describe("billing webhook", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    mocks.query.mockReset();
    mocks.complete.mockReset();
    mocks.query.mockImplementation(async (sql: string) => (sql.includes("INSERT INTO billing_webhook_events") ? [{ id: "row-1" }] : []));
    mocks.complete.mockResolvedValue({ status: "paid", transactionId: "txn-1", userId: "user-1", productId: "product-1", entitlementGranted: true });
  });

  it("fails closed when no webhook secret is configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const body = JSON.stringify(paidEvent);
    const { status } = await post(webhook(body, sign(body)));
    expect(status).toBe(503);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("rejects unsigned events", async () => {
    const { status } = await post(webhook(JSON.stringify(paidEvent)));
    expect(status).toBe(401);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("rejects events signed with an unknown secret", async () => {
    const body = JSON.stringify(paidEvent);
    const { status } = await post(webhook(body, sign(body, "whsec_attacker")));
    expect(status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects signatures outside the five minute tolerance", async () => {
    const body = JSON.stringify(paidEvent);
    const stale = Math.floor(Date.now() / 1000) - 301;
    const { status } = await post(webhook(body, sign(body, SECRET, stale)));
    expect(status).toBe(401);
  });

  it("rejects a valid signature over a tampered body", async () => {
    const body = JSON.stringify(paidEvent);
    const tampered = body.replace("user-1", "user-2");
    const { status } = await post(webhook(tampered, sign(body)));
    expect(status).toBe(401);
  });

  it("completes the transaction for a verified paid checkout", async () => {
    const body = JSON.stringify(paidEvent);
    const { status, payload } = await post(webhook(body, sign(body)));
    expect(status).toBe(200);
    expect(payload.data).toMatchObject({ received: true, outcome: "paid" });
    expect(mocks.complete).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      transactionId: "txn-1",
      expectedUserId: "user-1",
      sourceType: "stripe_checkout",
    });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("SET processed_at"))).toBe(true);
  });

  it("skips replays of an already processed event", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO billing_webhook_events")) return [];
      if (sql.includes("SELECT processed_at")) return [{ processed_at: "2026-01-01 00:00:00" }];
      return [];
    });
    const body = JSON.stringify(paidEvent);
    const { status, payload } = await post(webhook(body, sign(body)));
    expect(status).toBe(200);
    expect(payload.data).toMatchObject({ received: true, duplicate: true });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("retries an event whose earlier delivery did not finish processing", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO billing_webhook_events")) return [];
      if (sql.includes("SELECT processed_at")) return [{ processed_at: null }];
      return [];
    });
    const body = JSON.stringify(paidEvent);
    const { status } = await post(webhook(body, sign(body)));
    expect(status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });

  it("ignores unpaid checkout sessions", async () => {
    const unpaid = { ...paidEvent, id: "evt_2", data: { object: { ...paidEvent.data.object, payment_status: "unpaid" } } };
    const body = JSON.stringify(unpaid);
    const { status, payload } = await post(webhook(body, sign(body)));
    expect(status).toBe(200);
    expect(payload.data).toMatchObject({ outcome: "ignored" });
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
