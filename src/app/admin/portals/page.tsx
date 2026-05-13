"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Check, Edit3, Globe2, Home, MoreHorizontal, Save, Trash2, X } from "lucide-react";
import { ActionMenu, GuidePanel } from "@/components/WorkspacePrimitives";

type PortalDraft = {
  name: string;
  slug: string;
  audience: string;
  domain: string;
  catalogEnabled: boolean;
  featuredOnly: boolean;
};

const emptyPortal: PortalDraft = {
  name: "",
  slug: "",
  audience: "internal",
  domain: "",
  catalogEnabled: true,
  featuredOnly: false,
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function settingsOf(portal: any) {
  return typeof portal?.catalog_settings === "object" && portal.catalog_settings ? portal.catalog_settings : {};
}

function draftFrom(portal: any): PortalDraft {
  const settings = settingsOf(portal);
  return {
    name: portal.name ?? "",
    slug: portal.slug ?? "",
    audience: portal.audience ?? "internal",
    domain: portal.domain ?? "",
    catalogEnabled: settings.enabled !== false,
    featuredOnly: Boolean(settings.featuredOnly),
  };
}

export default function AdminPortalsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [form, setForm] = useState<PortalDraft>(emptyPortal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PortalDraft>(emptyPortal);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/portals")
      .then((res) => res.json())
      .then((json) => setPayload(json.data));

  useEffect(() => {
    load();
  }, []);

  const domainsByPortal = useMemo(() => {
    const grouped = new Map<string, any[]>();
    for (const domain of payload?.domains ?? []) {
      const list = grouped.get(domain.portal_id) ?? [];
      list.push(domain);
      grouped.set(domain.portal_id, list);
    }
    return grouped;
  }, [payload]);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error || "Request failed.");
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createPortal = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run({ action: "create", ...form, slug: form.slug || slugify(form.name), domain: form.domain || null }, "Portal created.");
    if (ok) setForm(emptyPortal);
  };

  const startEdit = (portal: any) => {
    setEditingId(portal.id);
    setDraft(draftFrom(portal));
  };

  const savePortal = async (portal: any) => {
    const ok = await run(
      {
        action: "update",
        id: portal.id,
        ...draft,
        slug: draft.slug || slugify(draft.name),
        domain: draft.domain || null,
      },
      "Portal saved.",
    );
    if (ok) setEditingId(null);
  };

  const togglePublic = async (portal: any) => {
    await run({ action: "toggle_public", id: portal.id }, portal.audience === "public" ? "Portal moved to internal." : "Portal is now public.");
  };

  const makeDefault = async (portal: any) => {
    await run({ action: "make_default", id: portal.id }, "Default portal updated.");
  };

  const deletePortal = async (portal: any) => {
    if (portal.is_default) {
      setMessage("Default portal cannot be deleted. Make another portal default first.");
      return;
    }
    if (!window.confirm(`Delete "${portal.name}"? Catalog links will be detached from this portal.`)) return;
    await run({ action: "delete", id: portal.id }, "Portal deleted.");
  };

  return (
    <div className="page-shell space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Tenant command</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Organizations & Portals</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Portals work like branded academies: one organization can run internal training, partner learning, customer education, or a public course catalog.
          </p>
        </div>
        <GuidePanel
          title="Scoped organization control"
          description="Platform admin controls the whole app. Organization owners and managers should only control their own portal branding, catalog visibility, users, and roles."
          icon={Building2}
          items={["Public portals are discoverable at /org/[slug].", "Internal portals stay private for enrolled users.", "Custom domains start pending until DNS is verified."]}
        />
      </div>

      {message && (
        <div className="rounded-lg border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">
          {message}
        </div>
      )}

      <details className="edsync-card p-0" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
          <span>
            <span className="font-display text-xl font-bold">Add organization portal</span>
            <span className="block text-sm text-edsync-subtle">Create a branded public, internal, customer, or partner space.</span>
          </span>
          <MoreHorizontal className="h-5 w-5 text-edsync-subtle" />
        </summary>
        <form onSubmit={createPortal} className="grid gap-3 border-t border-edsync-border p-4 lg:grid-cols-6">
          <input className="edsync-input lg:col-span-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: form.slug || slugify(event.target.value) })} placeholder="Portal name" required />
          <input className="edsync-input" value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} placeholder="slug" />
          <select className="edsync-input" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
            <option value="internal">Internal</option>
            <option value="customer">Customer</option>
            <option value="partner">Partner</option>
            <option value="public">Public</option>
          </select>
          <input className="edsync-input lg:col-span-2" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="portal.example.com" />
          <label className="flex items-center gap-2 text-sm text-edsync-subtle lg:col-span-2">
            <input type="checkbox" checked={form.catalogEnabled} onChange={(event) => setForm({ ...form, catalogEnabled: event.target.checked })} />
            Catalog enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-edsync-subtle lg:col-span-2">
            <input type="checkbox" checked={form.featuredOnly} onChange={(event) => setForm({ ...form, featuredOnly: event.target.checked })} />
            Show featured products first
          </label>
          <button className="btn-primary w-fit lg:col-span-2" type="submit" disabled={busy}>Create portal</button>
        </form>
      </details>

      <div className="edsync-card overflow-visible p-0">
        <div className="border-b border-edsync-border px-4 py-3">
          <h2 className="font-display text-xl font-bold">Portal directory</h2>
          <p className="text-sm text-edsync-subtle">Edit, toggle, delete, and open public organization portals from one place.</p>
        </div>
        <div className="divide-y divide-edsync-border">
          {(payload?.portals ?? []).map((portal: any) => {
            const editing = editingId === portal.id;
            const settings = settingsOf(portal);
            const domains = domainsByPortal.get(portal.id) ?? [];
            return (
              <section key={portal.id} className="grid gap-3 px-4 py-4 text-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-start">
                  <div className="min-w-0">
                    {editing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <input className="edsync-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                        <input className="edsync-input" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} />
                        <input className="edsync-input md:col-span-2" value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value })} placeholder="portal.example.com" />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-edsync-text">{portal.name}</span>
                          <span className="badge bg-edsync-blue/10 text-edsync-blue">{portal.is_default ? "Default" : "Portal"}</span>
                          <span className="badge bg-edsync-emerald/10 text-edsync-emerald">{portal.audience}</span>
                          {settings.enabled === false && <span className="badge bg-slate-100 text-slate-500">Catalog off</span>}
                        </div>
                        <p className="mt-1 text-edsync-subtle">/{portal.slug} · {portal.domain || "No custom domain"}</p>
                      </>
                    )}
                  </div>

                  <div className="grid gap-1 text-edsync-subtle">
                    {editing ? (
                      <>
                        <select className="edsync-input" value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })}>
                          <option value="internal">Internal</option>
                          <option value="customer">Customer</option>
                          <option value="partner">Partner</option>
                          <option value="public">Public</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={draft.catalogEnabled} onChange={(event) => setDraft({ ...draft, catalogEnabled: event.target.checked })} />
                          Catalog enabled
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={draft.featuredOnly} onChange={(event) => setDraft({ ...draft, featuredOnly: event.target.checked })} />
                          Featured first
                        </label>
                      </>
                    ) : (
                      <>
                        <p className="capitalize">{portal.audience} audience</p>
                        <p>{settings.featuredOnly ? "Featured products prioritized" : "All visible products shown"}</p>
                        <p>{settings.enabled === false ? "Catalog disabled" : "Catalog enabled"}</p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {editing ? (
                      <>
                        <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => savePortal(portal)} disabled={busy}>
                          <Save className="h-4 w-4" /> Save
                        </button>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startEdit(portal)}>
                          <Edit3 className="h-4 w-4" /> Edit
                        </button>
                        <ActionMenu label="More">
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted/30" onClick={() => togglePublic(portal)}>
                            <Globe2 className="mr-2 inline h-4 w-4" /> {portal.audience === "public" ? "Make internal" : "Make public"}
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-edsync-muted/30" onClick={() => makeDefault(portal)}>
                            <Home className="mr-2 inline h-4 w-4" /> Set as default
                          </button>
                          <button type="button" className="rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => deletePortal(portal)}>
                            <Trash2 className="mr-2 inline h-4 w-4" /> Delete
                          </button>
                        </ActionMenu>
                        {portal.audience === "public" && (
                          <Link href={`/org/${portal.slug}`} className="btn-ghost px-3 py-2 text-sm">
                            <Globe2 className="h-4 w-4" /> Open
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {domains.map((domain) => (
                    <div key={domain.id} className="flex items-center justify-between gap-3 rounded-lg border border-edsync-border bg-edsync-surface px-3 py-2">
                      <span className="truncate">{domain.hostname}</span>
                      <span className={`badge ${domain.status === "active" ? "bg-edsync-emerald/10 text-edsync-emerald" : "bg-amber-100 text-amber-700"}`}>
                        {domain.status === "active" && <Check className="h-3 w-3" />}
                        {domain.status}
                      </span>
                    </div>
                  ))}
                  {domains.length === 0 && <p className="rounded-lg border border-dashed border-edsync-border px-3 py-2 text-edsync-subtle">No custom domain is attached.</p>}
                </div>
              </section>
            );
          })}
        </div>
        {(payload?.portals ?? []).length === 0 && (
          <p className="px-4 py-5 text-sm text-edsync-subtle">No portals yet.</p>
        )}
      </div>
    </div>
  );
}
