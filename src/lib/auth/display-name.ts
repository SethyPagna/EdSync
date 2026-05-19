export const DISPLAY_NAME_MAX_LENGTH = 120;

export function validateDisplayName(value: unknown): string | null {
  const displayName = typeof value === "string" ? value.trim() : "";
  if (!displayName) return null;
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Full name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }
  if (/[\r\n]/.test(displayName)) {
    throw new Error("Full name must be a single line.");
  }
  return displayName;
}
