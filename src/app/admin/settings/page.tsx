"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Flag = {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: number | boolean;
};

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [emailMode, setEmailMode] = useState("outbox");

  const load = () => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setFlags(payload.data?.flags ?? []);
        setEmailMode(payload.data?.emailMode ?? "outbox");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (flagKey: string, enabled: boolean) => {
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagKey, enabled }),
    });
    toast.success("Setting updated.");
    load();
  };

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Control the Core v1 feature set and deployment behavior.</p>
      </div>

      <div className="edsync-card p-4">
        <p className="text-sm font-semibold text-edsync-subtle">Email mode</p>
        <p className="mt-2 text-2xl font-bold capitalize">{emailMode}</p>
        <p className="mt-2 text-sm text-edsync-subtle">
          Outbox mode is fully free and creates compose links instead of spoofing teacher email addresses.
        </p>
      </div>

      <div className="grid gap-3">
        {flags.map((flag) => (
          <div key={flag.id} className="edsync-card flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-semibold">{flag.label}</p>
              <p className="text-sm text-edsync-subtle">{flag.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(flag.flag_key, !flag.enabled)}
              className={flag.enabled ? "btn-primary" : "btn-secondary"}
            >
              {flag.enabled ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
