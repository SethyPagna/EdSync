export const EMAIL_ADDRESS_MAX_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DANGEROUS_MAILTO_PATTERN = /[\r\n]/;

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
