export const ORGANIZATION_CODE_MAX_LENGTH = 80;

export function normalizeOrganizationCode(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validateOrganizationCode(value?: string | null) {
  const code = normalizeOrganizationCode(value);
  if (!code) throw new Error("Organization code is required.");
  if (code.length > ORGANIZATION_CODE_MAX_LENGTH) {
    throw new Error(`Organization code must be ${ORGANIZATION_CODE_MAX_LENGTH} characters or fewer.`);
  }
  return code;
}

export function createOrganizationSlug(name: string, idSuffix: string) {
  const base = normalizeOrganizationCode(name) || "organization";
  return `${base}-${idSuffix}`;
}
