"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import type { Notification } from "@/types";

type NotificationResponse = {
  data: Notification[];
  error: string | null;
};

function formatAge(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const load = async () => {
    const response = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as NotificationResponse;
    setItems(payload.data ?? []);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    );
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg border border-edsync-border bg-edsync-card p-2 text-edsync-text hover:border-edsync-blue/40"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-edsync-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-edsync-border bg-edsync-surface shadow-2xl shadow-slate-200/60 dark:shadow-black/30">
          <div className="flex items-center justify-between border-b border-edsync-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-edsync-text">Notifications</p>
              <p className="text-xs text-edsync-subtle">{unread} unread</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-edsync-blue hover:bg-edsync-blue/10"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Read all
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-edsync-subtle">
                Nothing new yet.
              </div>
            ) : (
              items.map((item) => {
                const content = (
                  <div
                    className={`rounded-lg border p-3 transition ${
                      item.read_at
                        ? "border-transparent hover:bg-edsync-card"
                        : "border-edsync-blue/25 bg-edsync-blue/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-edsync-text">{item.title}</p>
                      <span className="text-xs text-edsync-subtle">{formatAge(item.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-edsync-subtle">{item.message}</p>
                  </div>
                );

                return item.action_url ? (
                  <Link
                    key={item.id}
                    href={item.action_url}
                    onClick={() => {
                      markRead(item.id);
                      setOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markRead(item.id)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
