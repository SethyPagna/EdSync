import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { queueEmail } from "@/lib/engagement/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    to?: string;
    subject?: string;
    text?: string;
    html?: string | null;
    classId?: string | null;
    senderDisplay?: string | null;
    replyTo?: string | null;
    metadata?: Record<string, unknown>;
  };

  if ((!body.to && !body.classId) || !body.subject || !body.text) {
    return NextResponse.json({ data: null, error: "Recipient or class, subject, and text are required." }, { status: 400 });
  }

  const recipients = body.classId
    ? await d1Query<{ id: string; email: string }>(
        `SELECT p.id, p.email
           FROM class_enrollments ce
           JOIN profiles p ON p.id = ce.student_id
          WHERE ce.class_id = ? AND ce.is_active = 1`,
        [body.classId],
      )
    : [{ id: null, email: body.to! }];

  const results = await Promise.all(
    recipients.map((recipient) =>
      queueEmail({
        recipientUserId: recipient.id,
        recipientEmail: recipient.email,
        subject: body.subject!,
        bodyText: body.text!,
        bodyHtml: body.html ?? null,
        senderDisplay: body.senderDisplay ?? user.email,
        replyTo: body.replyTo ?? user.email,
        metadata: { sentBy: user.id, classId: body.classId ?? null, ...(body.metadata ?? {}) },
      }),
    ),
  );

  const composeUrl =
    recipients.length === 1
      ? results[0]?.composeUrl ?? null
      : `mailto:?bcc=${encodeURIComponent(recipients.map((recipient) => recipient.email).join(","))}&subject=${encodeURIComponent(body.subject)}&body=${encodeURIComponent(body.text)}`;

  await d1Query(
    `INSERT INTO email_outbox_events (
       id, teacher_id, class_id, subject, body_text, recipient_count, recipients,
       sender_display, reply_to, compose_url, provider, status, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbox', 'queued', ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      user.id,
      body.classId ?? null,
      body.subject,
      body.text,
      recipients.length,
      JSON.stringify(recipients.map((recipient) => recipient.email)),
      body.senderDisplay ?? user.email,
      body.replyTo ?? user.email,
      composeUrl,
      JSON.stringify({ messageIds: results.map((result) => result.id) }),
    ],
  );

  return NextResponse.json({ data: { count: results.length, composeUrl, messages: results }, error: null });
}
