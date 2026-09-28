import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { completeTransaction } from "@/lib/billing";
import { errorJson, withRoute } from "@/lib/security/http-errors";

const SIGNATURE_TOLERANCE_SECONDS = 300;
const PAID_CHECKOUT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const PAID_STATUSES = new Set(["paid", "no_payment_required"]);

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: { object?: { payment_status?: unknown; metadata?: Record<string, unknown> } };
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyStripeSignature(raw: string, header: string | null, secret: string, nowSeconds: number) {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return signatures.some((signature) => safeEqual(signature, expected));
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const POST = withRoute(async (request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return errorJson("Billing webhook is not configured.", 503);

  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret, Math.floor(Date.now() / 1000))) {
    return errorJson("Invalid webhook signature.", 401);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return errorJson("Invalid webhook payload.", 400);
  }
  const eventId = typeof event?.id === "string" ? event.id : "";
  const eventType = typeof event?.type === "string" ? event.type : "";
  if (!eventId || !eventType) return errorJson("Invalid webhook payload.", 400);

  const object = event.data?.object;
  const metadata = object?.metadata && typeof object.metadata === "object" ? object.metadata : {};
  const tenantId = metadataString(metadata, "tenant_id");

  const [inserted] = await d1Query<{ id: string }>(
    `INSERT INTO billing_webhook_events (
       id, tenant_id, provider, provider_event_id, event_type, payload, processed_at, created_at
     ) VALUES (?, (SELECT id FROM tenants WHERE id = ?), 'stripe', ?, ?, ?, NULL, datetime('now'))
     ON CONFLICT(provider, provider_event_id) DO NOTHING
     RETURNING id`,
    [crypto.randomUUID(), tenantId, eventId, eventType, raw],
  );
  if (!inserted) {
    const [existing] = await d1Query<{ processed_at: string | null }>(
      "SELECT processed_at FROM billing_webhook_events WHERE provider = 'stripe' AND provider_event_id = ? LIMIT 1",
      [eventId],
    );
    if (existing?.processed_at) {
      return NextResponse.json({ data: { received: true, duplicate: true }, error: null });
    }
  }

  const userId = metadataString(metadata, "user_id");
  const transactionId = metadataString(metadata, "transaction_id");
  const paymentStatus = typeof object?.payment_status === "string" ? object.payment_status : "paid";
  let outcome = "ignored";
  if (PAID_CHECKOUT_EVENTS.has(eventType) && PAID_STATUSES.has(paymentStatus) && tenantId && userId && transactionId) {
    const result = await completeTransaction({
      tenantId,
      transactionId,
      expectedUserId: userId,
      sourceType: "stripe_checkout",
    });
    outcome = result.status;
  }

  await d1Query(
    "UPDATE billing_webhook_events SET processed_at = datetime('now') WHERE provider = 'stripe' AND provider_event_id = ?",
    [eventId],
  );
  return NextResponse.json({ data: { received: true, outcome }, error: null });
});
