"use client";

import { useEffect, useState } from "react";

export default function AdminPermissionsPage() {
  const [payload, setPayload] = useState<any>(null);
  useEffect(() => {
    fetch("/api/permissions").then((res) => res.json()).then((json) => setPayload(json.data));
  }, []);

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-edsync-blue">Access model</p>
        <h1 className="font-display text-3xl font-bold text-edsync-text">Permissions</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Composable permissions power simple solo mode and enterprise role profiles from the same shell.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="edsync-card overflow-hidden">
          <h2 className="border-b border-edsync-border px-4 py-3 font-display text-xl font-bold">Permission catalog</h2>
          {(payload?.catalog ?? []).map((item: any) => (
            <div key={item.id} className="border-b border-edsync-border px-4 py-3 text-sm">
              <p className="font-semibold">{item.label}</p>
              <p className="text-edsync-subtle">{item.permission_key} - {item.description}</p>
            </div>
          ))}
        </section>
        <section className="edsync-card overflow-hidden">
          <h2 className="border-b border-edsync-border px-4 py-3 font-display text-xl font-bold">Role profiles</h2>
          {(payload?.roleProfiles ?? []).map((role: any) => (
            <div key={role.id} className="border-b border-edsync-border px-4 py-3 text-sm">
              <p className="font-semibold">{role.label}</p>
              <p className="text-edsync-subtle">{role.description}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
