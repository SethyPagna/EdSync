"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

type EmailEvent = {
  id: string;
  subject: string;
  recipient_count: number;
  sender_display: string | null;
  reply_to: string | null;
  compose_url: string | null;
  created_at: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
};

export default function AdminEmailPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);

  useEffect(() => {
    fetch("/api/admin/email", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setEvents(payload.data ?? []));
  }, []);

  return (
    <div className="space-y-5 p-5 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Email outbox</h1>
        <p className="mt-2 text-sm text-edsync-subtle">Audit generated class email drafts and free compose links.</p>
      </div>

      <div className="edsync-card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-edsync-border text-xs uppercase text-edsync-subtle">
            <tr>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Compose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edsync-border">
            {events.map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 font-semibold">{event.subject}</td>
                <td className="px-4 py-3 text-edsync-subtle">{event.teacher_name || event.teacher_email || "Unknown"}</td>
                <td className="px-4 py-3">{event.recipient_count}</td>
                <td className="px-4 py-3 text-edsync-subtle">{new Date(event.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {event.compose_url && (
                    <a className="btn-secondary inline-flex" href={event.compose_url}>
                      <Mail className="h-4 w-4" />
                      Open
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="p-4 text-sm text-edsync-subtle">No outbox events yet.</p>}
      </div>
    </div>
  );
}
