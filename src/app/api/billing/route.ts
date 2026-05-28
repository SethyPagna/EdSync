import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createCheckout } from "@/lib/billing";
import {
  normalizeCheckoutUrl,
  normalizeOptionalBillingId,
  normalizePriceInput,
  normalizeProductInput,
  normalizeProductStatus,
  validateBillingId,
} from "@/lib/validation/billing";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { sanitizeCatalogMetadata } from "@/lib/security/media";
import { resolveTenantContext } from "@/lib/tenancy";

function catalogMediaWarnings(
  source: Record<string, unknown> | undefined,
  sanitized: ReturnType<typeof sanitizeCatalogMetadata>,
) {
  const warnings: string[] = [];
  if (typeof source?.thumbnailUrl === "string" && source.thumbnailUrl.trim() && !sanitized.thumbnailUrl) {
    warnings.push("Unsafe thumbnail URL was removed.");
  }
  if (typeof source?.previewVideoUrl === "string" && source.previewVideoUrl.trim() && !sanitized.previewVideoUrl) {
    warnings.push("Unsafe preview video URL was removed.");
  }
  return warnings;
}

function badBillingRequest(error: unknown, fallback = "Invalid billing request.") {
  return NextResponse.json({ data: null, error: error instanceof Error ? error.message : fallback }, { status: 400 });
}

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
  const body = (await request.json().catch(() => null)) as {
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
  } | null;

  if (!body) {
    return NextResponse.json({ data: null, error: "Invalid billing request." }, { status: 400 });
  }

  if (body.action === "checkout") {
    let priceId: string;
    let successUrl: string;
    let cancelUrl: string;
    try {
      priceId = validateBillingId(body.priceId, "Price");
      const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student/dashboard`;
      successUrl = normalizeCheckoutUrl(body.successUrl, fallbackUrl);
      cancelUrl = normalizeCheckoutUrl(body.cancelUrl, fallbackUrl);
    } catch (error) {
      return badBillingRequest(error);
    }
    const checkout = await createCheckout({
      tenantId: context.tenant.id,
      userId: user.id,
      priceId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json({ data: checkout, error: null });
  }

  try {
    await requirePermission(user, context, PERMISSIONS.billingManage);
  } catch {
    return NextResponse.json({ data: null, error: "Missing billing management permission." }, { status: 403 });
  }

  if (body.action === "update_catalog") {
    let productId: string;
    let portalId: string | null | undefined;
    try {
      productId = validateBillingId(body.productId, "Product");
      portalId = normalizeOptionalBillingId(body.portalId, "Portal");
    } catch (error) {
      return badBillingRequest(error);
    }
    const metadata = sanitizeCatalogMetadata(body.metadata);
    const warnings = catalogMediaWarnings(body.metadata, metadata);
    const status = normalizeProductStatus(body.status);
    await d1Query(
      "UPDATE billing_products SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      [status, JSON.stringify(metadata), productId, context.tenant.id],
    );
    if (portalId) {
      await d1Query(
        `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
         VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))
         ON CONFLICT(object_table, object_id) DO UPDATE SET portal_id = excluded.portal_id`,
        [crypto.randomUUID(), context.tenant.id, portalId, productId],
      );
    } else if (portalId === null) {
      await d1Query(
        "DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?",
        [context.tenant.id, productId],
      );
    }
    return NextResponse.json({ data: { id: productId, warnings }, error: null });
  }

  if (body.action === "update_product") {
    let productId: string;
    let portalId: string | null | undefined;
    let product: ReturnType<typeof normalizeProductInput>;
    try {
      productId = validateBillingId(body.productId, "Product");
      portalId = normalizeOptionalBillingId(body.portalId, "Portal");
      product = normalizeProductInput(body);
    } catch (error) {
      return badBillingRequest(error);
    }
    const metadata = sanitizeCatalogMetadata(body.metadata);
    const warnings = catalogMediaWarnings(body.metadata, metadata);
    await d1Query(
      `UPDATE billing_products
       SET title = ?, description = ?, product_type = ?, course_id = ?, status = ?, metadata = ?, updated_at = datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        product.title,
        product.description,
        product.productType,
        product.courseId,
        product.status,
        JSON.stringify(metadata),
        productId,
        context.tenant.id,
      ],
    );
    if (portalId) {
      await d1Query(
        `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
         VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))
         ON CONFLICT(object_table, object_id) DO UPDATE SET portal_id = excluded.portal_id`,
        [crypto.randomUUID(), context.tenant.id, portalId, productId],
      );
    } else if (portalId === null) {
      await d1Query(
        "DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?",
        [context.tenant.id, productId],
      );
    }
    return NextResponse.json({ data: { id: productId, warnings }, error: null });
  }

  if (body.action === "delete_product") {
    let productId: string;
    try {
      productId = validateBillingId(body.productId, "Product");
    } catch (error) {
      return badBillingRequest(error);
    }
    const [usage] = await d1Query<{ entitlement_count: number; transaction_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM entitlements WHERE tenant_id = ? AND product_id = ?) AS entitlement_count,
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND product_id = ?) AS transaction_count`,
      [context.tenant.id, productId, context.tenant.id, productId],
    );
    await d1Query("DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?", [
      context.tenant.id,
      productId,
    ]);
    if ((usage?.entitlement_count ?? 0) > 0 || (usage?.transaction_count ?? 0) > 0) {
      await d1Query(
        "UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND product_id = ?",
        [context.tenant.id, productId],
      );
      await d1Query(
        "UPDATE billing_products SET status = 'archived', metadata = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        [
          JSON.stringify(sanitizeCatalogMetadata({ visibility: "private", enrollmentMode: "closed" })),
          context.tenant.id,
          productId,
        ],
      );
      return NextResponse.json({ data: { id: productId, mode: "archived" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND product_id = ?", [context.tenant.id, productId]);
    await d1Query("DELETE FROM billing_products WHERE tenant_id = ? AND id = ?", [context.tenant.id, productId]);
    return NextResponse.json({ data: { id: productId, mode: "deleted" }, error: null });
  }

  if (body.action === "create_price") {
    let price: ReturnType<typeof normalizePriceInput>;
    try {
      price = normalizePriceInput(body);
    } catch (error) {
      return badBillingRequest(error);
    }
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO billing_prices (
         id, tenant_id, product_id, provider, currency, amount_cents, billing_interval, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        id,
        context.tenant.id,
        price.productId,
        process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "manual",
        price.currency,
        price.amountCents,
        price.billingInterval,
      ],
    );
    return NextResponse.json({ data: { id }, error: null });
  }

  if (body.action === "update_price") {
    let priceId: string;
    let price: ReturnType<typeof normalizePriceInput>;
    try {
      priceId = validateBillingId(body.priceId, "Price");
      price = normalizePriceInput(body);
    } catch (error) {
      return badBillingRequest(error);
    }
    await d1Query(
      `UPDATE billing_prices
       SET product_id = ?, currency = ?, amount_cents = ?, billing_interval = ?, active = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?`,
      [
        price.productId,
        price.currency,
        price.amountCents,
        price.billingInterval,
        price.active ? 1 : 0,
        priceId,
        context.tenant.id,
      ],
    );
    return NextResponse.json({ data: { id: priceId }, error: null });
  }

  if (body.action === "delete_price") {
    let priceId: string;
    try {
      priceId = validateBillingId(body.priceId, "Price");
    } catch (error) {
      return badBillingRequest(error);
    }
    const [usage] = await d1Query<{ transaction_count: number; subscription_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND price_id = ?) AS transaction_count,
         (SELECT COUNT(*) FROM billing_subscriptions WHERE tenant_id = ? AND price_id = ?) AS subscription_count`,
      [context.tenant.id, priceId, context.tenant.id, priceId],
    );
    if ((usage?.transaction_count ?? 0) > 0 || (usage?.subscription_count ?? 0) > 0) {
      await d1Query("UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
        context.tenant.id,
        priceId,
      ]);
      return NextResponse.json({ data: { id: priceId, mode: "deactivated" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND id = ?", [context.tenant.id, priceId]);
    return NextResponse.json({ data: { id: priceId, mode: "deleted" }, error: null });
  }

  let product: ReturnType<typeof normalizeProductInput>;
  let portalId: string | null | undefined;
  try {
    product = normalizeProductInput(body);
    portalId = normalizeOptionalBillingId(body.portalId, "Portal");
  } catch (error) {
    return badBillingRequest(error);
  }
  const id = crypto.randomUUID();
  const metadata = sanitizeCatalogMetadata(body.metadata);
  const warnings = catalogMediaWarnings(body.metadata, metadata);
  await d1Query(
    `INSERT INTO billing_products (
       id, tenant_id, title, description, product_type, course_id, status, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))`,
    [
      id,
      context.tenant.id,
      product.title,
      product.description,
      product.productType,
      product.courseId,
      JSON.stringify(metadata),
    ],
  );
  if (portalId) {
    await d1Query(
      `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
       VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))`,
      [crypto.randomUUID(), context.tenant.id, portalId, id],
    );
  }
  return NextResponse.json({ data: { id, warnings }, error: null });
}
