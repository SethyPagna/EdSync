import { d1Query } from "@/lib/db/d1";
import { HttpError, NotFoundError } from "@/lib/security/http-errors";
import type { PaymentProvider } from "@/types";

export type CheckoutRequest = {
  tenantId: string;
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResult = {
  provider: PaymentProvider;
  mode: "redirect" | "manual";
  url: string | null;
  transactionId: string;
};

function provider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "stripe" && process.env.STRIPE_SECRET_KEY ? "stripe" : "manual";
}

export async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const [price] = await d1Query<{
    id: string;
    product_id: string;
    amount_cents: number;
    currency: string;
    billing_interval: string;
  }>("SELECT * FROM billing_prices WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1", [input.priceId, input.tenantId]);
  if (!price) throw new NotFoundError("Price not found.");

  const selectedProvider = provider();
  if (selectedProvider === "manual") {
    const [pending] = await d1Query<{ id: string }>(
      `SELECT id FROM billing_transactions
        WHERE tenant_id = ? AND product_id = ? AND price_id = ?
          AND provider = 'manual' AND status = 'pending'
          AND amount_cents = ? AND currency = ?
          AND json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.userId') = ?
        ORDER BY created_at DESC LIMIT 1`,
      [input.tenantId, price.product_id, price.id, price.amount_cents, price.currency, input.userId],
    );
    if (pending) return { provider: "manual", mode: "manual", url: null, transactionId: pending.id };
  }

  const transactionId = crypto.randomUUID();
  await d1Query(
    `INSERT INTO billing_transactions (
       id, tenant_id, product_id, price_id, provider, amount_cents, currency, status, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
    [
      transactionId,
      input.tenantId,
      price.product_id,
      price.id,
      selectedProvider,
      price.amount_cents,
      price.currency,
      JSON.stringify({ userId: input.userId }),
    ],
  );

  if (selectedProvider !== "stripe") {
    return { provider: "manual", mode: "manual", url: null, transactionId };
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: price.billing_interval === "one_time" ? "payment" : "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "line_items[0][price_data][currency]": price.currency,
      "line_items[0][price_data][unit_amount]": String(price.amount_cents),
      "line_items[0][price_data][product_data][name]": "EdSync learning access",
      "line_items[0][quantity]": "1",
      "metadata[transaction_id]": transactionId,
      "metadata[tenant_id]": input.tenantId,
      "metadata[user_id]": input.userId,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    url?: string | null;
    error?: { type?: string; message?: string };
  } | null;
  // Stripe's own error text can expose account configuration, so it is logged and the buyer sees a generic message.
  if (!response.ok || !payload?.id) {
    console.error("Stripe checkout failed", {
      status: response.status,
      type: payload?.error?.type ?? null,
      message: payload?.error?.message ?? null,
    });
    throw new HttpError(502, "Payment provider is unavailable.");
  }
  await d1Query(
    "UPDATE billing_transactions SET provider_transaction_id = ?, updated_at = datetime('now') WHERE id = ?",
    [payload.id, transactionId],
  );
  return { provider: "stripe", mode: "redirect", url: payload.url ?? null, transactionId };
}

export async function grantEntitlement(input: {
  tenantId: string;
  userId: string;
  productId: string;
  sourceType: string;
  sourceId: string;
}) {
  const [created] = await d1Query<{ id: string }>(
    `INSERT INTO entitlements (
       id, tenant_id, user_id, product_id, source_type, source_id, status, starts_at, metadata, created_at, updated_at
     )
     SELECT ?, ?, ?, ?, ?, ?, 'active', datetime('now'), '{}', datetime('now'), datetime('now')
      WHERE NOT EXISTS (
        SELECT 1
          FROM entitlements
         WHERE tenant_id = ?
           AND user_id = ?
           AND product_id = ?
           AND source_id = ?
      )
     RETURNING id`,
    [
      crypto.randomUUID(),
      input.tenantId,
      input.userId,
      input.productId,
      input.sourceType,
      input.sourceId,
      input.tenantId,
      input.userId,
      input.productId,
      input.sourceId,
    ],
  );
  return { granted: Boolean(created), entitlementId: created?.id ?? null };
}

type TransactionRow = {
  id: string;
  product_id: string | null;
  provider: PaymentProvider;
  status: "pending" | "paid" | "failed" | "refunded" | "void";
  metadata: string | null;
};

export type CompleteTransactionResult =
  | { status: "paid"; transactionId: string; userId: string; productId: string | null; entitlementGranted: boolean }
  | { status: "not_found" | "user_mismatch" | "not_payable" };

function transactionOwner(metadata: string | null) {
  try {
    const parsed = metadata ? (JSON.parse(metadata) as { userId?: unknown }) : {};
    return typeof parsed.userId === "string" && parsed.userId ? parsed.userId : null;
  } catch {
    return null;
  }
}

/**
 * Marks a checkout transaction paid and grants its product to the buyer who started it.
 * Safe to repeat: a paid transaction only re-checks the (idempotent) entitlement.
 */
export async function completeTransaction(input: {
  tenantId: string;
  transactionId: string;
  expectedUserId?: string | null;
  sourceType: string;
}): Promise<CompleteTransactionResult> {
  const [transaction] = await d1Query<TransactionRow>(
    "SELECT id, product_id, provider, status, metadata FROM billing_transactions WHERE id = ? AND tenant_id = ? LIMIT 1",
    [input.transactionId, input.tenantId],
  );
  if (!transaction) return { status: "not_found" };
  const expectedProvider = input.sourceType === "manual_payment" ? "manual" : input.sourceType === "stripe_checkout" ? "stripe" : null;
  if (!expectedProvider || transaction.provider !== expectedProvider) return { status: "not_payable" };
  const owner = transactionOwner(transaction.metadata);
  if (!owner || (input.expectedUserId && input.expectedUserId !== owner)) return { status: "user_mismatch" };
  if (transaction.status !== "pending" && transaction.status !== "paid") return { status: "not_payable" };

  if (transaction.status === "pending") {
    const [updated] = await d1Query<{ status: string }>(
      `UPDATE billing_transactions
          SET status = 'paid', updated_at = datetime('now')
        WHERE id = ? AND tenant_id = ? AND status IN ('pending', 'paid')
        RETURNING status`,
      [transaction.id, input.tenantId],
    );
    if (!updated) return { status: "not_payable" };
  }

  const grant = transaction.product_id
    ? await grantEntitlement({
        tenantId: input.tenantId,
        userId: owner,
        productId: transaction.product_id,
        sourceType: input.sourceType,
        sourceId: transaction.id,
      })
    : { granted: false };
  return {
    status: "paid",
    transactionId: transaction.id,
    userId: owner,
    productId: transaction.product_id,
    entitlementGranted: grant.granted,
  };
}
