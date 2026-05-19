import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import {
  normalizeEmailDisplay,
  normalizeEmailMetadata,
  normalizeOptionalEmailRecordId,
  validateEmailAddress,
  validateEmailBody,
  validateEmailHtml,
  validateEmailSubject,
  validateRecipientList,
} from "@/lib/engagement/email-validation";
import { queueEmail } from "@/lib/engagement/server";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { resolveTenantContext } from "@/lib/tenancy";

type EmailStatus = "queued" | "composed" | "sent" | "failed" | "skipped";

function summarizeProvider(results: Array<{ provider: string }>) {
  const providers = new Set(results.map((result) => result.provider));
  return providers.size === 1 ? results[0]?.provider ?? "outbox" : "mixed";
}

function summarizeStatus(results: Array<{ status: string }>): EmailStatus {
  if (results.length === 0) return "skipped";
  if (results.every((result) => result.status === "sent")) return "sent";
  if (results.every((result) => result.status === "failed")) return "failed";
  return "queued";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  const context = await resolveTenantContext(user);
  try {
    await requirePermission(user, context, PERMISSIONS.coursesAuthor);
  } catch {
    return NextResponse.json({ data: null, error: "Missing authoring permission." }, { status: 403 });
  }

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

  let subject: string;
  let text: string;
  let html: string | null;
  let replyTo: string;
  let senderDisplay: string;
  let classId: string | null;
  let metadata: Record<string, unknown>;
  try {
    subject = validateEmailSubject(body.subject);
    text = validateEmailBody(body.text);
    html = validateEmailHtml(body.html);
    replyTo = validateEmailAddress(body.replyTo ?? user.email, "Reply-to email");
    senderDisplay = normalizeEmailDisplay(body.senderDisplay, user.email);
    classId = normalizeOptionalEmailRecordId(body.classId, "Class");
    metadata = normalizeEmailMetadata(body.metadata);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email payload is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  if (!body.to && !classId) {
    return NextResponse.json({ data: null, error: "Recipient or class is required." }, { status: 400 });
  }

  const classRecipients = classId
    ? await d1Query<{ id: string; email: string }>(
        `SELECT p.id, p.email
           FROM class_enrollments ce
           JOIN classes c ON c.id = ce.class_id
           JOIN profiles p ON p.id = ce.student_id
          WHERE ce.class_id = ?
            AND ce.is_active = 1
            AND c.is_active = 1
            AND (? = 1 OR c.teacher_id = ?)`,
        [classId, user.user_metadata.role === "admin" ? 1 : 0, user.id],
      )
    : [];
  if (classId && classRecipients.length === 0 && !body.to) {
    return NextResponse.json({ data: null, error: "No active recipients were found for this class." }, { status: 404 });
  }

  let recipients: Array<{ id: string | null; email: string }>;
  try {
    const directRecipients = body.to ? [{ id: null, email: validateEmailAddress(body.to, "Recipient email") }] : [];
    recipients = validateRecipientList([...classRecipients, ...directRecipients]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recipient list is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  const results = await Promise.all(
    recipients.map((recipient) =>
      queueEmail({
        recipientUserId: recipient.id,
        recipientEmail: recipient.email,
        subject,
        bodyText: text,
        bodyHtml: html,
        senderDisplay,
        replyTo,
        metadata: { sentBy: user.id, classId, ...metadata },
      }),
    ),
  );

  const composeUrl =
    recipients.length === 1
      ? results[0]?.composeUrl ?? null
      : `mailto:?bcc=${encodeURIComponent(recipients.map((recipient) => recipient.email).join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const provider = summarizeProvider(results);
  const status = summarizeStatus(results);

  await d1Query(
    `INSERT INTO email_outbox_events (
       id, teacher_id, class_id, subject, body_text, recipient_count, recipients,
       sender_display, reply_to, compose_url, provider, status, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      user.id,
      classId,
      subject,
      text,
      recipients.length,
      JSON.stringify(recipients.map((recipient) => recipient.email)),
      senderDisplay,
      replyTo,
      composeUrl,
      provider,
      status,
      JSON.stringify({ messageIds: results.map((result) => result.id) }),
    ],
  );

  return NextResponse.json({ data: { count: results.length, composeUrl, messages: results }, error: null });
}
