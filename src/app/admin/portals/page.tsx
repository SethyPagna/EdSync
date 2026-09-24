"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Copy,
  Edit3,
  Globe2,
  Home,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ActionMenu } from "@/components/WorkspacePrimitives";
import type { Tenant, TenantPortal } from "@/types";

type PortalCatalogSettings = {
  enabled?: boolean;
  featuredOnly?: boolean;
};

type PortalRecord = TenantPortal & {
  catalog_settings: PortalCatalogSettings;
  address: {
    path: string;
    subdomain: string | null;
    hostname: string | null;
    ready: boolean;
  };
};

type DomainRecord = {
  id: string;
  portal_id: string;
  hostname: string;
  verification_token: string;
  status: "pending" | "active" | "failed";
};

type PortalsPayload = {
  baseDomain: string | null;
  portals: PortalRecord[];
  domains: DomainRecord[];
  context: { tenant: Tenant; portal: TenantPortal | null };
};

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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function settingsOf(portal: PortalRecord): PortalCatalogSettings {
  return typeof portal?.catalog_settings === "object" && portal.catalog_settings
    ? portal.catalog_settings
    : {};
}

function draftFrom(portal: PortalRecord): PortalDraft {
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
  const [payload, setPayload] = useState<PortalsPayload | null>(null);
  const [form, setForm] = useState<PortalDraft>(emptyPortal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PortalDraft>(emptyPortal);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/portals", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.data)
        throw new Error(json.error || "Could not load portals.");
      setPayload(json.data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load portals.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const domainsByPortal = useMemo(() => {
    const grouped = new Map<string, DomainRecord[]>();
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
      if (!response.ok || json.error)
        throw new Error(json.error || "Request failed.");
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
    const ok = await run(
      {
        action: "create",
        ...form,
        slug: form.slug || slugify(form.name),
        domain: form.domain || null,
      },
      "Portal created.",
    );
    if (ok) setForm(emptyPortal);
  };

  const startEdit = (portal: PortalRecord) => {
    setEditingId(portal.id);
    setDraft(draftFrom(portal));
  };

  const savePortal = async (portal: PortalRecord) => {
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

  const togglePublic = async (portal: PortalRecord) => {
    await run(
      { action: "toggle_public", id: portal.id },
      portal.audience === "public"
        ? "Portal moved to internal."
        : "Portal is now public.",
    );
  };

  const makeDefault = async (portal: PortalRecord) => {
    await run(
      { action: "make_default", id: portal.id },
      "Default portal updated.",
    );
  };

  const deletePortal = async (portal: PortalRecord) => {
    if (portal.is_default) {
      setMessage(
        "Default portal cannot be deleted. Make another portal default first.",
      );
      return;
    }
    if (
      !window.confirm(
        `Delete "${portal.name}"? Catalog links will be detached from this portal.`,
      )
    )
      return;
    await run({ action: "delete", id: portal.id }, "Portal deleted.");
  };

  const copyTenantCode = async () => {
    const code = payload?.context.tenant.slug;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Organization code copied.");
    } catch {
      setMessage("Copy this organization code: " + code);
    }
  };

  const visiblePortals = (payload?.portals ?? []).filter((portal) =>
    (portal.name + " " + portal.slug)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-shell space-y-5">
      <header className="premium-panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-edsync-subtle">
            {payload?.context.tenant.name || "Your organization"}
          </p>
          <h1 className="font-display font-bold">Portals & domains</h1>
        </div>
        <button
          className="btn-secondary"
          onClick={() => void copyTenantCode()}
          disabled={!payload}
        >
          <Copy size={15} />
          Invite code
        </button>
      </header>
      {message && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-edsync-border p-3 text-sm"
        >
          <span className="flex-1">{message}</span>
          <button
            className="text-edsync-blue underline"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
      )}
      <div className="focus-banner">
        <div>
          <span className="text-xs uppercase tracking-widest text-emerald-200">
            Your academy, your identity
          </span>
          <h2 className="font-display">Start now. Connect a domain later.</h2>
          <p>
            Each portal has a shareable address. Your courses and access
            settings stay together.
          </p>
        </div>
        <Globe2
          size={48}
          strokeWidth={1}
          className="shrink-0 text-emerald-200"
        />
      </div>
      <details className="compact-guide" id="create-portal">
        <summary>
          <Plus size={18} />
          Create a portal
        </summary>
        <form onSubmit={createPortal} className="mt-4 space-y-4">
          <PortalFields value={form} onChange={setForm} />
          <button className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create portal"}
          </button>
        </form>
      </details>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold">
          Your portals{" "}
          <span className="ml-2 text-sm text-edsync-subtle">
            {payload?.portals.length ?? ""}
          </span>
        </h2>
        <label className="relative">
          <span className="sr-only">Find a portal</span>
          <Search
            className="absolute left-3 top-3 text-edsync-subtle"
            size={16}
          />
          <input
            className="edsync-input w-44 pl-9 sm:w-60"
            placeholder="Find a portal"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {loading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-edsync-muted"
          aria-label="Loading portals"
        />
      )}
      {!loading && !visiblePortals.length && (
        <p className="rounded-xl border border-dashed border-edsync-border p-8 text-center text-sm text-edsync-subtle">
          {search
            ? "No matching portals."
            : payload
              ? "Create your first portal to get started."
              : "Portals could not be loaded. Use Refresh to try again."}
        </p>
      )}
      <div className="grid gap-4">
        {visiblePortals.map((portal) => {
          const domains = domainsByPortal.get(portal.id) ?? [];
          return (
            <article key={portal.id} className="premium-surface p-5">
              {editingId === portal.id ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void savePortal(portal);
                  }}
                >
                  <PortalFields value={draft} onChange={setDraft} />
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy}>
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-xl bg-edsync-blue/10 p-3 text-edsync-blue">
                      <Building2 size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-semibold">
                        {portal.name}
                      </h2>
                      <p className="mt-1 text-xs capitalize text-edsync-subtle">
                        {portal.audience}
                        {portal.is_default ? " · Default" : ""}
                        {settingsOf(portal).enabled === false
                          ? " · Catalog off"
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="workspace-icon"
                      aria-label={"Edit " + portal.name}
                      title="Edit portal"
                      onClick={() => startEdit(portal)}
                    >
                      <Edit3 size={17} />
                    </button>
                    <ActionMenu label={"Actions for " + portal.name}>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-lg p-3 text-left text-sm"
                        onClick={() => void togglePublic(portal)}
                      >
                        <Globe2 className="mr-2 inline" size={15} />
                        {portal.audience === "public"
                          ? "Make internal"
                          : "Make public"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || Boolean(portal.is_default)}
                        className="rounded-lg p-3 text-left text-sm"
                        onClick={() => void makeDefault(portal)}
                      >
                        <Home className="mr-2 inline" size={15} />
                        Set as default
                      </button>
                      <button
                        type="button"
                        disabled={busy || Boolean(portal.is_default)}
                        className="rounded-lg p-3 text-left text-sm text-edsync-red"
                        onClick={() => void deletePortal(portal)}
                      >
                        <Trash2 className="mr-2 inline" size={15} />
                        Delete portal
                      </button>
                    </ActionMenu>
                  </div>
                  <div className="portal-address mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span>
                      {portal.address?.path ||
                        "/org/" +
                          portal.slug +
                          "?tenant=" +
                          payload?.context.tenant.slug}
                    </span>
                    {["public", "customer", "partner"].includes(
                      portal.audience,
                    ) &&
                      settingsOf(portal).enabled !== false && (
                        <Link
                          href={portal.address?.path || "/org/" + portal.slug}
                          className="font-semibold text-edsync-blue"
                        >
                          Open portal ↗
                        </Link>
                      )}
                  </div>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-semibold text-edsync-blue">
                      Subdomain & custom domain
                    </summary>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      <div className="portal-address">
                        <p className="mb-2 font-semibold">Platform subdomain</p>
                        <code>
                          {portal.address?.hostname ||
                            (portal.address?.subdomain
                              ? portal.address.subdomain + ".your-domain.com"
                              : "Choose shorter organization and portal slugs")}
                        </code>
                        <p className="mt-2 text-edsync-subtle">
                          {payload?.baseDomain
                            ? "Ready after wildcard DNS and the Worker route are configured."
                            : "Prepared. Add your domain after purchase; your portal link already works."}
                        </p>
                      </div>
                      <div className="portal-address">
                        <p className="mb-2 font-semibold">Custom domain</p>
                        {!domains.length ? (
                          <p className="text-edsync-subtle">
                            Optional. Edit this portal to add a hostname when
                            you own one.
                          </p>
                        ) : (
                          domains.map((domain) => (
                            <div key={domain.id}>
                              <p>
                                {domain.hostname} ·{" "}
                                <span className="capitalize">
                                  {domain.status}
                                </span>
                              </p>
                              {domain.status !== "active" && (
                                <>
                                  <p className="mt-3 text-edsync-subtle">
                                    DNS ownership record (TXT)
                                  </p>
                                  <code className="mt-1 block">
                                    _edsync-verification.{domain.hostname}
                                  </code>
                                  <code className="mt-1 block">
                                    {domain.verification_token}
                                  </code>
                                  <p className="mt-3 text-edsync-subtle">
                                    Activation follows ownership verification,
                                    HTTPS provisioning, and Worker routing.
                                  </p>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </details>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PortalFields({
  value,
  onChange,
}: {
  value: PortalDraft;
  onChange: (value: PortalDraft) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-xs font-semibold">
        Portal name
        <input
          className="edsync-input"
          required
          maxLength={120}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Design academy"
        />
      </label>
      <label className="grid gap-2 text-xs font-semibold">
        Address slug
        <input
          className="edsync-input"
          maxLength={80}
          autoCapitalize="none"
          spellCheck={false}
          value={value.slug}
          onChange={(event) => onChange({ ...value, slug: event.target.value })}
          placeholder={slugify(value.name) || "design-academy"}
        />
      </label>
      <label className="grid gap-2 text-xs font-semibold">
        Audience
        <select
          className="edsync-input"
          value={value.audience}
          onChange={(event) =>
            onChange({ ...value, audience: event.target.value })
          }
        >
          <option value="internal">Internal</option>
          <option value="public">Public</option>
          <option value="customer">Customers</option>
          <option value="partner">Partners</option>
        </select>
      </label>
      <label className="grid gap-2 text-xs font-semibold">
        Custom domain (optional)
        <input
          className="edsync-input"
          maxLength={253}
          value={value.domain}
          onChange={(event) =>
            onChange({ ...value, domain: event.target.value })
          }
          placeholder="learn.your-domain.com"
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={value.catalogEnabled}
          onChange={(event) =>
            onChange({ ...value, catalogEnabled: event.target.checked })
          }
        />
        Show course catalog
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={value.featuredOnly}
          onChange={(event) =>
            onChange({ ...value, featuredOnly: event.target.checked })
          }
        />
        Featured courses only
      </label>
    </div>
  );
}
