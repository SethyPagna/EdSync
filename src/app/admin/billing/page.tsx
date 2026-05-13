"use client";

import { useEffect, useState } from "react";

export default function AdminBillingPage() {
  const [payload, setPayload] = useState<any>(null);
  const [product, setProduct] = useState({ title: "", productType: "course" });
  const [price, setPrice] = useState({ productId: "", amountCents: 4900, billingInterval: "one_time" });
  const load = () => fetch("/api/billing").then((res) => res.json()).then((json) => setPayload(json.data));
  useEffect(() => {
    load();
  }, []);

  const createProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_product", ...product }) });
    setProduct({ title: "", productType: "course" });
    load();
  };

  const createPrice = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_price", ...price }) });
    setPrice({ productId: "", amountCents: 4900, billingInterval: "one_time" });
    load();
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Monetization</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Billing</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Provider-abstracted products, prices, invoices, transactions, and entitlements.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={createProduct} className="edsync-card space-y-3 p-4">
          <h2 className="font-display text-xl font-bold">Create product</h2>
          <input className="edsync-input" value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} placeholder="Product title" required />
          <select className="edsync-input" value={product.productType} onChange={(event) => setProduct({ ...product, productType: event.target.value })}>
            <option value="course">Course</option>
            <option value="bundle">Bundle</option>
            <option value="membership">Membership</option>
            <option value="subscription">Subscription</option>
          </select>
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
      <div className="edsync-card overflow-hidden">
        {(payload?.products ?? []).map((item: any) => (
          <div key={item.id} className="grid gap-2 border-b border-edsync-border px-4 py-3 text-sm md:grid-cols-[1fr_140px_120px]">
            <span className="font-semibold">{item.title}</span>
            <span className="capitalize text-edsync-subtle">{item.product_type}</span>
            <span className="badge bg-edsync-blue/10 text-edsync-blue">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
