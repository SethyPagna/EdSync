"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Check,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { ActionMenu } from "@/components/WorkspacePrimitives";
import type { BillingPrice, BillingProduct, Entitlement, Tenant, TenantPortal } from "@/types";

type CatalogMetadata = {
  visibility?: "private" | "public" | "portal";
  enrollmentMode?: "closed" | "free" | "paid";
  category?: string;
  language?: string;
  difficulty?: string;
  thumbnailUrl?: string | null;
  previewVideoUrl?: string | null;
  featured?: boolean;
};

type ProductRecord = BillingProduct & {
  metadata: CatalogMetadata;
};

type PortalLinkRecord = {
  portal_id: string | null;
  object_id: string;
};

type BillingPayload = {
  products: ProductRecord[];
  prices: BillingPrice[];
  entitlements: Entitlement[];
  portals: TenantPortal[];
  links: PortalLinkRecord[];
  context: { tenant: Tenant; portal: TenantPortal | null };
};

type ProductDraft = {
  title: string;
  description: string;
  productType: BillingProduct["product_type"];
  portalId: string;
  status: "draft" | "active" | "archived";
  visibility: "private" | "public" | "portal";
  enrollmentMode: "closed" | "free" | "paid";
  category: string;
  language: string;
  difficulty: string;
  thumbnailUrl: string;
  previewVideoUrl: string;
  featured: boolean;
};

type PriceDraft = {
  productId: string;
  amountCents: number;
  currency: string;
  billingInterval: BillingPrice["billing_interval"];
  active: boolean;
};

const emptyProduct: ProductDraft = {
  title: "",
  description: "",
  productType: "course",
  portalId: "",
  status: "draft",
  visibility: "private",
  enrollmentMode: "closed",
  category: "",
  language: "English",
  difficulty: "All levels",
  thumbnailUrl: "",
  previewVideoUrl: "",
  featured: false,
};

const emptyPrice: PriceDraft = {
  productId: "",
  amountCents: 0,
  currency: "usd",
  billingInterval: "one_time",
  active: true,
};

function metadataOf(item: ProductRecord): CatalogMetadata {
  return typeof item?.metadata === "object" && item.metadata ? item.metadata : {};
}

function productDraftFrom(item: ProductRecord, portalId = ""): ProductDraft {
  const metadata = metadataOf(item);
  return {
    title: item.title ?? "",
    description: item.description ?? "",
    productType: item.product_type ?? "course",
    portalId,
    status: item.status ?? "draft",
    visibility: metadata.visibility ?? "private",
    enrollmentMode: metadata.enrollmentMode ?? "closed",
    category: metadata.category ?? "",
    language: metadata.language ?? "English",
    difficulty: metadata.difficulty ?? "All levels",
    thumbnailUrl: metadata.thumbnailUrl ?? "",
    previewVideoUrl: metadata.previewVideoUrl ?? "",
    featured: Boolean(metadata.featured),
  };
}

function priceDraftFrom(item: BillingPrice): PriceDraft {
  return {
    productId: item.product_id ?? "",
    amountCents: Number(item.amount_cents ?? 0),
    currency: item.currency ?? "usd",
    billingInterval: item.billing_interval ?? "one_time",
    active: item.active !== false,
  };
}

function money(amountCents?: number, currency = "usd") {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format((amountCents ?? 0) / 100);
}

export default function AdminBillingPage() {
  const [payload, setPayload] = useState<BillingPayload | null>(null);
  const [product, setProduct] = useState<ProductDraft>(emptyProduct);
  const [price, setPrice] = useState<PriceDraft>(emptyPrice);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<PriceDraft>(emptyPrice);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError("");
    return fetch("/api/billing")
      .then((res) => res.json())
      .then((json: { data: BillingPayload | null; error?: string | null }) => {
        if (json.error || !json.data) throw new Error(json.error || "Catalog and billing data unavailable.");
        setPayload(json.data);
        setLoadError("");
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Catalog and billing data unavailable.");
        setPayload(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const portalById = useMemo(() => new Map<string, TenantPortal>((payload?.portals ?? []).map((item) => [item.id, item])), [payload]);
  const linksByProduct = useMemo(
    () => new Map<string, string>((payload?.links ?? []).flatMap((item) => (item.portal_id ? [[item.object_id, item.portal_id]] : []))),
    [payload],
  );
  const pricesByProduct = useMemo(() => {
    const grouped = new Map<string, BillingPrice[]>();
    for (const item of payload?.prices ?? []) {
      const list = grouped.get(item.product_id) ?? [];
      list.push(item);
      grouped.set(item.product_id, list);
    }
    return grouped;
  }, [payload]);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error || "Request failed.");
      setMessage(success);
      await load();
      return json.data ?? true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const metadataFrom = (draft: ProductDraft) => ({
    visibility: draft.visibility,
    enrollmentMode: draft.enrollmentMode,
    category: draft.category,
    language: draft.language,
    difficulty: draft.difficulty,
    thumbnailUrl: draft.thumbnailUrl,
    previewVideoUrl: draft.previewVideoUrl,
    featured: draft.featured,
  });

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run(
      {
        action: "create_product",
        title: product.title,
        description: product.description,
        productType: product.productType,
        portalId: product.portalId || null,
        metadata: metadataFrom(product),
      },
      "Product created.",
    );
    if (ok) setProduct(emptyProduct);
  };

  const createPrice = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run({ action: "create_price", ...price }, "Price created.");
    if (ok) setPrice({ ...emptyPrice, amountCents: 4900 });
  };

  const updateCatalog = async (
    item: ProductRecord,
    metadata: Record<string, unknown>,
    status = item.status,
    portalId?: string | null,
  ) => {
    await run(
      {
        action: "update_catalog",
        productId: item.id,
        status,
        portalId,
        metadata: { ...metadataOf(item), ...metadata },
      },
      "Catalog settings updated.",
    );
  };

  const startProductEdit = (item: ProductRecord) => {
    const portalId = linksByProduct.get(item.id) || "";
    setEditingProductId(item.id);
    setProductDraft(productDraftFrom(item, portalId));
  };

  const saveProduct = async (item: ProductRecord) => {
    const ok = await run(
      {
        action: "update_product",
        productId: item.id,
        title: productDraft.title,
        description: productDraft.description,
        productType: productDraft.productType,
        status: productDraft.status,
        portalId: productDraft.portalId || null,
        metadata: metadataFrom(productDraft),
      },
      "Product saved.",
    );
    if (ok) setEditingProductId(null);
  };

  const deleteProduct = async (item: ProductRecord) => {
    if (!window.confirm(`Remove "${item.title}" from the catalog? Products with access history will be archived instead of permanently deleted.`)) return;
    const result = await run({ action: "delete_product", productId: item.id }, "Product removed.");
    if (result && typeof result === "object" && "mode" in result && result.mode === "archived") {
      setMessage("Product archived and hidden because learners or transactions are already attached.");
    }
  };

  const startPriceEdit = (item: BillingPrice) => {
    setEditingPriceId(item.id);
    setPriceDraft(priceDraftFrom(item));
  };

  const savePrice = async (item: BillingPrice) => {
    const ok = await run({ action: "update_price", priceId: item.id, ...priceDraft }, "Price saved.");
    if (ok) setEditingPriceId(null);
  };

  const togglePrice = async (item: BillingPrice) => {
    await run({ action: "update_price", priceId: item.id, ...priceDraftFrom(item), active: item.active === false }, "Price status updated.");
  };

  const deletePrice = async (item: BillingPrice) => {
    if (!window.confirm("Remove this price? Prices with transaction history will be deactivated instead of permanently deleted.")) return;
    const result = await run({ action: "delete_price", priceId: item.id }, "Price removed.");
    if (result && typeof result === "object" && "mode" in result && result.mode === "deactivated") {
      setMessage("Price deactivated because transactions or subscriptions already reference it.");
    }
  };

  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Monetization</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Catalog & Billing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Create products, attach prices, and manage whether each course appears globally, inside an organization portal, or stays private.
          </p>
        </div>
        <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle lg:max-w-md">
          Drafts stay hidden. Public products appear globally. Portal products show only through organization portals.
        </div>
      </header>

      {message && (
        <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">
          {message}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-edsync-border bg-edsync-card p-6 text-sm text-edsync-subtle">
          Loading catalog and billing controls...
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <button type="button" className="btn-secondary w-fit px-3 py-2 text-sm" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="edsync-card p-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-display text-xl font-bold">Add product</span>
              <span className="block text-sm text-edsync-subtle">Course, bundle, membership, or subscription.</span>
            </span>
          </div>
          <form onSubmit={createProduct} className="grid gap-3 border-t border-edsync-border p-4">
            <input className="edsync-input" value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} placeholder="Product title" required />
            <textarea className="edsync-input min-h-24" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} placeholder="Public summary" />
            <div className="grid gap-3 md:grid-cols-3">
              <select className="edsync-input" value={product.productType} onChange={(event) => setProduct({ ...product, productType: event.target.value as ProductDraft["productType"] })}>
                <option value="course">Course</option>
                <option value="bundle">Bundle</option>
                <option value="membership">Membership</option>
                <option value="subscription">Subscription</option>
              </select>
              <select className="edsync-input" value={product.visibility} onChange={(event) => setProduct({ ...product, visibility: event.target.value as ProductDraft["visibility"] })}>
                <option value="private">Hidden draft</option>
                <option value="public">Global catalog</option>
                <option value="portal">Portal catalog</option>
              </select>
              <select className="edsync-input" value={product.enrollmentMode} onChange={(event) => setProduct({ ...product, enrollmentMode: event.target.value as ProductDraft["enrollmentMode"] })}>
                <option value="closed">Closed</option>
                <option value="free">Free enrollment</option>
                <option value="paid">Paid checkout</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select className="edsync-input" value={product.portalId} onChange={(event) => setProduct({ ...product, portalId: event.target.value })}>
                <option value="">Default portal</option>
                {(payload?.portals ?? []).map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}
              </select>
              <input className="edsync-input" value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} placeholder="Category" />
              <input className="edsync-input" value={product.difficulty} onChange={(event) => setProduct({ ...product, difficulty: event.target.value })} placeholder="Difficulty" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="edsync-input" value={product.thumbnailUrl} onChange={(event) => setProduct({ ...product, thumbnailUrl: event.target.value })} placeholder="HTTPS thumbnail URL or R2 public URL" />
              <input className="edsync-input" value={product.previewVideoUrl} onChange={(event) => setProduct({ ...product, previewVideoUrl: event.target.value })} placeholder="YouTube, Vimeo, or direct HTTPS video" />
            </div>
            <label className="flex items-center gap-2 text-sm text-edsync-subtle">
              <input type="checkbox" checked={product.featured} onChange={(event) => setProduct({ ...product, featured: event.target.checked })} />
              Feature this product in portal highlights
            </label>
            <button className="btn-primary w-fit" type="submit" disabled={busy}>Create product</button>
          </form>
        </section>

        <section className="edsync-card p-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="font-display text-xl font-bold">Add price</span>
              <span className="block text-sm text-edsync-subtle">Attach a free, paid, recurring, or invoice price.</span>
            </span>
            <CreditCard className="h-5 w-5 text-edsync-subtle" />
          </div>
          <form onSubmit={createPrice} className="grid gap-3 border-t border-edsync-border p-4">
            <select className="edsync-input" value={price.productId} onChange={(event) => setPrice({ ...price, productId: event.target.value })} required>
              <option value="">Select product</option>
              {(payload?.products ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input className="edsync-input" type="number" min="0" value={price.amountCents} onChange={(event) => setPrice({ ...price, amountCents: Number(event.target.value) })} />
              <input className="edsync-input" value={price.currency} onChange={(event) => setPrice({ ...price, currency: event.target.value })} placeholder="usd" />
              <select className="edsync-input" value={price.billingInterval} onChange={(event) => setPrice({ ...price, billingInterval: event.target.value as PriceDraft["billingInterval"] })}>
                <option value="one_time">One time</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>
            <button className="btn-primary w-fit" type="submit" disabled={busy}>Create price</button>
          </form>
        </section>
      </div>

      <div className="edsync-card overflow-visible p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Products</h2>
          <p className="text-sm text-edsync-subtle">Edit, toggle, archive, or delete catalog records from one compact list.</p>
        </div>
        <div className="divide-y divide-edsync-border">
          {(payload?.products ?? []).map((item) => {
            const metadata = metadataOf(item);
            const productPrices = pricesByProduct.get(item.id) ?? [];
            const portalId = linksByProduct.get(item.id) || "";
            const portal = portalById.get(portalId);
            const editing = editingProductId === item.id;
            return (
              <section key={item.id} className="grid gap-3 px-4 py-4 text-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px] lg:items-start">
                  <div className="min-w-0">
                    {editing ? (
                      <div className="grid gap-3">
                        <input className="edsync-input" value={productDraft.title} onChange={(event) => setProductDraft({ ...productDraft, title: event.target.value })} />
                        <textarea className="edsync-input min-h-20" value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-edsync-text">{item.title}</span>
                          <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.status}</span>
                          <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{metadata.enrollmentMode ?? "closed"}</span>
                          {metadata.featured && <span className="badge bg-amber-100 text-amber-700"><Star className="h-3 w-3" /> Featured</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-edsync-subtle">{item.description || "No public summary yet."}</p>
                      </>
                    )}
                  </div>

                  <div className="grid gap-1 text-edsync-subtle">
                    {editing ? (
                      <>
                        <select className="edsync-input" value={productDraft.productType} onChange={(event) => setProductDraft({ ...productDraft, productType: event.target.value as ProductDraft["productType"] })}>
                          <option value="course">Course</option>
                          <option value="bundle">Bundle</option>
                          <option value="membership">Membership</option>
                          <option value="subscription">Subscription</option>
                        </select>
                        <select className="edsync-input" value={productDraft.status} onChange={(event) => setProductDraft({ ...productDraft, status: event.target.value as ProductDraft["status"] })}>
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <p className="capitalize">{item.product_type}</p>
                        <p>{portal?.name || "Default portal"}</p>
                        <p>{metadata.category || "Uncategorized"} / {metadata.difficulty || "All levels"}</p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {editing ? (
                      <>
                        <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => saveProduct(item)} disabled={busy}>
                          <Save className="h-4 w-4" /> Save
                        </button>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingProductId(null)}>
                          <X className="h-4 w-4" /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startProductEdit(item)}>
                          <Edit3 className="h-4 w-4" /> Edit
                        </button>
                        <ActionMenu label="More">
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => updateCatalog(item, { visibility: "public", enrollmentMode: productPrices.some((entry) => entry.amount_cents > 0) ? "paid" : "free" }, "active", portalId || null)}>
                            <Globe2 className="mr-2 inline h-4 w-4" /> Publish globally
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => updateCatalog(item, { visibility: "portal" }, "active", portalId || null)}>
                            <Eye className="mr-2 inline h-4 w-4" /> Portal only
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => updateCatalog(item, { visibility: "private", enrollmentMode: "closed" }, "draft", portalId || null)}>
                            <EyeOff className="mr-2 inline h-4 w-4" /> Hide
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => updateCatalog(item, { featured: !metadata.featured }, item.status, portalId || null)}>
                            <Star className="mr-2 inline h-4 w-4" /> {metadata.featured ? "Unfeature" : "Feature"}
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => deleteProduct(item)}>
                            <Trash2 className="mr-2 inline h-4 w-4" /> Delete
                          </button>
                        </ActionMenu>
                        <Link href={`/catalog/${item.id}`} className="btn-ghost px-3 py-2 text-sm">
                          <BookOpenCheck className="h-4 w-4" /> Preview
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {editing && (
                  <div className="grid gap-3 rounded-lg border border-edsync-border bg-edsync-card p-3 md:grid-cols-3">
                    <select className="edsync-input" value={productDraft.visibility} onChange={(event) => setProductDraft({ ...productDraft, visibility: event.target.value as ProductDraft["visibility"] })}>
                      <option value="private">Hidden draft</option>
                      <option value="public">Global catalog</option>
                      <option value="portal">Portal catalog</option>
                    </select>
                    <select className="edsync-input" value={productDraft.enrollmentMode} onChange={(event) => setProductDraft({ ...productDraft, enrollmentMode: event.target.value as ProductDraft["enrollmentMode"] })}>
                      <option value="closed">Closed</option>
                      <option value="free">Free enrollment</option>
                      <option value="paid">Paid checkout</option>
                    </select>
                    <select className="edsync-input" value={productDraft.portalId} onChange={(event) => setProductDraft({ ...productDraft, portalId: event.target.value })}>
                      <option value="">Default portal</option>
                      {(payload?.portals ?? []).map((portalOption) => <option key={portalOption.id} value={portalOption.id}>{portalOption.name}</option>)}
                    </select>
                    <input className="edsync-input" value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })} placeholder="Category" />
                    <input className="edsync-input" value={productDraft.language} onChange={(event) => setProductDraft({ ...productDraft, language: event.target.value })} placeholder="Language" />
                    <input className="edsync-input" value={productDraft.difficulty} onChange={(event) => setProductDraft({ ...productDraft, difficulty: event.target.value })} placeholder="Difficulty" />
                    <input className="edsync-input md:col-span-2" value={productDraft.thumbnailUrl} onChange={(event) => setProductDraft({ ...productDraft, thumbnailUrl: event.target.value })} placeholder="Thumbnail URL" />
                    <input className="edsync-input" value={productDraft.previewVideoUrl} onChange={(event) => setProductDraft({ ...productDraft, previewVideoUrl: event.target.value })} placeholder="Preview video URL" />
                    <label className="flex items-center gap-2 text-sm text-edsync-subtle">
                      <input type="checkbox" checked={productDraft.featured} onChange={(event) => setProductDraft({ ...productDraft, featured: event.target.checked })} />
                      Featured
                    </label>
                  </div>
                )}

                <div className="grid gap-2">
                  {productPrices.map((priceItem) => {
                    const editingPrice = editingPriceId === priceItem.id;
                    return (
                      <div key={priceItem.id} className="grid gap-2 rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2 md:grid-cols-[1fr_auto] md:items-center">
                        {editingPrice ? (
                          <div className="grid gap-2 md:grid-cols-4">
                            <input className="edsync-input" type="number" min="0" value={priceDraft.amountCents} onChange={(event) => setPriceDraft({ ...priceDraft, amountCents: Number(event.target.value) })} />
                            <input className="edsync-input" value={priceDraft.currency} onChange={(event) => setPriceDraft({ ...priceDraft, currency: event.target.value })} />
                            <select className="edsync-input" value={priceDraft.billingInterval} onChange={(event) => setPriceDraft({ ...priceDraft, billingInterval: event.target.value as PriceDraft["billingInterval"] })}>
                              <option value="one_time">One time</option>
                              <option value="month">Monthly</option>
                              <option value="year">Yearly</option>
                              <option value="invoice">Invoice</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-edsync-subtle">
                              <input type="checkbox" checked={priceDraft.active} onChange={(event) => setPriceDraft({ ...priceDraft, active: event.target.checked })} />
                              Active
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{money(priceItem.amount_cents, priceItem.currency)}</span>
                            <span className="capitalize text-edsync-subtle">{priceItem.billing_interval}</span>
                            <span className={`badge ${priceItem.active === false ? "bg-slate-100 text-slate-500" : "bg-edsync-emerald/10 text-edsync-emerald"}`}>
                              {priceItem.active === false ? "Inactive" : "Active"}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {editingPrice ? (
                            <>
                              <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => savePrice(priceItem)}><Check className="h-4 w-4" /> Save</button>
                              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingPriceId(null)}><X className="h-4 w-4" /> Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startPriceEdit(priceItem)}>Edit price</button>
                              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => togglePrice(priceItem)}>{priceItem.active === false ? "Activate" : "Deactivate"}</button>
                              <button type="button" className="btn-ghost px-3 py-2 text-sm text-rose-600" onClick={() => deletePrice(priceItem)}>Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {productPrices.length === 0 && <p className="rounded-lg border border-dashed border-edsync-border px-3 py-2 text-sm text-edsync-subtle">No prices yet. Add a free or paid price before publishing checkout products.</p>}
                </div>
              </section>
            );
          })}
        </div>
        {(payload?.products ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No catalog products yet.</p>
        )}
      </div>
    </div>
  );
}
