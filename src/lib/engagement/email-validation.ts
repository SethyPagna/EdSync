export const EMAIL_SUBJECT_MAX_LENGTH = 180;
export const EMAIL_BODY_MAX_LENGTH = 20_000;
export const EMAIL_DISPLAY_MAX_LENGTH = 120;
export const EMAIL_ADDRESS_MAX_LENGTH = 254;
export const EMAIL_MAX_RECIPIENTS = 300;
export const EMAIL_METADATA_MAX_LENGTH = 4_000;
export const EMAIL_ID_MAX_LENGTH = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DANGEROUS_MAILTO_PATTERN = /[\r\n]/;
const DANGEROUS_HTML_PATTERN = /<\s*(script|iframe|object|embed|form|meta|link)\b|on[a-z]+\s*=|javascript:|data:text\/html/i;
const EMAIL_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateEmailAddress(value: unknown, label = "Email") {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) throw new Error(`${label} is required.`);
  if (email.length > EMAIL_ADDRESS_MAX_LENGTH) {
    throw new Error(`${label} must be ${EMAIL_ADDRESS_MAX_LENGTH} characters or fewer.`);
  }
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

export function validateEmailHtml(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const html = String(value).trim();
  if (!html) return null;
  if (html.length > EMAIL_BODY_MAX_LENGTH) {
    throw new Error(`HTML body must be ${EMAIL_BODY_MAX_LENGTH} characters or fewer.`);
  }
  if (DANGEROUS_HTML_PATTERN.test(html)) {
    throw new Error("HTML body contains unsupported markup.");
  }
  return html;
}

export function normalizeEmailDisplay(value: unknown, fallback: string) {
  const display = String(value ?? "").trim() || fallback;
  if (DANGEROUS_MAILTO_PATTERN.test(display)) throw new Error("Sender display cannot include line breaks.");
  return display.slice(0, EMAIL_DISPLAY_MAX_LENGTH);
}

export function validateEmailRecordId(value: unknown, label = "Record") {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`${label} is required.`);
  if (id.length > EMAIL_ID_MAX_LENGTH || !EMAIL_ID_PATTERN.test(id)) {
    throw new Error(`${label} must be a short identifier.`);
  }
  return id;
}

export function normalizeOptionalEmailRecordId(value: unknown, label = "Record") {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return validateEmailRecordId(value, label);
}

export function normalizeEmailMetadata(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) throw new Error("Email metadata must be a JSON object.");
  const serialized = JSON.stringify(value);
  if (serialized.length > EMAIL_METADATA_MAX_LENGTH) {
    throw new Error(`Email metadata must be ${EMAIL_METADATA_MAX_LENGTH} characters or fewer.`);
  }
  return value;
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
