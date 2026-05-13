import { createCheckout, grantEntitlement } from "@/lib/billing";
import { d1Query } from "@/lib/db/d1";
import { sanitizeCatalogMetadata } from "@/lib/security/media";
import type { BillingPrice, BillingProduct, Tenant, TenantPortal } from "@/types";

type CatalogRow = BillingProduct & {
  tenant_name: string;
  tenant_slug: string;
  portal_id: string | null;
  portal_slug: string | null;
  portal_name: string | null;
  portal_audience: string | null;
  portal_catalog_settings: Record<string, unknown> | string | null;
  lesson_title: string | null;
  lesson_subject: string | null;
  lesson_grade_level: string | null;
  lesson_duration: number | null;
  lesson_thumbnail_url: string | null;
};

export type PublicCatalogItem = {
  id: string;
  title: string;
  description: string | null;
  productType: string;
  organization: { id: string; name: string; slug: string };
  portal: { id: string; name: string; slug: string; audience: string } | null;
  lesson: {
    id: string | null;
    title: string | null;
    subject: string | null;
    gradeLevel: string | null;
    durationMinutes: number | null;
  };
  metadata: ReturnType<typeof sanitizeCatalogMetadata>;
  price: {
    id: string | null;
    amountCents: number;
    currency: string;
    interval: string;
    label: string;
    isFree: boolean;
  };
  detailUrl: string;
};

function priceLabel(price?: BillingPrice | null) {
  if (!price || price.amount_cents <= 0) return "Free";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency || "usd",
  }).format(price.amount_cents / 100);
  return price.billing_interval === "one_time" ? amount : `${amount}/${price.billing_interval}`;
}

function portalCatalogSettings(row: CatalogRow) {
  const value = row.portal_catalog_settings;
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function activePrices(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, BillingPrice>();
  const placeholders = productIds.map(() => "?").join(", ");
  const rows = await d1Query<BillingPrice>(
    `SELECT * FROM billing_prices WHERE active = 1 AND product_id IN (${placeholders}) ORDER BY amount_cents ASC, created_at ASC`,
    productIds,
  );
  const byProduct = new Map<string, BillingPrice>();
  for (const row of rows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, row);
  }
  return byProduct;
}

function toPublicItem(row: CatalogRow, price?: BillingPrice | null): PublicCatalogItem {
  const metadata = sanitizeCatalogMetadata(row.metadata);
  const fallbackThumb = metadata.thumbnailUrl || row.lesson_thumbnail_url || null;
  const safeMetadata = sanitizeCatalogMetadata({ ...metadata, thumbnailUrl: fallbackThumb });
  const amountCents = price?.amount_cents ?? 0;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    productType: row.product_type,
    organization: { id: row.tenant_id, name: row.tenant_name, slug: row.tenant_slug },
    portal: row.portal_id
      ? {
          id: row.portal_id,
          name: row.portal_name || row.tenant_name,
          slug: row.portal_slug || "main",
          audience: row.portal_audience || "public",
        }
      : null,
    lesson: {
      id: row.course_id,
      title: row.lesson_title,
      subject: row.lesson_subject,
      gradeLevel: row.lesson_grade_level,
      durationMinutes: row.lesson_duration,
    },
    metadata: safeMetadata,
    price: {
      id: price?.id ?? null,
      amountCents,
      currency: price?.currency ?? "usd",
      interval: price?.billing_interval ?? "one_time",
      label: priceLabel(price),
      isFree: amountCents <= 0 || safeMetadata.enrollmentMode === "free",
    },
    detailUrl: `/catalog/${row.id}`,
  };
}

export async function listPublicCatalog(input: {
  query?: string | null;
  portalSlug?: string | null;
  tenantSlug?: string | null;
  featuredOnly?: boolean;
} = {}) {
  const params: unknown[] = [];
  const where = ["bp.status = 'active'"];

  if (input.portalSlug) {
    where.push("tp.slug = ?");
    where.push("tp.audience IN ('public', 'customer', 'partner')");
    params.push(input.portalSlug);
  }

  if (input.tenantSlug) {
    where.push("t.slug = ?");
    params.push(input.tenantSlug);
  }

  if (input.query) {
    where.push("(lower(bp.title) LIKE lower(?) OR lower(COALESCE(bp.description, '')) LIKE lower(?) OR lower(COALESCE(l.subject, '')) LIKE lower(?))");
    const like = `%${input.query.trim()}%`;
    params.push(like, like, like);
  }

  const rows = await d1Query<CatalogRow>(
    `SELECT bp.*, t.name AS tenant_name, t.slug AS tenant_slug,
            tp.id AS portal_id, tp.slug AS portal_slug, tp.name AS portal_name, tp.audience AS portal_audience,
            tp.catalog_settings AS portal_catalog_settings,
            l.title AS lesson_title, l.subject AS lesson_subject, l.grade_level AS lesson_grade_level,
            l.estimated_duration AS lesson_duration, l.thumbnail_url AS lesson_thumbnail_url
       FROM billing_products bp
       JOIN tenants t ON t.id = bp.tenant_id
       LEFT JOIN tenant_object_links tol ON tol.object_table = 'billing_products' AND tol.object_id = bp.id
       LEFT JOIN tenant_portals tp ON tp.id = tol.portal_id OR (tp.tenant_id = bp.tenant_id AND tp.is_default = 1)
       LEFT JOIN lessons l ON l.id = bp.course_id
      WHERE ${where.join(" AND ")}
      ORDER BY bp.updated_at DESC
      LIMIT 100`,
    params,
  );

  const prices = await activePrices(rows.map((row) => row.id));
  return rows
    .map((row) => ({ row, item: toPublicItem(row, prices.get(row.id)) }))
    .filter(({ row, item }) => {
      const portalSettings = portalCatalogSettings(row);
      if (input.portalSlug && portalSettings.enabled === false) return false;
      const visible = input.portalSlug
        ? item.metadata.visibility === "public" || item.metadata.visibility === "portal"
        : item.metadata.visibility === "public";
      if (!visible) return false;
      if ((input.featuredOnly || portalSettings.featuredOnly) && !item.metadata.featured) return false;
      return true;
    })
    .map(({ item }) => item);
}

export async function getPublicCatalogItem(id: string) {
  const rows = await d1Query<CatalogRow>(
    `SELECT bp.*, t.name AS tenant_name, t.slug AS tenant_slug,
            tp.id AS portal_id, tp.slug AS portal_slug, tp.name AS portal_name, tp.audience AS portal_audience,
            tp.catalog_settings AS portal_catalog_settings,
            l.title AS lesson_title, l.subject AS lesson_subject, l.grade_level AS lesson_grade_level,
            l.estimated_duration AS lesson_duration, l.thumbnail_url AS lesson_thumbnail_url
       FROM billing_products bp
       JOIN tenants t ON t.id = bp.tenant_id
       LEFT JOIN tenant_object_links tol ON tol.object_table = 'billing_products' AND tol.object_id = bp.id
       LEFT JOIN tenant_portals tp ON tp.id = tol.portal_id OR (tp.tenant_id = bp.tenant_id AND tp.is_default = 1)
       LEFT JOIN lessons l ON l.id = bp.course_id
      WHERE bp.id = ? AND bp.status = 'active'
      LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const prices = await activePrices([row.id]);
  const item = toPublicItem(row, prices.get(row.id));
  const portalSettings = portalCatalogSettings(row);
  const portalVisible =
    item.metadata.visibility === "portal" &&
    ["public", "customer", "partner"].includes(row.portal_audience || "") &&
    portalSettings.enabled !== false;
  const visible = item.metadata.visibility === "public" || portalVisible;
  return visible ? item : null;
}

export async function enrollCatalogItem(input: {
  item: PublicCatalogItem;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const existing = await d1Query<{ id: string }>(
    "SELECT id FROM entitlements WHERE tenant_id = ? AND user_id = ? AND product_id = ? AND status = 'active' LIMIT 1",
    [input.item.organization.id, input.userId, input.item.id],
  );
  if (existing[0]) return { mode: "active" as const, url: null, entitlementId: existing[0].id };

  if (input.item.price.isFree || !input.item.price.id) {
    await grantEntitlement({
      tenantId: input.item.organization.id,
      userId: input.userId,
      productId: input.item.id,
      sourceType: "catalog_free",
      sourceId: input.item.id,
    });
    return { mode: "enrolled" as const, url: null, entitlementId: null };
  }

  return createCheckout({
    tenantId: input.item.organization.id,
    userId: input.userId,
    priceId: input.item.price.id,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
}

export async function listPublicPortals() {
  return d1Query<TenantPortal & { tenant_name: string; tenant_slug: string }>(
    `SELECT tp.*, t.name AS tenant_name, t.slug AS tenant_slug
       FROM tenant_portals tp
       JOIN tenants t ON t.id = tp.tenant_id
      WHERE tp.audience IN ('public', 'customer', 'partner')
      ORDER BY tp.is_default DESC, tp.name ASC
      LIMIT 100`,
  );
}

export type CatalogTenant = Tenant;
