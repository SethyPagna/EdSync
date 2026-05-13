"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Search, ShieldCheck, UserCog, UsersRound } from "lucide-react";

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
    title: "Platform Admins",
    description: "Global EdSync operators with full application access.",
  },
  teachers: {
    title: "Teachers",
    description: "Course creators and class managers inside their tenant or workspace.",
  },
  students: {
    title: "Students",
    description: "Learners with access to assigned work, grades, notes, and discussions.",
  },
};

function groupFor(user: AdminUser): UserGroupKey {
  if (user.is_admin) return "admins";
  return user.role === "teacher" ? "teachers" : "students";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<UserGroupKey | "all">("all");

  const loadUsers = () => {
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setUsers(payload.data ?? []));
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, admin }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast.error(payload.error || "Could not update admin access.");
      return;
    }
    toast.success(admin ? "Platform admin access granted." : "Platform admin access removed.");
    loadUsers();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">People and access</p>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="mt-2 max-w-3xl text-sm text-edsync-subtle">
            Platform admin is for the app owner. Organization owners and managers should use tenant-scoped role profiles, not global access.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadUsers();
          }}
          className="flex flex-col gap-2 sm:flex-row"
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
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(["admins", "teachers", "students"] as UserGroupKey[]).map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => setActiveGroup(activeGroup === group ? "all" : group)}
            className={`edsync-card flex items-center justify-between p-4 text-left ${
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
          <section key={group} className="edsync-card overflow-hidden p-0">
            <div className="border-b border-edsync-border px-4 py-3">
              <h2 className="font-display text-xl font-bold">{groupCopy[group].title}</h2>
              <p className="text-sm text-edsync-subtle">{groupCopy[group].description}</p>
            </div>
            <div className="divide-y divide-edsync-border">
              {grouped[group].map((user) => (
                <div key={user.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_220px_150px_160px] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.full_name || "Unnamed"}</p>
                    <p className="truncate text-edsync-subtle">{user.email}</p>
                  </div>
                  <p className="capitalize text-edsync-subtle">{user.is_admin ? "platform admin" : user.role}</p>
                  <p className="text-edsync-subtle">
                    {user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "Never active"}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleAdmin(user.id, !user.is_admin)}
                    className={user.is_admin ? "btn-primary justify-center px-3 py-2" : "btn-secondary justify-center px-3 py-2"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {user.is_admin ? "Global admin" : "Grant global"}
                  </button>
                </div>
              ))}
              {grouped[group].length === 0 && (
                <p className="px-4 py-5 text-sm text-edsync-subtle">No users in this group.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
