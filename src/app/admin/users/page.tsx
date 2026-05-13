"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "teacher" | "student";
  is_admin: number;
  last_active_at: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");

  const loadUsers = () => {
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setUsers(payload.data ?? []));
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
    toast.success(admin ? "Admin access granted." : "Admin access removed.");
    loadUsers();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="mt-2 text-sm text-edsync-subtle">Review teachers, students, and admin access.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            loadUsers();
          }}
          className="flex gap-2"
        >
          <input className="edsync-input w-64" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" />
          <button className="btn-secondary" type="submit">Search</button>
        </form>
      </div>

      <div className="edsync-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-edsync-border text-xs uppercase text-edsync-subtle">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3 text-right">Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edsync-border">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-semibold">{user.full_name || "Unnamed"}</td>
                <td className="px-4 py-3 text-edsync-subtle">{user.email}</td>
                <td className="px-4 py-3 capitalize">{user.is_admin ? "admin" : user.role}</td>
                <td className="px-4 py-3 text-edsync-subtle">
                  {user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleAdmin(user.id, !user.is_admin)}
                    className={user.is_admin ? "btn-primary" : "btn-secondary"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {user.is_admin ? "Admin" : "Grant"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
