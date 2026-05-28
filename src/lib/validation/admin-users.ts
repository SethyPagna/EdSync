export const ADMIN_USER_ID_MAX_LENGTH = 160;
export const ADMIN_USER_SEARCH_MAX_LENGTH = 120;

const ADMIN_USER_ID_PATTERN = /^[a-z0-9_.:-]+$/i;

export type NormalizedAdminUserPatch = {
  userId: string;
  admin: boolean;
};

export function validateAdminUserId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("User id is required.");
  if (id.length > ADMIN_USER_ID_MAX_LENGTH || !ADMIN_USER_ID_PATTERN.test(id)) {
    throw new Error("User id must be a short identifier.");
  }
  return id;
}

export function normalizeAdminUserSearch(value: unknown) {
  const query = String(value ?? "").trim().toLowerCase();
  if (query.length > ADMIN_USER_SEARCH_MAX_LENGTH) {
    throw new Error(`Search must be ${ADMIN_USER_SEARCH_MAX_LENGTH} characters or fewer.`);
  }
  return query;
}

export function normalizeAdminToggle(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Admin access must be true or false.");
  return value;
}

export function normalizeAdminUserPatch(input: { userId?: unknown; admin?: unknown }): NormalizedAdminUserPatch {
  return {
    userId: validateAdminUserId(input.userId),
    admin: normalizeAdminToggle(input.admin),
  };
}
