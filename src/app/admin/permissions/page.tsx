"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { GuidePanel } from "@/components/WorkspacePrimitives";

type PermissionItem = {
  id: string;
  permission_key: string;
  label: string;
  description: string | null;
  category: string | null;
};

type RoleProfile = {
  id: string;
  label: string;
  description: string | null;
  tenant_id: string | null;
  is_system: number | boolean;
};

type PermissionsPayload = {
  catalog: PermissionItem[];
  roleProfiles: RoleProfile[];
  granted: string[];
};

export default function AdminPermissionsPage() {
  const [payload, setPayload] = useState<PermissionsPayload>({ catalog: [], roleProfiles: [], granted: [] });

  useEffect(() => {
    fetch("/api/permissions", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setPayload(json.data ?? { catalog: [], roleProfiles: [], granted: [] }));
  }, []);

  const catalogByCategory = useMemo(() => {
    return payload.catalog.reduce<Record<string, PermissionItem[]>>((collection, item) => {
      const key = item.category || "General";
      collection[key] = collection[key] || [];
      collection[key].push(item);
      return collection;
    }, {});
  }, [payload.catalog]);

  const platformProfiles = payload.roleProfiles.filter((role) => role.is_system);
  const tenantProfiles = payload.roleProfiles.filter((role) => !role.is_system);

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Access model</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Permissions</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Global platform admin is reserved for the EdSync owner. Organization owners should manage tenant roles, feature visibility, layout,
            and menus without affecting other organizations.
          </p>
        </div>
        <GuidePanel
          title="Admin does not mean the same thing everywhere"
          description="Use platform admin for whole-application control. Use tenant role profiles for organization owners, managers, auditors, billing admins, and instructors."
          icon={ShieldCheck}
          items={[
            "Platform owner: global AI, security, settings, and cross-tenant oversight.",
            "Organization admin: tenant-only people, menus, features, and reports.",
            "Teacher or learner: classroom and learning-work permissions only.",
          ]}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="edsync-card p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-edsync-blue" />
          <p className="font-semibold">Platform owner</p>
          <p className="mt-1 text-sm text-edsync-subtle">Full application control, global security, AI providers, and cross-tenant oversight.</p>
        </div>
        <div className="edsync-card p-4">
          <Building2 className="mb-3 h-5 w-5 text-edsync-emerald" />
          <p className="font-semibold">Organization admin</p>
          <p className="mt-1 text-sm text-edsync-subtle">Tenant-scoped control over users, feature visibility, role profiles, and workspace layout.</p>
        </div>
        <div className="edsync-card p-4">
          <SlidersHorizontal className="mb-3 h-5 w-5 text-edsync-amber" />
          <p className="font-semibold">Role profiles</p>
          <p className="mt-1 text-sm text-edsync-subtle">Reusable permission bundles for instructors, managers, auditors, billing, and learners.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="edsync-card overflow-hidden p-0">
          <h2 className="border-b border-edsync-border px-4 py-3 font-display text-xl font-bold">Permission Catalog</h2>
          <div className="divide-y divide-edsync-border">
            {Object.entries(catalogByCategory).map(([category, items]) => (
              <details key={category} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
                  {category}
                  <span className="rounded-md bg-edsync-blue/10 px-2 py-1 text-xs text-edsync-blue">{items.length}</span>
                </summary>
                <div className="grid gap-2 border-t border-edsync-border p-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-edsync-border bg-edsync-surface p-3 text-sm">
                      <p className="font-semibold">{item.label}</p>
                      <p className="mt-1 break-all text-xs text-edsync-subtle">{item.permission_key}</p>
                      {item.description && <p className="mt-1 text-sm text-edsync-subtle">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="edsync-card p-4">
            <h2 className="font-display text-xl font-bold">System Profiles</h2>
            <div className="mt-3 grid gap-2">
              {platformProfiles.map((role) => (
                <div key={role.id} className="rounded-lg border border-edsync-border p-3 text-sm">
                  <p className="font-semibold">{role.label}</p>
                  <p className="text-edsync-subtle">{role.description || "System role profile"}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="edsync-card p-4">
            <h2 className="font-display text-xl font-bold">Tenant Profiles</h2>
            <p className="mt-1 text-sm text-edsync-subtle">These are the profiles organization owners and managers should customize.</p>
            <div className="mt-3 grid gap-2">
              {tenantProfiles.map((role) => (
                <div key={role.id} className="rounded-lg border border-edsync-border p-3 text-sm">
                  <p className="font-semibold">{role.label}</p>
                  <p className="text-edsync-subtle">{role.description || "Tenant role profile"}</p>
                </div>
              ))}
              {tenantProfiles.length === 0 && <p className="text-sm text-edsync-subtle">No tenant-specific profiles yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
