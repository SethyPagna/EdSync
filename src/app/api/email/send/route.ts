import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { d1Query } from "@/lib/db/d1";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  readJson,
  withRoute,
} from "@/lib/security/http-errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  tenantObjectJoin,
  tenantObjectParams,
  tenantObjectPredicate,
} from "@/lib/tenancy/object-scope";
import { resolveTenantContext } from "@/lib/tenancy";
import { canContactUser } from "@/lib/tenancy/ownership";

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

function validated<T>(parse: () => T, fallback: string): T {
  try {
    return parse();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : fallback);
  }
}

export const POST = withRoute(async (request) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  const context = await resolveTenantContext(user);
  await requirePermission(user, context, PERMISSIONS.coursesAuthor).catch(() => {
    throw new ForbiddenError("Missing authoring permission.");
  });
  if (!(await isFeatureEnabled("email_outbox"))) throw new ForbiddenError("Course messages are unavailable.");
  const isPlatformAdmin = user.user_metadata.role === "admin";

  const body = await readJson<{
    to?: string;
    subject?: string;
    text?: string;
    html?: string | null;
    classId?: string | null;
    senderDisplay?: string | null;
    replyTo?: string | null;
    metadata?: Record<string, unknown>;
  }>(request);

  const { subject, text, html, replyTo, senderDisplay, classId, metadata } = validated(
    () => ({
      subject: validateEmailSubject(body.subject),
      text: validateEmailBody(body.text),
      html: validateEmailHtml(body.html),
      // Only platform admins may route replies somewhere other than their own inbox.
      replyTo: validateEmailAddress(isPlatformAdmin ? body.replyTo ?? user.email : user.email, "Reply-to email"),
      senderDisplay: normalizeEmailDisplay(body.senderDisplay, user.email),
      classId: normalizeOptionalEmailRecordId(body.classId, "Class"),
      metadata: normalizeEmailMetadata(body.metadata),
    }),
    "Email payload is invalid.",
  );
  const directEmail = body.to ? validated(() => validateEmailAddress(body.to, "Recipient email"), "Recipient email is invalid.") : null;
  if (!directEmail && !classId) throw new BadRequestError("Recipient or class is required.");

  const rate = await enforceRateLimit({ request, scope: "email_send", limit: 20, windowSeconds: 3600, userId: user.id });
  if (!rate.allowed) throw new TooManyRequestsError("Too many emails sent. Try again later.", rate.retryAfter);

  const classRecipients = classId
    ? await d1Query<{ id: string; email: string }>(
        `SELECT p.id, p.email
           FROM class_enrollments ce
           JOIN classes c ON c.id = ce.class_id
           JOIN profiles p ON p.id = ce.student_id
           ${tenantObjectJoin({ objectTable: "classes", objectAlias: "c", linkAlias: "class_link" })}
          WHERE ${tenantObjectPredicate({ linkAlias: "class_link" })}
            AND ce.class_id = ?
            AND ce.is_active = 1
            AND c.is_active = 1
            AND (? = 1 OR c.teacher_id = ?)`,
        [
          ...tenantObjectParams({ objectTable: "classes", tenantId: context.tenant.id }),
          classId,
          isPlatformAdmin ? 1 : 0,
          user.id,
        ],
      )
    : [];
  if (classId && classRecipients.length === 0 && !directEmail) {
    throw new NotFoundError("No active recipients were found for this class.");
  }

  const directRecipients: Array<{ id: string | null; email: string }> = [];
  if (directEmail) {
    const [profile] = await d1Query<{ id: string }>("SELECT id FROM profiles WHERE lower(email) = lower(?) LIMIT 1", [directEmail]);
    if (!isPlatformAdmin && (!profile || !(await canContactUser({ sender: user, context, recipientId: profile.id })))) {
      throw new ForbiddenError("You can only email members of your organization or classes.");
    }
    directRecipients.push({ id: profile?.id ?? null, email: directEmail });
  }

  const recipients = validated(
    () => validateRecipientList<{ id: string | null; email: string }>([...classRecipients, ...directRecipients]),
    "Recipient list is invalid.",
  );

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
});
