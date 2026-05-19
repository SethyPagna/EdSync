export const DISCUSSION_TITLE_MAX_LENGTH = 160;
export const DISCUSSION_PROMPT_MAX_LENGTH = 4_000;
export const DISCUSSION_POST_MAX_LENGTH = 8_000;

export function validateDiscussionText(
  value: unknown,
  label: string,
  maxLength: number,
  required = true,
) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}
