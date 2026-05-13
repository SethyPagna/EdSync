import { d1Query } from "@/lib/db/d1";
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
  return process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "manual";
}

export async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const [price] = await d1Query<{
    id: string;
    product_id: string;
    amount_cents: number;
    currency: string;
    billing_interval: string;
  }>("SELECT * FROM billing_prices WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1", [input.priceId, input.tenantId]);
  if (!price) throw new Error("Price not found.");

  const transactionId = crypto.randomUUID();
  const selectedProvider = provider();
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

  if (selectedProvider !== "stripe" || !process.env.STRIPE_SECRET_KEY) {
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
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Stripe checkout failed.");
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
  await d1Query(
    `INSERT INTO entitlements (
       id, tenant_id, user_id, product_id, source_type, source_id, status, starts_at, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), '{}', datetime('now'), datetime('now'))`,
    [crypto.randomUUID(), input.tenantId, input.userId, input.productId, input.sourceType, input.sourceId],
  );
}
