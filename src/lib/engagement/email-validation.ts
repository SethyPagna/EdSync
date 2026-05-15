export const EMAIL_SUBJECT_MAX_LENGTH = 180;
export const EMAIL_BODY_MAX_LENGTH = 20_000;
export const EMAIL_DISPLAY_MAX_LENGTH = 120;
export const EMAIL_MAX_RECIPIENTS = 300;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DANGEROUS_MAILTO_PATTERN = /[\r\n]/;

export function validateEmailAddress(value: unknown, label = "Email") {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) throw new Error(`${label} is required.`);
  if (DANGEROUS_MAILTO_PATTERN.test(email) || !EMAIL_PATTERN.test(email)) {
    throw new Error(`${label} must be a valid email address.`);
  }
  return email;
}

export function validateEmailSubject(value: unknown) {
  const subject = String(value ?? "").trim();
  if (!subject) throw new Error("Subject is required.");
  if (DANGEROUS_MAILTO_PATTERN.test(subject)) throw new Error("Subject cannot include line breaks.");
  if (subject.length > EMAIL_SUBJECT_MAX_LENGTH) {
    throw new Error(`Subject must be ${EMAIL_SUBJECT_MAX_LENGTH} characters or fewer.`);
  }
  return subject;
}

export function validateEmailBody(value: unknown) {
  const body = String(value ?? "").trim();
  if (!body) throw new Error("Message body is required.");
  if (body.length > EMAIL_BODY_MAX_LENGTH) {
    throw new Error(`Message body must be ${EMAIL_BODY_MAX_LENGTH} characters or fewer.`);
  }
  return body;
}

export function normalizeEmailDisplay(value: unknown, fallback: string) {
  const display = String(value ?? "").trim() || fallback;
  if (DANGEROUS_MAILTO_PATTERN.test(display)) throw new Error("Sender display cannot include line breaks.");
  return display.slice(0, EMAIL_DISPLAY_MAX_LENGTH);
}

export function validateRecipientList<T extends { email: string }>(recipients: T[]) {
  const unique = new Map<string, T>();
  for (const recipient of recipients) {
    const email = validateEmailAddress(recipient.email, "Recipient email");
    if (!unique.has(email)) unique.set(email, { ...recipient, email });
  }

  if (unique.size === 0) throw new Error("At least one recipient is required.");
  if (unique.size > EMAIL_MAX_RECIPIENTS) {
    throw new Error(`Recipient list must be ${EMAIL_MAX_RECIPIENTS} people or fewer.`);
  }
  return Array.from(unique.values());
}
