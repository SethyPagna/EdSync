"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock3, MailOpen, Trash2 } from "lucide-react";
import type { Notification } from "@/types";

type NotificationResponse = {
  data: Notification[];
  error: string | null;
};
type NotificationMenuProps = {
  align?: "left" | "right";
  placement?: "top" | "bottom";
};

const NOTIFICATION_REFRESH_MS = 60_000;

async function readNotifications(response: Response): Promise<NotificationResponse> {
  if (!response.ok) return { data: [], error: "Notifications are unavailable." };
  const text = await response.text();
  if (!text) return { data: [], error: null };
  try {
    return JSON.parse(text) as NotificationResponse;
  } catch {
    return { data: [], error: "Notifications returned an invalid response." };
  }
}

function formatAge(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function priorityClass(priority: Notification["priority"]) {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200";
  if (priority === "low") return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
}

export default function NotificationMenu({ align = "right", placement = "bottom" }: NotificationMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
      const payload = await readNotifications(response);
      setItems(payload.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      void load();
    };
    const initialTimer = window.setTimeout(refreshNotifications, 0);
    const refreshTimer = window.setInterval(refreshNotifications, NOTIFICATION_REFRESH_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const markAllRead = async () => {
    if (unread === 0) return;
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
    setBusyIds((current) => new Set(current).add(id));
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const remove = async (id: string) => {
    setBusyIds((current) => new Set(current).add(id));
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) setItems(previous);
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="premium-icon-button relative"
        aria-label="Open notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {loaded && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-edsync-red px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`premium-overlay animate-overlay-in absolute z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "top" ? "bottom-12" : "top-12"}`}
        >
          <div className="flex items-center justify-between border-b border-edsync-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-edsync-text">Notifications</p>
              <p className="text-xs text-edsync-subtle">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-edsync-blue hover:bg-edsync-blue/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Read all
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edsync-border bg-edsync-card/60 px-4 py-8 text-center text-sm text-edsync-subtle">
                <Bell className="mx-auto mb-3 h-7 w-7 text-edsync-blue" />
                Nothing new.
              </div>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-lg border p-3 transition ${
                    item.read_at ? "border-transparent hover:bg-edsync-card" : "border-edsync-blue/25 bg-edsync-blue/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityClass(item.priority)}`}>
                          {item.priority}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-edsync-subtle">
                          <Clock3 className="h-3 w-3" />
                          {formatAge(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-edsync-text">{item.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={busyIds.has(item.id)}
                      className="rounded-lg p-1.5 text-edsync-subtle hover:bg-edsync-surface hover:text-edsync-red disabled:opacity-50"
                      aria-label={`Delete notification: ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-edsync-subtle">{item.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.action_url && (
                      <Link
                        href={item.action_url}
                        onClick={() => {
                          markRead(item.id);
                          setOpen(false);
                        }}
                        className="btn-primary px-2.5 py-1.5 text-xs"
                      >
                        Open
                      </Link>
                    )}
                    {!item.read_at && (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        disabled={busyIds.has(item.id)}
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                      >
                        <MailOpen className="h-3.5 w-3.5" />
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
