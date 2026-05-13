import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createCheckout } from "@/lib/billing";
import { d1Query } from "@/lib/db/d1";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const [products, prices, entitlements] = await Promise.all([
    d1Query("SELECT * FROM billing_products WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM billing_prices WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM entitlements WHERE tenant_id = ? AND (? = 'admin' OR user_id = ?) ORDER BY updated_at DESC LIMIT 100", [
      context.tenant.id,
      user.user_metadata.role,
      user.id,
    ]),
  ]);
  return NextResponse.json({ data: { products, prices, entitlements, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    action?: "create_product" | "create_price" | "checkout";
    title?: string;
    description?: string | null;
    productType?: string;
    courseId?: string | null;
    productId?: string;
    priceId?: string;
    amountCents?: number;
    currency?: string;
    billingInterval?: "one_time" | "month" | "year" | "invoice";
    successUrl?: string;
    cancelUrl?: string;
  };

  if (body.action === "checkout") {
    if (!body.priceId) return NextResponse.json({ data: null, error: "Price is required." }, { status: 400 });
    const checkout = await createCheckout({
      tenantId: context.tenant.id,
      userId: user.id,
      priceId: body.priceId,
      successUrl: body.successUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student/dashboard`,
      cancelUrl: body.cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student/dashboard`,
    });
    return NextResponse.json({ data: checkout, error: null });
  }

  await requirePermission(user, context, PERMISSIONS.billingManage);
  if (body.action === "create_price") {
    if (!body.productId || body.amountCents === undefined) {
      return NextResponse.json({ data: null, error: "Product and amount are required." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO billing_prices (
         id, tenant_id, product_id, provider, currency, amount_cents, billing_interval, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        id,
        context.tenant.id,
        body.productId,
        process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "manual",
        (body.currency || "usd").toLowerCase(),
        Math.max(0, Number(body.amountCents)),
        body.billingInterval || "one_time",
      ],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  if (!body.title) return NextResponse.json({ data: null, error: "Product title is required." }, { status: 400 });
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO billing_products (
       id, tenant_id, title, description, product_type, course_id, status, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'active', '{}', datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      body.title.trim(),
      body.description ?? null,
      ["course", "bundle", "membership", "subscription"].includes(body.productType || "") ? body.productType : "course",
      body.courseId ?? null,
    ],
  );
  return NextResponse.json({ data: { id }, error: null });
}
