import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { d1Query } from "@/lib/db/d1";
import { deserializeRow } from "@/lib/db/schema";

type EmailOutboxRow = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject: string;
  body_text: string;
  recipient_count: number;
  recipients: string[];
  sender_display: string | null;
  reply_to: string | null;
  compose_url: string | null;
  provider: string | null;
  status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  class_name?: string | null;
};

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const rows = await d1Query<Record<string, unknown>>(
    `SELECT eo.*, p.full_name AS teacher_name, p.email AS teacher_email, c.name AS class_name
       FROM email_outbox_events eo
       LEFT JOIN profiles p ON p.id = eo.teacher_id
       LEFT JOIN classes c ON c.id = eo.class_id
      ORDER BY eo.created_at DESC
      LIMIT 100`,
  );
  const events = rows.map((row) => {
    const event = deserializeRow<EmailOutboxRow>("email_outbox_events", row);
    return {
      ...event,
      provider: event.provider ?? "outbox",
      status: event.status ?? "queued",
      preview: event.body_text.length > 140 ? `${event.body_text.slice(0, 137)}...` : event.body_text,
      recipient_sample: event.recipients.slice(0, 3),
    };
  });
  return NextResponse.json({ data: events, error: null });
}
