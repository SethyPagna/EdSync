import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createCheckout } from "@/lib/billing";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { sanitizeCatalogMetadata } from "@/lib/security/media";
import { resolveTenantContext } from "@/lib/tenancy";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const [productRows, priceRows, entitlementRows] = await Promise.all([
    d1Query("SELECT * FROM billing_products WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM billing_prices WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM entitlements WHERE tenant_id = ? AND (? = 'admin' OR user_id = ?) ORDER BY updated_at DESC LIMIT 100", [
      context.tenant.id,
      user.user_metadata.role,
      user.id,
    ]),
  ]);
  const [portalRows, links] = await Promise.all([
    d1Query("SELECT * FROM tenant_portals WHERE tenant_id = ? ORDER BY is_default DESC, name", [context.tenant.id]),
    d1Query(
      "SELECT portal_id, object_id FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products'",
      [context.tenant.id],
    ),
  ]);
  const products = productRows.map((row) => deserializeRow("billing_products", row));
  const prices = priceRows.map((row) => deserializeRow("billing_prices", row));
  const entitlements = entitlementRows.map((row) => deserializeRow("entitlements", row));
  const portals = portalRows.map((row) => deserializeRow("tenant_portals", row));
  return NextResponse.json({ data: { products, prices, entitlements, portals, links, context }, error: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  const body = (await request.json()) as {
    action?:
      | "create_product"
      | "create_price"
      | "checkout"
      | "update_catalog"
      | "update_product"
      | "delete_product"
      | "update_price"
      | "delete_price";
    title?: string;
    description?: string | null;
    productType?: string;
    courseId?: string | null;
    productId?: string;
    priceId?: string;
    amountCents?: number;
    currency?: string;
    billingInterval?: "one_time" | "month" | "year" | "invoice";
    active?: boolean;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, unknown>;
    status?: "draft" | "active" | "archived";
    portalId?: string | null;
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

  try {
    await requirePermission(user, context, PERMISSIONS.billingManage);
  } catch {
    return NextResponse.json({ data: null, error: "Missing billing management permission." }, { status: 403 });
  }

  if (body.action === "update_catalog") {
    if (!body.productId) return NextResponse.json({ data: null, error: "Product is required." }, { status: 400 });
    const metadata = sanitizeCatalogMetadata(body.metadata);
    const status = body.status === "active" || body.status === "archived" || body.status === "draft" ? body.status : "draft";
    await d1Query(
      "UPDATE billing_products SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      [status, metadata, body.productId, context.tenant.id],
    );
    if (body.portalId) {
      await d1Query(
        `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
         VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))
         ON CONFLICT(object_table, object_id) DO UPDATE SET portal_id = excluded.portal_id`,
        [crypto.randomUUID(), context.tenant.id, body.portalId, body.productId],
      );
    } else if (body.portalId === null) {
      await d1Query(
        "DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?",
        [context.tenant.id, body.productId],
      );
    }
    return NextResponse.json({ data: { id: body.productId }, error: null });
  }

  if (body.action === "update_product") {
    if (!body.productId || !body.title?.trim()) {
      return NextResponse.json({ data: null, error: "Product title is required." }, { status: 400 });
    }
    const metadata = sanitizeCatalogMetadata(body.metadata);
    const status = body.status === "active" || body.status === "archived" || body.status === "draft" ? body.status : "draft";
    await d1Query(
      `UPDATE billing_products
       SET title = ?, description = ?, product_type = ?, course_id = ?, status = ?, metadata = ?, updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        body.title.trim(),
        body.description ?? null,
        ["course", "bundle", "membership", "subscription"].includes(body.productType || "") ? body.productType : "course",
        body.courseId ?? null,
        status,
        metadata,
        body.productId,
        context.tenant.id,
      ],
    );
    if (body.portalId) {
      await d1Query(
        `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
         VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))
         ON CONFLICT(object_table, object_id) DO UPDATE SET portal_id = excluded.portal_id`,
        [crypto.randomUUID(), context.tenant.id, body.portalId, body.productId],
      );
    } else {
      await d1Query(
        "DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?",
        [context.tenant.id, body.productId],
      );
    }
    return NextResponse.json({ data: { id: body.productId }, error: null });
  }

  if (body.action === "delete_product") {
    if (!body.productId) return NextResponse.json({ data: null, error: "Product is required." }, { status: 400 });
    const [usage] = await d1Query<{ entitlement_count: number; transaction_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM entitlements WHERE tenant_id = ? AND product_id = ?) AS entitlement_count,
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND product_id = ?) AS transaction_count`,
      [context.tenant.id, body.productId, context.tenant.id, body.productId],
    );
    await d1Query("DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?", [
      context.tenant.id,
      body.productId,
    ]);
    if ((usage?.entitlement_count ?? 0) > 0 || (usage?.transaction_count ?? 0) > 0) {
      await d1Query(
        "UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND product_id = ?",
        [context.tenant.id, body.productId],
      );
      await d1Query(
        "UPDATE billing_products SET status = 'archived', metadata = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        [
          sanitizeCatalogMetadata({ visibility: "private", enrollmentMode: "closed" }),
          context.tenant.id,
          body.productId,
        ],
      );
      return NextResponse.json({ data: { id: body.productId, mode: "archived" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND product_id = ?", [context.tenant.id, body.productId]);
    await d1Query("DELETE FROM billing_products WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.productId]);
    return NextResponse.json({ data: { id: body.productId, mode: "deleted" }, error: null });
  }

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

  if (body.action === "update_price") {
    if (!body.priceId || !body.productId || body.amountCents === undefined) {
      return NextResponse.json({ data: null, error: "Price, product, and amount are required." }, { status: 400 });
    }
    await d1Query(
      `UPDATE billing_prices
       SET product_id = ?, currency = ?, amount_cents = ?, billing_interval = ?, active = ?, updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        body.productId,
        (body.currency || "usd").toLowerCase(),
        Math.max(0, Number(body.amountCents)),
        body.billingInterval || "one_time",
        body.active === false ? 0 : 1,
        body.priceId,
        context.tenant.id,
      ],
    );
    return NextResponse.json({ data: { id: body.priceId }, error: null });
  }

  if (body.action === "delete_price") {
    if (!body.priceId) return NextResponse.json({ data: null, error: "Price is required." }, { status: 400 });
    const [usage] = await d1Query<{ transaction_count: number; subscription_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND price_id = ?) AS transaction_count,
         (SELECT COUNT(*) FROM billing_subscriptions WHERE tenant_id = ? AND price_id = ?) AS subscription_count`,
      [context.tenant.id, body.priceId, context.tenant.id, body.priceId],
    );
    if ((usage?.transaction_count ?? 0) > 0 || (usage?.subscription_count ?? 0) > 0) {
      await d1Query("UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
        context.tenant.id,
        body.priceId,
      ]);
      return NextResponse.json({ data: { id: body.priceId, mode: "deactivated" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND id = ?", [context.tenant.id, body.priceId]);
    return NextResponse.json({ data: { id: body.priceId, mode: "deleted" }, error: null });
  }

  if (!body.title) return NextResponse.json({ data: null, error: "Product title is required." }, { status: 400 });
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO billing_products (
       id, tenant_id, title, description, product_type, course_id, status, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      body.title.trim(),
      body.description ?? null,
      ["course", "bundle", "membership", "subscription"].includes(body.productType || "") ? body.productType : "course",
      body.courseId ?? null,
      sanitizeCatalogMetadata(body.metadata),
    ],
  );
  if (body.portalId) {
    await d1Query(
      `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
       VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))`,
      [crypto.randomUUID(), context.tenant.id, body.portalId, id],
    );
  }
  return NextResponse.json({ data: { id }, error: null });
}
