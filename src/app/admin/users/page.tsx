"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Mail, RefreshCw, Search, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { ActionMenu, InfoPopover } from "@/components/WorkspacePrimitives";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "teacher" | "student";
  is_admin: number;
  last_active_at: string | null;
};

type UserGroupKey = "admins" | "teachers" | "students";

const groupCopy: Record<UserGroupKey, { title: string; description: string }> = {
  admins: {
    title: "Owner admins",
    description: "Global EdSync access for the platform owner team.",
  },
  teachers: {
    title: "Org creators",
    description: "Organization course creators and space managers.",
  },
  students: {
    title: "Org learners",
    description: "Organization learners with courses, progress, notes, and discussions.",
  },
};

function groupFor(user: AdminUser): UserGroupKey {
  if (user.is_admin) return "admins";
  return user.role === "teacher" ? "teachers" : "students";
}

export default function AdminUsersPage() {
  const skippedInitialDebounce = useRef(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<UserGroupKey | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async (searchTerm = "") => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(searchTerm)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Could not load users.");
        setLoading(false);
        return;
      }
      setUsers(payload.data ?? []);
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadUsers]);

  useEffect(() => {
    if (!skippedInitialDebounce.current) {
      skippedInitialDebounce.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      loadUsers(query);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadUsers, query]);

  const grouped = useMemo(() => {
    return users.reduce<Record<UserGroupKey, AdminUser[]>>(
      (collection, user) => {
        collection[groupFor(user)].push(user);
        return collection;
      },
      { admins: [], teachers: [], students: [] },
    );
  }, [users]);

  const visibleGroups: UserGroupKey[] =
    activeGroup === "all" ? ["admins", "teachers", "students"] : [activeGroup];

  const toggleAdmin = async (userId: string, admin: boolean) => {
    setBusyUserId(userId);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, admin }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error || "Could not update admin access.");
      setBusyUserId(null);
      return;
    }
    toast.success(admin ? "Platform admin access granted." : "Platform admin access removed.");
    await loadUsers(query);
    setBusyUserId(null);
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div className="premium-panel rounded-2xl p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">People and access</p>
          <h1 className="font-display text-3xl font-bold">Accounts</h1>
          <p className="mt-2 max-w-3xl text-sm text-edsync-subtle">
            Platform admin is for EdSync ownership. Organization managers stay tenant-scoped.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <InfoPopover label="User access help">
            Global admin unlocks the owner console. Organization owners and managers stay inside their own tenant permissions.
          </InfoPopover>
          <button
            type="button"
            onClick={() => loadUsers(query)}
            className="btn-secondary justify-center px-3 py-2 text-sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadUsers(query);
          }}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-edsync-subtle" />
            <input
              className="edsync-input w-full pl-9 sm:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users"
            />
          </div>
          <button className="btn-secondary justify-center" type="submit">Search</button>
        </form>
        {error && (
          <div className="mt-4 rounded-2xl border border-edsync-red/25 bg-edsync-red/10 px-4 py-3 text-sm font-semibold text-edsync-red">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(["admins", "teachers", "students"] as UserGroupKey[]).map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setActiveGroup(activeGroup === group ? "all" : group)}
            className={`premium-card flex items-center justify-between rounded-2xl p-4 text-left transition hover:-translate-y-0.5 ${
              activeGroup === group ? "border-edsync-blue bg-edsync-blue/10" : ""
            }`}
          >
            <span>
              <span className="block text-sm font-semibold text-edsync-subtle">{groupCopy[group].title}</span>
              <span className="block text-3xl font-bold text-edsync-text">{grouped[group].length}</span>
            </span>
            {group === "admins" ? <UserCog className="h-5 w-5 text-edsync-blue" /> : <UsersRound className="h-5 w-5 text-edsync-subtle" />}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {visibleGroups.map((group) => (
          <section key={group} className="premium-surface overflow-hidden rounded-2xl p-0">
            <div className="border-b border-edsync-border px-4 py-3">
              <h2 className="font-display text-xl font-bold">{groupCopy[group].title}</h2>
              <p className="text-sm text-edsync-subtle">{groupCopy[group].description}</p>
            </div>
            <div className="divide-y divide-edsync-border">
              {loading &&
                [...Array(3)].map((_, index) => (
                  <div key={index} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_88px]">
                    <span className="h-10 animate-pulse rounded-xl bg-edsync-muted" />
                    <span className="h-10 animate-pulse rounded-xl bg-edsync-muted" />
                    <span className="h-10 animate-pulse rounded-xl bg-edsync-muted" />
                    <span className="h-10 animate-pulse rounded-xl bg-edsync-muted" />
                  </div>
                ))}
              {grouped[group].map((user) => (
                <div key={user.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_220px_150px_88px] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.full_name || "Unnamed"}</p>
                    <p className="truncate text-edsync-subtle">{user.email}</p>
                  </div>
                  <p className="capitalize text-edsync-subtle">{user.is_admin ? "owner admin" : user.role === "teacher" ? "org creator" : "org learner"}</p>
                  <p className="text-edsync-subtle">
                    {user.last_active_at ? formatDate(user.last_active_at) : "Never active"}
                  </p>
                  <div className="flex justify-start lg:justify-end">
                    <ActionMenu label={`Actions for ${user.email}`}>
                      <a
                        href={`mailto:${user.email}`}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text"
                      >
                        <Mail className="h-4 w-4" />
                        Email user
                      </a>
                      <button
                        type="button"
                        onClick={() => toggleAdmin(user.id, !user.is_admin)}
                        disabled={busyUserId === user.id}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-edsync-subtle hover:bg-edsync-muted hover:text-edsync-text disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {user.is_admin ? "Remove owner admin" : "Grant owner admin"}
                      </button>
                    </ActionMenu>
                  </div>
                </div>
              ))}
              {!loading && grouped[group].length === 0 && (
                <p className="px-4 py-5 text-sm text-edsync-subtle">No users in this group.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
