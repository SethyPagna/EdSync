"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Globe2 } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

export default function AdminBillingPage() {
  const [payload, setPayload] = useState<any>(null);
  const [product, setProduct] = useState({
    title: "",
    description: "",
    productType: "course",
    portalId: "",
    visibility: "private",
    enrollmentMode: "closed",
    category: "",
    thumbnailUrl: "",
    previewVideoUrl: "",
  });
  const [price, setPrice] = useState({ productId: "", amountCents: 0, billingInterval: "one_time" });
  const load = () => fetch("/api/billing").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_product",
        title: product.title,
        description: product.description,
        productType: product.productType,
        portalId: product.portalId || null,
        metadata: {
          visibility: product.visibility,
          enrollmentMode: product.enrollmentMode,
          category: product.category,
          thumbnailUrl: product.thumbnailUrl,
          previewVideoUrl: product.previewVideoUrl,
        },
      }),
    });
    setProduct({ title: "", description: "", productType: "course", portalId: "", visibility: "private", enrollmentMode: "closed", category: "", thumbnailUrl: "", previewVideoUrl: "" });
    load();
  };

  const createPrice = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_price", ...price }) });
    setPrice({ productId: "", amountCents: 4900, billingInterval: "one_time" });
    load();
  };

  const updateCatalog = async (item: any, metadata: Record<string, unknown>, status = item.status) => {
    await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_catalog",
        productId: item.id,
        status,
        metadata: { ...(item.metadata ?? {}), ...metadata },
      }),
    });
    load();
  };

  const pricesByProduct = new Map<string, any>((payload?.prices ?? []).map((item: any) => [item.product_id, item]));
  const portalById = new Map<string, any>((payload?.portals ?? []).map((item: any) => [item.id, item]));
  const linksByProduct = new Map<string, string>((payload?.links ?? []).map((item: any) => [item.object_id, item.portal_id]));

  return (
    <div className="page-shell space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Monetization</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Catalog & Billing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Create products, attach prices, and decide whether each course appears in the public EdSync catalog or a scoped organization portal.
          </p>
        </div>
        <GuidePanel
          title="Publishing model"
          description="Draft products stay hidden. Public products appear in the global catalog. Portal products appear through the organization portal when that portal is public."
          icon={Globe2}
          items={["Free products grant entitlement after login.", "Paid products start checkout through the configured provider.", "Unsafe media URLs are ignored by the public catalog."]}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={createProduct} className="edsync-card space-y-3 p-4">
          <h2 className="font-display text-xl font-bold">Create product</h2>
          <input className="edsync-input" value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} placeholder="Product title" required />
          <textarea className="edsync-input min-h-24" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} placeholder="Public summary" />
          <select className="edsync-input" value={product.productType} onChange={(event) => setProduct({ ...product, productType: event.target.value })}>
            <option value="course">Course</option>
            <option value="bundle">Bundle</option>
            <option value="membership">Membership</option>
            <option value="subscription">Subscription</option>
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="edsync-input" value={product.visibility} onChange={(event) => setProduct({ ...product, visibility: event.target.value })}>
              <option value="private">Hidden draft</option>
              <option value="public">Global catalog</option>
              <option value="portal">Portal catalog</option>
            </select>
            <select className="edsync-input" value={product.enrollmentMode} onChange={(event) => setProduct({ ...product, enrollmentMode: event.target.value })}>
              <option value="closed">Closed</option>
              <option value="free">Free enrollment</option>
              <option value="paid">Paid checkout</option>
            </select>
          </div>
          <select className="edsync-input" value={product.portalId} onChange={(event) => setProduct({ ...product, portalId: event.target.value })}>
            <option value="">Default portal</option>
            {(payload?.portals ?? []).map((portal: any) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}
          </select>
          <input className="edsync-input" value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} placeholder="Category, e.g. Science" />
          <input className="edsync-input" value={product.thumbnailUrl} onChange={(event) => setProduct({ ...product, thumbnailUrl: event.target.value })} placeholder="HTTPS thumbnail URL or R2 public URL" />
          <input className="edsync-input" value={product.previewVideoUrl} onChange={(event) => setProduct({ ...product, previewVideoUrl: event.target.value })} placeholder="YouTube, Vimeo, or direct HTTPS video" />
          <button className="btn-primary" type="submit">Create product</button>
        </form>
        <form onSubmit={createPrice} className="edsync-card space-y-3 p-4">
          <h2 className="font-display text-xl font-bold">Create price</h2>
          <select className="edsync-input" value={price.productId} onChange={(event) => setPrice({ ...price, productId: event.target.value })} required>
            <option value="">Select product</option>
            {(payload?.products ?? []).map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <input className="edsync-input" type="number" value={price.amountCents} onChange={(event) => setPrice({ ...price, amountCents: Number(event.target.value) })} />
          <select className="edsync-input" value={price.billingInterval} onChange={(event) => setPrice({ ...price, billingInterval: event.target.value })}>
            <option value="one_time">One time</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="invoice">Invoice</option>
          </select>
          <button className="btn-primary" type="submit">Create price</button>
        </form>
      </div>
      <div className="edsync-card overflow-hidden p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Products</h2>
          <p className="text-sm text-edsync-subtle">Publish only course previews that are ready for public visitors.</p>
        </div>
        {(payload?.products ?? []).map((item: any) => (
          <div key={item.id} className="grid gap-3 border-b border-edsync-border px-4 py-4 text-sm lg:grid-cols-[minmax(0,1fr)_220px_240px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{item.title}</span>
                <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.status}</span>
                <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{pricesByProduct.get(item.id)?.amount_cents === 0 ? "Free" : "Priced"}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-edsync-subtle">{item.description || "No public summary yet."}</p>
            </div>
            <div className="text-edsync-subtle">
              <p className="capitalize">{item.product_type}</p>
              <p>{portalById.get(linksByProduct.get(item.id) || "")?.name || "Default portal"}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => updateCatalog(item, { visibility: "public", enrollmentMode: pricesByProduct.get(item.id)?.amount_cents > 0 ? "paid" : "free" }, "active")}>
                <Globe2 className="h-4 w-4" /> Publish
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => updateCatalog(item, { visibility: "private", enrollmentMode: "closed" }, "draft")}>
                Hide
              </button>
              <Link href={`/catalog/${item.id}`} className="btn-ghost px-3 py-2 text-sm">
                <BookOpenCheck className="h-4 w-4" /> Preview
              </Link>
            </div>
          </div>
        ))}
        {(payload?.products ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No catalog products yet.</p>
        )}
      </div>
    </div>
  );
}
