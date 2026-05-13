import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { grantEntitlement } from "@/lib/billing";

function verifyStripeSignature(raw: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return process.env.PAYMENT_PROVIDER !== "stripe";
  if (!signature) return false;
  const timestamp = signature.match(/t=([^,]+)/)?.[1];
  const expected = signature.match(/v1=([^,]+)/)?.[1];
  if (!timestamp || !expected) return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  if (digest.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(expected));
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, signature)) {
    return NextResponse.json({ data: null, error: "Invalid webhook signature." }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const eventId = event.id || crypto.randomUUID();
  const eventType = event.type || "manual.webhook";
  const metadata = event.data?.object?.metadata ?? {};
  const tenantId = metadata.tenant_id ?? null;

  await d1Query(
    `INSERT OR IGNORE INTO billing_webhook_events (
       id, tenant_id, provider, provider_event_id, event_type, payload, processed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [crypto.randomUUID(), tenantId, "stripe", eventId, eventType, raw],
  );

  if (eventType === "checkout.session.completed" && tenantId && metadata.user_id && metadata.transaction_id) {
    const [transaction] = await d1Query<{ product_id: string | null }>(
      "SELECT product_id FROM billing_transactions WHERE id = ? AND tenant_id = ? LIMIT 1",
      [metadata.transaction_id, tenantId],
    );
    await d1Query(
      "UPDATE billing_transactions SET status = 'paid', updated_at = datetime('now') WHERE id = ?",
      [metadata.transaction_id],
    );
    if (transaction?.product_id) {
      await grantEntitlement({
        tenantId,
        userId: metadata.user_id,
        productId: transaction.product_id,
        sourceType: "stripe_checkout",
        sourceId: metadata.transaction_id,
      });
    }
  }

  return NextResponse.json({ data: { received: true }, error: null });
}
