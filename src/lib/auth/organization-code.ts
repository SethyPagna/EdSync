export const ORGANIZATION_CODE_MAX_LENGTH = 80;
export const ORGANIZATION_CODE_INPUT_MAX_LENGTH = 160;

export function normalizeOrganizationCode(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validateOrganizationCode(value?: string | null) {
  const rawCode = value || "";
  if (rawCode.length > ORGANIZATION_CODE_INPUT_MAX_LENGTH) {
    throw new Error(`Organization code must be ${ORGANIZATION_CODE_INPUT_MAX_LENGTH} characters or fewer before formatting.`);
  }
  const code = normalizeOrganizationCode(value);
  if (!code) throw new Error("Organization code is required.");
  if (code.length > ORGANIZATION_CODE_MAX_LENGTH) {
    throw new Error(`Organization code must be ${ORGANIZATION_CODE_MAX_LENGTH} characters or fewer.`);
  }
  return code;
}

export function createOrganizationSlug(name: string, idSuffix: string) {
  const suffix = normalizeOrganizationCode(idSuffix);
  const separatorAndSuffixLength = suffix ? suffix.length + 1 : 0;
  const maxBaseLength = Math.max(1, ORGANIZATION_CODE_MAX_LENGTH - separatorAndSuffixLength);
  const base = (normalizeOrganizationCode(name) || "organization").slice(0, maxBaseLength).replace(/-+$/g, "");
  return suffix ? `${base}-${suffix}` : base;
}
