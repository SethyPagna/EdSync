import { d1Query } from "@/lib/db/d1";
import {
  normalizeEmailDisplay,
  normalizeEmailMetadata,
  validateEmailAddress,
  validateEmailBody,
  validateEmailHtml,
  validateEmailSubject,
} from "@/lib/engagement/email-validation";
import { normalizeNotificationInput } from "@/lib/engagement/notification-validation";

type NotificationInput = {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  priority?: "low" | "normal" | "high";
  channels?: string[];
  metadata?: Record<string, unknown>;
};

type EmailInput = {
  recipientUserId?: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  senderDisplay?: string | null;
  replyTo?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeEmailInput(input: EmailInput): EmailInput {
  return {
    ...input,
    recipientEmail: validateEmailAddress(input.recipientEmail, "Recipient email"),
    subject: validateEmailSubject(input.subject),
    bodyText: validateEmailBody(input.bodyText),
    bodyHtml: validateEmailHtml(input.bodyHtml),
    senderDisplay: normalizeEmailDisplay(input.senderDisplay, "EdSync"),
    replyTo: input.replyTo ? validateEmailAddress(input.replyTo, "Reply-to email") : null,
    metadata: normalizeEmailMetadata(input.metadata),
  };
}

function composeMailto(input: EmailInput) {
  const query = new URLSearchParams({
    subject: input.subject,
    body: input.bodyText,
  });
  return `mailto:${encodeURIComponent(input.recipientEmail)}?${query.toString()}`;
}

export async function createNotification(input: NotificationInput) {
  const notification = normalizeNotificationInput(input);
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO notifications (
       id, user_id, actor_id, type, title, message, action_url, priority, channels, metadata, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      input.userId,
      input.actorId ?? null,
      notification.type,
      notification.title,
      notification.message,
      notification.actionUrl,
      notification.priority,
      JSON.stringify(notification.channels),
      JSON.stringify(notification.metadata),
    ],
  );
  return id;
}

async function sendViaResend(input: EmailInput) {
  const mode = process.env.EMAIL_MODE || "outbox";
  if (mode !== "provider") {
    return { status: "queued" as const, provider: "outbox", providerId: null, error: null };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "EdSync <notifications@edsync.app>";
  if (!apiKey) return { status: "queued" as const, provider: "outbox", providerId: null, error: null };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.recipientEmail,
      subject: input.subject,
      text: input.bodyText,
      html: input.bodyHtml ?? input.bodyText.replace(/\n/g, "<br />"),
      reply_to: input.replyTo || undefined,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    return {
      status: "failed" as const,
      provider: "resend",
      providerId: null,
      error: payload.message ?? response.statusText,
    };
  }

  return { status: "sent" as const, provider: "resend", providerId: payload.id ?? null, error: null };
}

export async function queueEmail(input: EmailInput) {
  const normalized = normalizeEmailInput(input);
  const result = await sendViaResend(normalized);
  const composeUrl = composeMailto(normalized);
  const id = crypto.randomUUID();
  await d1Query(
    `INSERT INTO email_messages (
       id, recipient_user_id, recipient_email, subject, body_text, body_html,
       status, provider, provider_message_id, error_message, metadata, created_at, sent_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    [
      id,
      normalized.recipientUserId ?? null,
      normalized.recipientEmail,
      normalized.subject,
      normalized.bodyText,
      normalized.bodyHtml ?? null,
      result.status,
      result.provider,
      result.providerId,
      result.error,
      JSON.stringify({
        composeUrl,
        senderDisplay: normalized.senderDisplay ?? null,
        replyTo: normalized.replyTo ?? null,
        ...(normalized.metadata ?? {}),
      }),
      result.status === "sent" ? new Date().toISOString() : null,
    ],
  );
  return { id, composeUrl, ...result };
}

export async function notifyAndEmail(input: NotificationInput & { email?: EmailInput | null }) {
  const notificationId = await createNotification(input);
  const emailResult = input.email ? await queueEmail(input.email) : null;
  return { notificationId, email: emailResult };
}
