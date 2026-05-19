export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const AUTH_PASSWORD_MAX_LENGTH = 256;

export function validateSignupPassword(value: unknown): string {
  const password = passwordString(value);
  if (!password || password.length < AUTH_PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`);
  }
  ensurePasswordIsWithinMaximum(password);
  return password;
}

export function validateLoginPassword(value: unknown): string {
  const password = passwordString(value);
  if (!password) {
    throw new Error("Password is required.");
  }
  ensurePasswordIsWithinMaximum(password);
  return password;
}

function passwordString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function ensurePasswordIsWithinMaximum(password: string): void {
  if (password.length > AUTH_PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be ${AUTH_PASSWORD_MAX_LENGTH} characters or fewer.`);
  }
}
