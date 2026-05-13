"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

type TenantPayload = {
  current?: {
    tenant?: { name?: string; slug?: string; plan_tier?: string };
    portal?: { name?: string; audience?: string; slug?: string };
  };
  tenants?: Array<{ id: string; name: string; slug: string; plan_tier: string }>;
};

export default function OrganizationContextBanner() {
  const [payload, setPayload] = useState<TenantPayload | null>(null);

  useEffect(() => {
    fetch("/api/tenants", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setPayload(json?.data ?? null))
      .catch(() => setPayload(null));
  }, []);

  const tenant = payload?.current?.tenant;
  if (!tenant) return null;
  const portal = payload?.current?.portal;
  const count = payload?.tenants?.length ?? 0;

  return (
    <div className="rounded-lg border border-edsync-border bg-edsync-surface p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-edsync-blue/10 text-edsync-blue">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-edsync-text">{tenant.name}</p>
            <p className="truncate text-xs text-edsync-subtle">
              {portal?.name || "Default portal"} - {portal?.audience || tenant.plan_tier || "workspace"}
              {count > 1 ? ` - ${count} organizations available` : ""}
            </p>
          </div>
        </div>
        {portal?.audience === "public" && portal.slug && (
          <Link href={`/org/${portal.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-edsync-blue">
            Public portal <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

