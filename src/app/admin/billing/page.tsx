"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  Star,
  Trash2,
  Plus,
} from "lucide-react";
import { ActionMenu } from "@/components/WorkspacePrimitives";
import { Sheet, useConfirm } from "@/components/ui";
import { createClient } from "@/lib/edsync/client";
import { safeCatalogImageUrl, safeCatalogVideoUrl } from "@/lib/security/media";
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
  transactions: Array<{ id: string; product_id: string; price_id: string; provider: string; amount_cents: number; currency: string; status: string; metadata: { userId?: string } | null; created_at: string }>;
  portals: TenantPortal[];
  links: PortalLinkRecord[];
  context: { tenant: Tenant; portal: TenantPortal | null };
};

type BillingActionResult = {
  warnings?: string[];
  [key: string]: unknown;
};

type ProductDraft = {
  title: string;
  description: string;
  productType: BillingProduct["product_type"];
  courseId: string;
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
  courseId: "",
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
    courseId: item.course_id ?? "",
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

function mediaWarnings(draft: ProductDraft) {
  return [
    draft.thumbnailUrl && !safeCatalogImageUrl(draft.thumbnailUrl)
      ? "Thumbnail must be an HTTPS image URL ending in PNG, JPG, WEBP, or GIF."
      : null,
    draft.previewVideoUrl && !safeCatalogVideoUrl(draft.previewVideoUrl)
      ? "Preview must be a YouTube, Vimeo, MP4, WEBM, or MOV HTTPS URL."
      : null,
  ].filter(Boolean) as string[];
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
  const [createPanel, setCreatePanel] = useState<"product" | "price" | null>(null);
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "access">("products");
  const [lessons, setLessons] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const confirm = useConfirm();

  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
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
      .finally(() => { if (!quiet) setLoading(false); });
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void createClient().from("lessons").select("id,title,status").order("title").then(({ data }) => setLessons((data ?? []) as Array<{ id: string; title: string; status: string }>));
    }, 0);
    return () => window.clearTimeout(timer);
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
  const productMediaWarnings = mediaWarnings(product);
  const productDraftMediaWarnings = mediaWarnings(productDraft);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { data?: BillingActionResult | null; error?: string | null };
      if (!response.ok || json.error) throw new Error(json.error || "Request failed.");
      const warnings = Array.isArray(json.data?.warnings) ? json.data.warnings : [];
      setMessage(warnings.length > 0 ? `${success} ${warnings.join(" ")}` : success);
      await load(true);
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
        courseId: product.courseId || null,
        portalId: product.portalId || null,
        metadata: metadataFrom(product),
      },
      "Product created.",
    );
    if (ok) { setProduct(emptyProduct); setCreatePanel(null); }
  };

  const createPrice = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run({ action: "create_price", ...price }, "Price created.");
    if (ok) { setPrice({ ...emptyPrice, amountCents: 4900 }); setCreatePanel(null); }
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
        courseId: productDraft.courseId || null,
        status: productDraft.status,
        portalId: productDraft.portalId || null,
        metadata: metadataFrom(productDraft),
      },
      "Product saved.",
    );
    if (ok) setEditingProductId(null);
  };

  const deleteProduct = async (item: ProductRecord) => {
    if (!await confirm({ title: `Remove ${item.title}?`, body: "Products with access history will be archived.", confirmLabel: "Remove product", danger: true })) return;
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
    if (!await confirm({ title: "Remove this price?", body: "Prices with transaction history will be deactivated.", confirmLabel: "Remove price", danger: true })) return;
    const result = await run({ action: "delete_price", priceId: item.id }, "Price removed.");
    if (result && typeof result === "object" && "mode" in result && result.mode === "deactivated") {
      setMessage("Price deactivated because transactions or subscriptions already reference it.");
    }
  };

  const markPaid = async (transaction: BillingPayload["transactions"][number]) => {
    if (!await confirm({ title: "Mark this order paid?", body: "This grants the learner access immediately. Confirm the payment outside EdSync first.", confirmLabel: "Mark paid" })) return;
    await run({ action: "mark_paid", transactionId: transaction.id }, "Order marked paid and access granted.");
  };

  const selectedProduct = payload?.products.find((item) => item.id === editingProductId);
  const selectedPrice = payload?.prices.find((item) => item.id === editingPriceId);
  const selectedProductDraft = selectedProduct ? productDraft : product;
  const selectedPriceDraft = selectedPrice ? priceDraft : price;
  return (
    <div className="page-shell space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-edsync-blue">Monetization</p>
          <h1 className="font-display text-2xl font-bold">Catalog & billing</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => { setPrice({ ...emptyPrice, productId: payload?.products[0]?.id ?? "" }); setCreatePanel("price"); }} disabled={!payload?.products.length}><CreditCard className="h-4 w-4" /> Add price</button>
          <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => { setProduct(emptyProduct); setCreatePanel("product"); }}><Plus className="h-4 w-4" /> New product</button>
        </div>
      </header>
      {message && <div role="status" className="rounded-xl border border-edsync-border bg-edsync-surface px-3 py-2 text-sm">{message}</div>}
      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edsync-red/30 bg-edsync-red/10 px-3 py-2 text-sm text-edsync-red"><span>{loadError}</span><button type="button" className="underline" onClick={() => void load()}>Retry</button></div>}
      {loading && <div className="h-32 animate-pulse rounded-xl bg-edsync-muted" aria-label="Loading billing" />}
      {payload && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Products</p><p className="text-xl font-bold">{payload.products.length}</p></div>
            <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Pending orders</p><p className="text-xl font-bold">{payload.transactions.filter((item) => item.status === "pending").length}</p></div>
            <div className="premium-card rounded-xl p-3"><p className="text-xs text-edsync-subtle">Active access</p><p className="text-xl font-bold">{payload.entitlements.filter((item) => item.status === "active").length}</p></div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-edsync-border" role="tablist" aria-label="Billing sections">
            {(["products", "orders", "access"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "border-b-2 border-edsync-blue px-4 py-2 text-sm font-semibold text-edsync-blue" : "px-4 py-2 text-sm text-edsync-subtle"} onClick={() => setActiveTab(tab)}>{tab === "access" ? "Entitlements" : tab[0].toUpperCase() + tab.slice(1)}</button>)}
          </div>
          {activeTab === "products" && (
            <section className="premium-surface divide-y divide-edsync-border overflow-visible rounded-xl">
              {payload.products.map((item) => {
                const metadata = metadataOf(item);
                const itemPrices = pricesByProduct.get(item.id) ?? [];
                const portalId = linksByProduct.get(item.id) || "";
                return <article key={item.id} className="flex flex-col gap-3 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="rounded-lg bg-edsync-blue/10 p-2 text-edsync-blue"><BookOpenCheck className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 truncate font-semibold">{item.title}</h2><span className="badge bg-edsync-blue/10 text-edsync-blue">{item.status}</span>{metadata.featured && <Star className="h-4 w-4 text-edsync-amber" />}</div>
                      <p className="mt-1 truncate text-xs text-edsync-subtle">{item.product_type} · {metadata.visibility ?? "private"} · {portalById.get(portalId)?.name || "Default portal"}{item.course_id ? " · Linked course" : ""}</p>
                    </div>
                    <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startProductEdit(item)}><Edit3 className="h-4 w-4" /> Edit</button>
                    <ActionMenu label={"Actions for " + item.title}>
                      <button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => void updateCatalog(item, { visibility: "public", enrollmentMode: itemPrices.some((entry) => entry.amount_cents > 0) ? "paid" : "free" }, "active", portalId || null)}><Globe2 className="mr-2 inline h-4 w-4" /> Publish globally</button>
                      <button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => void updateCatalog(item, { visibility: "portal" }, "active", portalId || null)}><Eye className="mr-2 inline h-4 w-4" /> Portal only</button>
                      <button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => void updateCatalog(item, { visibility: "private", enrollmentMode: "closed" }, "draft", portalId || null)}><EyeOff className="mr-2 inline h-4 w-4" /> Hide</button>
                      <button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-edsync-muted" onClick={() => void updateCatalog(item, { featured: !metadata.featured }, item.status, portalId || null)}><Star className="mr-2 inline h-4 w-4" /> {metadata.featured ? "Unfeature" : "Feature"}</button>
                      <button type="button" className="rounded-lg px-3 py-2 text-left text-sm text-edsync-red hover:bg-edsync-red/10" onClick={() => void deleteProduct(item)}><Trash2 className="mr-2 inline h-4 w-4" /> Remove</button>
                    </ActionMenu>
                    <Link href={"/catalog/" + item.id} className="btn-ghost px-3 py-2 text-sm">Preview</Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-11">
                    {itemPrices.map((itemPrice) => <span key={itemPrice.id} className="inline-flex items-center gap-2 rounded-full border border-edsync-border px-2.5 py-1 text-xs"><strong>{money(itemPrice.amount_cents, itemPrice.currency)}</strong><span className="text-edsync-subtle">{itemPrice.billing_interval}</span>{itemPrice.active === false && <span className="text-edsync-amber">Inactive</span>}<button type="button" className="text-edsync-blue" aria-label={"Edit price " + itemPrice.id} onClick={() => startPriceEdit(itemPrice)}><Edit3 className="h-3.5 w-3.5" /></button><button type="button" className="text-edsync-red" aria-label={"Delete price " + itemPrice.id} onClick={() => void deletePrice(itemPrice)}><Trash2 className="h-3.5 w-3.5" /></button></span>)}
                    {itemPrices.length === 0 && <span className="text-xs text-edsync-subtle">No price yet</span>}
                    <button type="button" className="text-xs font-semibold text-edsync-blue" onClick={() => { setPrice({ ...emptyPrice, productId: item.id }); setCreatePanel("price"); }}>+ Price</button>
                  </div>
                </article>;
              })}
              {payload.products.length === 0 && <p className="p-6 text-sm text-edsync-subtle">No products yet. Create one to start your catalog.</p>}
            </section>
          )}
          {activeTab === "orders" && <section className="premium-surface overflow-x-auto rounded-xl">
            <table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-edsync-border text-xs text-edsync-subtle"><tr><th scope="col" className="p-3 font-medium">Product / order</th><th scope="col" className="p-3 font-medium">Amount</th><th scope="col" className="p-3 font-medium">Status</th><th scope="col" className="p-3 font-medium">Action</th></tr></thead><tbody className="divide-y divide-edsync-border">
              {payload.transactions.map((transaction) => <tr key={transaction.id}><td className="p-3"><span className="block font-semibold">{payload.products.find((item) => item.id === transaction.product_id)?.title || "Product"}</span><span className="text-xs text-edsync-subtle">{transaction.id} · {new Date(transaction.created_at).toLocaleDateString()}</span></td><td className="p-3 font-semibold">{money(transaction.amount_cents, transaction.currency)}</td><td className="p-3"><span className={transaction.status === "paid" ? "badge bg-edsync-emerald/10 text-edsync-emerald" : "badge bg-edsync-amber/10 text-edsync-amber"}>{transaction.status}</span></td><td className="p-3">{transaction.provider === "manual" && transaction.status === "pending" && <button type="button" className="btn-secondary px-3 py-2 text-xs" disabled={busy} onClick={() => void markPaid(transaction)}>Mark paid</button>}</td></tr>)}
            </tbody></table>{payload.transactions.length === 0 && <p className="p-6 text-sm text-edsync-subtle">No orders yet.</p>}
          </section>}
          {activeTab === "access" && <section className="premium-surface overflow-x-auto rounded-xl">
            <table className="w-full min-w-[480px] text-left text-sm"><thead className="border-b border-edsync-border text-xs text-edsync-subtle"><tr><th scope="col" className="p-3 font-medium">Product</th><th scope="col" className="p-3 font-medium">Learner</th><th scope="col" className="p-3 font-medium">Access</th></tr></thead><tbody className="divide-y divide-edsync-border">
              {payload.entitlements.map((entitlement) => <tr key={entitlement.id}><td className="p-3 font-semibold">{payload.products.find((item) => item.id === entitlement.product_id)?.title || "Product access"}</td><td className="p-3 text-xs text-edsync-subtle">{entitlement.user_id}</td><td className="p-3"><span className={entitlement.status === "active" ? "badge bg-edsync-emerald/10 text-edsync-emerald" : "badge bg-edsync-muted text-edsync-subtle"}>{entitlement.status}</span></td></tr>)}
            </tbody></table>{payload.entitlements.length === 0 && <p className="p-6 text-sm text-edsync-subtle">No entitlements yet.</p>}
          </section>}
        </>
      )}
      <Sheet open={createPanel === "product" || Boolean(selectedProduct)} onClose={() => { setCreatePanel(null); setEditingProductId(null); }} title={selectedProduct ? "Edit product" : "New product"} description="Choose the course, audience, and catalog visibility." size="lg">
        <form className="space-y-4" onSubmit={selectedProduct ? (event) => { event.preventDefault(); void saveProduct(selectedProduct); } : createProduct}>
          <ProductFields value={selectedProductDraft} onChange={selectedProduct ? setProductDraft : setProduct} portals={payload?.portals ?? []} lessons={lessons} warnings={selectedProduct ? productDraftMediaWarnings : productMediaWarnings} isNew={!selectedProduct} />
          <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>{busy ? "Saving…" : selectedProduct ? "Save product" : "Create product"}</button>
        </form>
      </Sheet>
      <Sheet open={createPanel === "price" || Boolean(selectedPrice)} onClose={() => { setCreatePanel(null); setEditingPriceId(null); }} title={selectedPrice ? "Edit price" : "Add price"} description="Manual checkout is available without a payment provider.">
        <form className="space-y-4" onSubmit={selectedPrice ? (event) => { event.preventDefault(); void savePrice(selectedPrice); } : createPrice}>
          <label className="grid gap-1 text-sm font-medium">Product<select className="edsync-input" value={selectedPriceDraft.productId} onChange={(event) => (selectedPrice ? setPriceDraft : setPrice)({ ...selectedPriceDraft, productId: event.target.value })} required disabled={Boolean(selectedPrice)}><option value="">Select product</option>{(payload?.products ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Amount (cents)<input className="edsync-input" type="number" min="0" value={selectedPriceDraft.amountCents} onChange={(event) => (selectedPrice ? setPriceDraft : setPrice)({ ...selectedPriceDraft, amountCents: Number(event.target.value) })} required /></label>
          <label className="grid gap-1 text-sm font-medium">Currency<input className="edsync-input" value={selectedPriceDraft.currency} onChange={(event) => (selectedPrice ? setPriceDraft : setPrice)({ ...selectedPriceDraft, currency: event.target.value })} required /></label>
          <label className="grid gap-1 text-sm font-medium">Billing<select className="edsync-input" value={selectedPriceDraft.billingInterval} onChange={(event) => (selectedPrice ? setPriceDraft : setPrice)({ ...selectedPriceDraft, billingInterval: event.target.value as PriceDraft["billingInterval"] })}><option value="one_time">One time</option><option value="month">Monthly</option><option value="year">Yearly</option><option value="invoice">Invoice</option></select></label>
          {selectedPrice && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedPriceDraft.active} onChange={(event) => setPriceDraft({ ...selectedPriceDraft, active: event.target.checked })} /> Active</label>}
          <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>{busy ? "Saving…" : selectedPrice ? "Save price" : "Create price"}</button>
          {selectedPrice && <button type="button" className="btn-secondary w-full justify-center" disabled={busy} onClick={() => void togglePrice(selectedPrice)}>{selectedPrice.active ? "Deactivate" : "Activate"}</button>}
        </form>
      </Sheet>
    </div>
  );
}

function ProductFields({ value, onChange, portals, lessons, warnings, isNew }: { value: ProductDraft; onChange: (value: ProductDraft) => void; portals: TenantPortal[]; lessons: Array<{ id: string; title: string; status: string }>; warnings: string[]; isNew: boolean }) {
  return <div className="grid gap-3">
    <label className="grid gap-1 text-sm font-medium">Title<input className="edsync-input" value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} required /></label>
    <label className="grid gap-1 text-sm font-medium">Summary<textarea className="edsync-input min-h-20" value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">Product type<select className="edsync-input" value={value.productType} onChange={(event) => onChange({ ...value, productType: event.target.value as ProductDraft["productType"] })}><option value="course">Course</option><option value="bundle">Bundle</option><option value="membership">Membership</option><option value="subscription">Subscription</option></select></label>
      {isNew ? <p className="self-end rounded-xl bg-edsync-muted px-3 py-2 text-xs text-edsync-subtle">Created as a draft</p> : <label className="grid gap-1 text-sm font-medium">Status<select className="edsync-input" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as ProductDraft["status"] })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>}
      <label className="grid gap-1 text-sm font-medium">Linked course{lessons.length > 0 ? <select className="edsync-input" value={value.courseId} onChange={(event) => onChange({ ...value, courseId: event.target.value })}><option value="">No course</option>{value.courseId && !lessons.some((lesson) => lesson.id === value.courseId) && <option value={value.courseId}>Current linked course</option>}{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title} · {lesson.status}</option>)}</select> : <input className="edsync-input" value={value.courseId} onChange={(event) => onChange({ ...value, courseId: event.target.value })} placeholder="Optional course ID" />}</label>
      <label className="grid gap-1 text-sm font-medium">Visibility<select className="edsync-input" value={value.visibility} onChange={(event) => onChange({ ...value, visibility: event.target.value as ProductDraft["visibility"] })}><option value="private">Private</option><option value="public">Public catalog</option><option value="portal">Portal catalog</option></select></label>
      <label className="grid gap-1 text-sm font-medium">Enrollment<select className="edsync-input" value={value.enrollmentMode} onChange={(event) => onChange({ ...value, enrollmentMode: event.target.value as ProductDraft["enrollmentMode"] })}><option value="closed">Closed</option><option value="free">Free</option><option value="paid">Paid</option></select></label>
      <label className="grid gap-1 text-sm font-medium">Portal<select className="edsync-input" value={value.portalId} onChange={(event) => onChange({ ...value, portalId: event.target.value })}><option value="">Default portal</option>{portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}</select></label>
    </div>
    <details className="rounded-xl border border-edsync-border p-3"><summary className="cursor-pointer text-sm font-semibold">Appearance & details</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Category<input className="edsync-input" value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Language<input className="edsync-input" value={value.language} onChange={(event) => onChange({ ...value, language: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Difficulty<input className="edsync-input" value={value.difficulty} onChange={(event) => onChange({ ...value, difficulty: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Thumbnail URL<input className="edsync-input" value={value.thumbnailUrl} onChange={(event) => onChange({ ...value, thumbnailUrl: event.target.value })} /></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Preview video URL<input className="edsync-input" value={value.previewVideoUrl} onChange={(event) => onChange({ ...value, previewVideoUrl: event.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.featured} onChange={(event) => onChange({ ...value, featured: event.target.checked })} /> Feature product</label>
    </div></details>
    {warnings.length > 0 && <div role="alert" className="rounded-xl border border-edsync-amber/30 bg-edsync-amber/10 p-3 text-sm text-edsync-amber">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
  </div>;
}
