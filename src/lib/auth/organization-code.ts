export function normalizeOrganizationCode(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createOrganizationSlug(name: string, idSuffix: string) {
  const base = normalizeOrganizationCode(name) || "organization";
  return `${base}-${idSuffix}`;
}
