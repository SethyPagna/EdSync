import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { completeTransaction, createCheckout } from "@/lib/billing";
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
import { PERMISSIONS, getPermissionSet, requirePermission } from "@/lib/permissions";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { sanitizeCatalogMetadata } from "@/lib/security/media";
import { DEFAULT_TENANT_ID, resolveTenantContext } from "@/lib/tenancy";
import { isTenantOutsider } from "@/lib/tenancy/ownership";

type BillingAction =
  | "create_product"
  | "create_price"
  | "checkout"
  | "update_catalog"
  | "update_product"
  | "delete_product"
  | "update_price"
  | "delete_price"
  | "mark_paid";

type BillingBody = {
  action?: BillingAction;
  title?: string;
  description?: string | null;
  productType?: string;
  courseId?: string | null;
  productId?: string;
  priceId?: string;
  transactionId?: string;
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

function validated<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid billing request.");
  }
}

async function requireTenantProduct(tenantId: string, productId: string) {
  const [product] = await d1Query<{ id: string }>(
    "SELECT id FROM billing_products WHERE id = ? AND tenant_id = ? LIMIT 1",
    [productId, tenantId],
  );
  if (!product) throw new NotFoundError("Product not found.");
}

async function requireTenantPortal(tenantId: string, portalId: string) {
  const [portal] = await d1Query<{ id: string }>(
    "SELECT id FROM tenant_portals WHERE id = ? AND tenant_id = ? LIMIT 1",
    [portalId, tenantId],
  );
  if (!portal) throw new NotFoundError("Portal not found.");
}

// Lessons are rarely linked to a tenant, so an unlinked lesson is sellable when its author belongs to the tenant.
async function requireSellableCourse(tenantId: string, courseId: string | null) {
  if (!courseId) return;
  const [course] = await d1Query<{ id: string }>(
    `SELECT l.id
       FROM lessons l
       LEFT JOIN tenant_object_links tol ON tol.object_table = 'lessons' AND tol.object_id = l.id
      WHERE l.id = ?
        AND (
          tol.tenant_id = ?
          OR (
            tol.id IS NULL
            AND (
              ? = ?
              OR EXISTS (
                SELECT 1
                  FROM tenant_memberships tm
                 WHERE tm.tenant_id = ? AND tm.user_id = l.teacher_id AND tm.status = 'active'
              )
            )
          )
        )
      LIMIT 1`,
    [courseId, tenantId, tenantId, DEFAULT_TENANT_ID, tenantId],
  );
  if (!course) throw new NotFoundError("Course not found.");
}

async function setProductPortal(tenantId: string, productId: string, portalId: string | null | undefined) {
  if (portalId) {
    await d1Query(
      `INSERT INTO tenant_object_links (id, tenant_id, portal_id, object_table, object_id, created_at)
       VALUES (?, ?, ?, 'billing_products', ?, datetime('now'))
       ON CONFLICT(object_table, object_id) DO UPDATE SET portal_id = excluded.portal_id
       WHERE tenant_object_links.tenant_id = excluded.tenant_id`,
      [crypto.randomUUID(), tenantId, portalId, productId],
    );
  } else if (portalId === null) {
    await d1Query(
      "DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?",
      [tenantId, productId],
    );
  }
}

export const GET = withRoute(async () => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  if (isTenantOutsider(user, context)) throw new ForbiddenError("Organization membership required.");
  const permissions = await getPermissionSet(user, context);
  const canManage = permissions.has(PERMISSIONS.billingManage);
  const [productRows, priceRows, entitlementRows, transactionRows] = await Promise.all([
    d1Query("SELECT * FROM billing_products WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM billing_prices WHERE tenant_id = ? ORDER BY updated_at DESC", [context.tenant.id]),
    d1Query("SELECT * FROM entitlements WHERE tenant_id = ? AND (? = 'admin' OR user_id = ?) ORDER BY updated_at DESC LIMIT 100", [
      context.tenant.id,
      user.user_metadata.role,
      user.id,
    ]),
    canManage
      ? d1Query(
          `SELECT id, product_id, price_id, provider, amount_cents, currency, status, metadata, created_at, updated_at
             FROM billing_transactions
            WHERE tenant_id = ?
            ORDER BY created_at DESC
            LIMIT 100`,
          [context.tenant.id],
        )
      : Promise.resolve([]),
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
  const transactions = transactionRows.map((row) => deserializeRow("billing_transactions", row));
  const portals = portalRows.map((row) => deserializeRow("tenant_portals", row));
  return NextResponse.json({ data: { products, prices, entitlements, transactions, portals, links, context }, error: null });
});

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  const body = await readJson<BillingBody>(request).catch(() => {
    throw new BadRequestError("Invalid billing request.");
  });
  const tenantId = context.tenant.id;

  if (body.action === "checkout") {
    const { priceId, successUrl, cancelUrl } = validated(() => {
      const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student/dashboard`;
      return {
        priceId: validateBillingId(body.priceId, "Price"),
        successUrl: normalizeCheckoutUrl(body.successUrl, fallbackUrl),
        cancelUrl: normalizeCheckoutUrl(body.cancelUrl, fallbackUrl),
      };
    });
    const checkout = await createCheckout({ tenantId, userId: user.id, priceId, successUrl, cancelUrl });
    return NextResponse.json({ data: checkout, error: null });
  }

  await requirePermission(user, context, PERMISSIONS.billingManage).catch(() => {
    throw new ForbiddenError("Missing billing management permission.");
  });

  if (body.action === "mark_paid") {
    const transactionId = validated(() => validateBillingId(body.transactionId, "Transaction"));
    const result = await completeTransaction({ tenantId, transactionId, sourceType: "manual_payment" });
    if (result.status === "not_found") throw new NotFoundError("Transaction not found.");
    if (result.status !== "paid") throw new ConflictError("Transaction cannot be marked paid.");
    return NextResponse.json({ data: result, error: null });
  }

  if (body.action === "update_catalog") {
    const { productId, portalId } = validated(() => ({
      productId: validateBillingId(body.productId, "Product"),
      portalId: normalizeOptionalBillingId(body.portalId, "Portal"),
    }));
    await requireTenantProduct(tenantId, productId);
    if (portalId) await requireTenantPortal(tenantId, portalId);
    const metadata = sanitizeCatalogMetadata(body.metadata);
    const warnings = catalogMediaWarnings(body.metadata, metadata);
    const status = normalizeProductStatus(body.status);
    await d1Query(
      "UPDATE billing_products SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      [status, JSON.stringify(metadata), productId, tenantId],
    );
    await setProductPortal(tenantId, productId, portalId);
    return NextResponse.json({ data: { id: productId, warnings }, error: null });
  }

  if (body.action === "update_product") {
    const { productId, portalId, product } = validated(() => ({
      productId: validateBillingId(body.productId, "Product"),
      portalId: normalizeOptionalBillingId(body.portalId, "Portal"),
      product: normalizeProductInput(body),
    }));
    await requireTenantProduct(tenantId, productId);
    if (portalId) await requireTenantPortal(tenantId, portalId);
    await requireSellableCourse(tenantId, product.courseId);
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
        tenantId,
      ],
    );
    await setProductPortal(tenantId, productId, portalId);
    return NextResponse.json({ data: { id: productId, warnings }, error: null });
  }

  if (body.action === "delete_product") {
    const productId = validated(() => validateBillingId(body.productId, "Product"));
    const [usage] = await d1Query<{ entitlement_count: number; transaction_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM entitlements WHERE tenant_id = ? AND product_id = ?) AS entitlement_count,
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND product_id = ?) AS transaction_count`,
      [tenantId, productId, tenantId, productId],
    );
    await d1Query("DELETE FROM tenant_object_links WHERE tenant_id = ? AND object_table = 'billing_products' AND object_id = ?", [
      tenantId,
      productId,
    ]);
    if ((usage?.entitlement_count ?? 0) > 0 || (usage?.transaction_count ?? 0) > 0) {
      await d1Query(
        "UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND product_id = ?",
        [tenantId, productId],
      );
      await d1Query(
        "UPDATE billing_products SET status = 'archived', metadata = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        [
          JSON.stringify(sanitizeCatalogMetadata({ visibility: "private", enrollmentMode: "closed" })),
          tenantId,
          productId,
        ],
      );
      return NextResponse.json({ data: { id: productId, mode: "archived" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND product_id = ?", [tenantId, productId]);
    await d1Query("DELETE FROM billing_products WHERE tenant_id = ? AND id = ?", [tenantId, productId]);
    return NextResponse.json({ data: { id: productId, mode: "deleted" }, error: null });
  }

  if (body.action === "create_price") {
    const price = validated(() => normalizePriceInput(body));
    await requireTenantProduct(tenantId, price.productId);
    const id = crypto.randomUUID();
    await d1Query(
      `INSERT INTO billing_prices (
         id, tenant_id, product_id, provider, currency, amount_cents, billing_interval, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        id,
        tenantId,
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
    const { priceId, price } = validated(() => ({
      priceId: validateBillingId(body.priceId, "Price"),
      price: normalizePriceInput(body),
    }));
    await requireTenantProduct(tenantId, price.productId);
    const [updated] = await d1Query<{ id: string }>(
      `UPDATE billing_prices
       SET product_id = ?, currency = ?, amount_cents = ?, billing_interval = ?, active = ?, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
      RETURNING id`,
      [
        price.productId,
        price.currency,
        price.amountCents,
        price.billingInterval,
        price.active ? 1 : 0,
        priceId,
        tenantId,
      ],
    );
    if (!updated) throw new NotFoundError("Price not found.");
    return NextResponse.json({ data: { id: priceId }, error: null });
  }

  if (body.action === "delete_price") {
    const priceId = validated(() => validateBillingId(body.priceId, "Price"));
    const [usage] = await d1Query<{ transaction_count: number; subscription_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM billing_transactions WHERE tenant_id = ? AND price_id = ?) AS transaction_count,
         (SELECT COUNT(*) FROM billing_subscriptions WHERE tenant_id = ? AND price_id = ?) AS subscription_count`,
      [tenantId, priceId, tenantId, priceId],
    );
    if ((usage?.transaction_count ?? 0) > 0 || (usage?.subscription_count ?? 0) > 0) {
      await d1Query("UPDATE billing_prices SET active = 0, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?", [
        tenantId,
        priceId,
      ]);
      return NextResponse.json({ data: { id: priceId, mode: "deactivated" }, error: null });
    }
    await d1Query("DELETE FROM billing_prices WHERE tenant_id = ? AND id = ?", [tenantId, priceId]);
    return NextResponse.json({ data: { id: priceId, mode: "deleted" }, error: null });
  }

  const { product, portalId } = validated(() => ({
    product: normalizeProductInput(body),
    portalId: normalizeOptionalBillingId(body.portalId, "Portal"),
  }));
  if (portalId) await requireTenantPortal(tenantId, portalId);
  await requireSellableCourse(tenantId, product.courseId);
  const id = crypto.randomUUID();
  const metadata = sanitizeCatalogMetadata(body.metadata);
  const warnings = catalogMediaWarnings(body.metadata, metadata);
  await d1Query(
    `INSERT INTO billing_products (
       id, tenant_id, title, description, product_type, course_id, status, metadata, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))`,
    [
      id,
      tenantId,
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
      [crypto.randomUUID(), tenantId, portalId, id],
    );
  }
  return NextResponse.json({ data: { id, warnings }, error: null });
});
