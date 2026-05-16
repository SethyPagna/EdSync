"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit3, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { InfoPopover } from "@/components/WorkspacePrimitives";
import type { Permission, RoleProfile } from "@/types";

type PermissionsPayload = {
  catalog: Permission[];
  roleProfiles: RoleProfile[];
  granted: string[];
};

type ProfileDraft = {
  label: string;
  description: string;
  permissions: string[];
};

const emptyDraft: ProfileDraft = {
  label: "",
  description: "",
  permissions: [],
};

function draftFrom(profile: RoleProfile): ProfileDraft {
  return {
    label: profile.label,
    description: profile.description ?? "",
    permissions: profile.permissions ?? [],
  };
}

function PermissionPicker({
  grouped,
  selected,
  onToggle,
}: {
  grouped: Record<string, Permission[]>;
  selected: string[];
  onToggle: (permission: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(grouped).map(([category, permissions]) => (
        <section key={category} className="rounded-2xl border border-edsync-border bg-edsync-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-semibold text-edsync-text">{category}</p>
            <span className="text-xs font-semibold text-edsync-subtle">
              {permissions.filter((permission) => selected.includes(permission.permission_key)).length}/
              {permissions.length}
            </span>
          </div>
          <div className="grid gap-1.5">
            {permissions.map((permission) => (
              <label
                key={permission.id}
                className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-edsync-card"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(permission.permission_key)}
                  onChange={() => onToggle(permission.permission_key)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-edsync-text">{permission.label}</span>
                  <span className="block truncate text-xs text-edsync-subtle">{permission.permission_key}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdminPermissionsPage() {
  const [payload, setPayload] = useState<PermissionsPayload>({ catalog: [], roleProfiles: [], granted: [] });
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProfileDraft>(emptyDraft);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/permissions", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { data?: PermissionsPayload }) => setPayload(json.data ?? { catalog: [], roleProfiles: [], granted: [] }));
  };

  useEffect(() => {
    load();
  }, []);

  const catalogByCategory = useMemo(() => {
    return payload.catalog.reduce<Record<string, Permission[]>>((collection, item) => {
      const key = item.category || "General";
      collection[key] = collection[key] || [];
      collection[key].push(item);
      return collection;
    }, {});
  }, [payload.catalog]);

  const systemProfiles = payload.roleProfiles.filter((role) => role.is_system);
  const tenantProfiles = payload.roleProfiles.filter((role) => !role.is_system);

  const togglePermission = (permission: string, target: ProfileDraft, update: (next: ProfileDraft) => void) => {
    const exists = target.permissions.includes(permission);
    update({
      ...target,
      permissions: exists ? target.permissions.filter((item) => item !== permission) : [...target.permissions, permission],
    });
  };

  const run = async (body: Record<string, unknown>, success: string) => {
    setMessage("");
    const response = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || json.error) {
      setMessage(json.error || "Request failed.");
      return false;
    }
    setMessage(success);
    load();
    return true;
  };

  const createProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await run({ action: "create_profile", ...draft }, "Role profile created.");
    if (ok) setDraft(emptyDraft);
  };

  const startEdit = (profile: RoleProfile) => {
    setEditingId(profile.id);
    setEditDraft(draftFrom(profile));
  };

  const saveProfile = async (profile: RoleProfile) => {
    const ok = await run({ action: "update_profile", id: profile.id, ...editDraft }, "Role profile saved.");
    if (ok) setEditingId(null);
  };

  const deleteProfile = async (profile: RoleProfile) => {
    if (!window.confirm(`Delete "${profile.label}"? Members using it will keep their account but lose this profile assignment.`)) return;
    await run({ action: "delete_profile", id: profile.id }, "Role profile deleted.");
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <header className="premium-panel rounded-2xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Access model</p>
          <h1 className="font-display text-3xl font-bold text-edsync-text">Permissions</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-edsync-subtle">
            Create tenant-scoped role profiles for organization owners, managers, auditors, billing admins, instructors, and learners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover label="Permission scope help">
            Platform owner access stays global. Profiles created here only apply inside the selected tenant, which keeps organization managers from changing application-wide settings.
          </InfoPopover>
          <div className="rounded-2xl border border-edsync-border bg-edsync-surface px-4 py-3 text-sm font-semibold text-edsync-subtle">
            Tenant-scoped roles
          </div>
        </div>
        </div>
      </header>

      {message && <div className="rounded-2xl border border-edsync-border bg-edsync-surface px-4 py-3 text-sm text-edsync-subtle">{message}</div>}

      <form onSubmit={createProfile} className="premium-surface grid gap-4 rounded-2xl p-4 xl:grid-cols-[320px_minmax(0,1fr)_auto]">
        <div className="grid gap-3">
          <input className="edsync-input" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Role profile name" required />
          <textarea className="edsync-input min-h-24" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this role can manage" />
        </div>
        <PermissionPicker
          grouped={catalogByCategory}
          selected={draft.permissions}
          onToggle={(permission) => togglePermission(permission, draft, setDraft)}
        />
        <button className="btn-primary h-fit justify-center" type="submit">Add profile</button>
      </form>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-surface overflow-hidden rounded-2xl p-0">
          <div className="border-b border-edsync-border px-4 py-3">
            <h2 className="font-display text-xl font-bold">Tenant role profiles</h2>
            <p className="text-sm text-edsync-subtle">Edit, delete, or adjust permissions without changing platform-owner access.</p>
          </div>
          <div className="divide-y divide-edsync-border">
            {tenantProfiles.map((profile) => {
              const editing = editingId === profile.id;
              return (
                <div key={profile.id} className="grid gap-3 px-4 py-4 text-sm">
                  {editing ? (
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input className="edsync-input" value={editDraft.label} onChange={(event) => setEditDraft({ ...editDraft, label: event.target.value })} />
                        <input className="edsync-input" value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} />
                      </div>
                      <PermissionPicker
                        grouped={catalogByCategory}
                        selected={editDraft.permissions}
                        onToggle={(permission) => togglePermission(permission, editDraft, setEditDraft)}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-edsync-text">{profile.label}</p>
                      <p className="mt-1 text-edsync-subtle">{profile.description || "Tenant role profile"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(profile.permissions ?? []).map((permission) => (
                          <span key={permission} className="badge bg-edsync-blue/10 text-edsync-blue">{permission}</span>
                        ))}
                        {(profile.permissions ?? []).length === 0 && <span className="text-sm text-edsync-subtle">No permissions selected.</span>}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {editing ? (
                      <>
                        <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={() => saveProfile(profile)}><Save className="h-4 w-4" /> Save</button>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => startEdit(profile)}><Edit3 className="h-4 w-4" /> Edit</button>
                        <button type="button" className="btn-ghost px-3 py-2 text-sm text-rose-600" onClick={() => deleteProfile(profile)}><Trash2 className="h-4 w-4" /> Delete</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {tenantProfiles.length === 0 && <p className="px-4 py-5 text-sm text-edsync-subtle">No tenant profiles yet.</p>}
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="premium-surface rounded-2xl p-4">
            <h2 className="font-display text-xl font-bold">System profiles</h2>
            <div className="mt-3 grid gap-2">
              {systemProfiles.map((role) => (
                <div key={role.id} className="rounded-2xl border border-edsync-border bg-edsync-surface p-3 text-sm">
                  <p className="font-semibold">{role.label}</p>
                  <p className="text-edsync-subtle">{role.description || "System role profile"}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="premium-surface rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-edsync-blue" />
              <h2 className="font-display text-xl font-bold">Permission catalog</h2>
            </div>
            <div className="mt-3 grid gap-3">
              {Object.entries(catalogByCategory).map(([category, items]) => (
                <div key={category}>
                  <p className="text-sm font-semibold text-edsync-text">{category}</p>
                  <p className="text-sm text-edsync-subtle">{items.length} permissions</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
