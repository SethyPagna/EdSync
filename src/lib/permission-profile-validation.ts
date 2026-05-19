import { PERMISSIONS } from "@/lib/permissions";

export const ROLE_PROFILE_ID_MAX_LENGTH = 160;
export const ROLE_PROFILE_LABEL_MAX_LENGTH = 120;
export const ROLE_PROFILE_DESCRIPTION_MAX_LENGTH = 600;
export const ROLE_PROFILE_KEY_MAX_LENGTH = 120;

const ROLE_PROFILE_ID_PATTERN = /^[a-z0-9_.:-]+$/i;
const SAFE_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

export type NormalizedRoleProfileInput = {
  label: string;
  description: string | null;
  permissions: string[];
  profileKey: string;
};

export function validateRoleProfileId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("Profile is required.");
  if (id.length > ROLE_PROFILE_ID_MAX_LENGTH || !ROLE_PROFILE_ID_PATTERN.test(id)) {
    throw new Error("Profile id must be a short identifier.");
  }
  return id;
}

export function validateRoleProfileText(value: unknown, label: string, maxLength: number, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function normalizeRoleProfilePermissions(value: unknown) {
  if (!Array.isArray(value)) return [];

  const permissions = new Set<string>();
  for (const item of value) {
    const permission = String(item ?? "").trim();
    if (!permission) continue;
    if (!SAFE_PERMISSIONS.has(permission)) {
      throw new Error(`Unsupported permission: ${permission}`);
    }
    permissions.add(permission);
  }
  return Array.from(permissions);
}

export function makeRoleProfileKey(label: string, fallbackId: string) {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const fallback = `profile_${fallbackId.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}`;
  return (key || fallback).slice(0, ROLE_PROFILE_KEY_MAX_LENGTH);
}

export function normalizeRoleProfileInput(input: {
  label?: unknown;
  description?: unknown;
  permissions?: unknown;
  fallbackId: string;
}): NormalizedRoleProfileInput {
  const label = validateRoleProfileText(input.label, "Profile label", ROLE_PROFILE_LABEL_MAX_LENGTH);
  return {
    label,
    description: validateRoleProfileText(input.description, "Profile description", ROLE_PROFILE_DESCRIPTION_MAX_LENGTH, false) || null,
    permissions: normalizeRoleProfilePermissions(input.permissions),
    profileKey: makeRoleProfileKey(label, input.fallbackId),
  };
}
