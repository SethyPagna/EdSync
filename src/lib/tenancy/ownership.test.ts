import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>(),
  cookies: async () => new Map<string, { value: string }>(),
}));

import { DEFAULT_TENANT_ID, assertTenantObject } from "@/lib/tenancy";
import { canContactUser, isOwnerScoped, isTenantOutsider, ownerScope } from "@/lib/tenancy/ownership";

type ScopeContext = Parameters<typeof isOwnerScoped>[1];

const teacher = { id: "teacher-1", user_metadata: { role: "teacher" as const } };
const admin = { id: "admin-1", user_metadata: { role: "admin" as const } };
const defaultTenant = { tenant: { id: DEFAULT_TENANT_ID } } as ScopeContext;
const schoolTenant = { tenant: { id: "tenant-school" }, membership: { status: "active" } } as ScopeContext;
const schoolHostOutsider = { tenant: { id: "tenant-school" }, membership: null } as ScopeContext;
const suspendedMember = { tenant: { id: "tenant-school" }, membership: { status: "suspended" } } as ScopeContext;

describe("owner scope", () => {
  it("scopes non-admins in the shared default tenant to their own rows", () => {
    expect(isOwnerScoped(teacher, defaultTenant)).toBe(true);
    expect(ownerScope(teacher, defaultTenant, "owner_id")).toEqual({ sql: " AND owner_id = ?", params: ["teacher-1"] });
  });

  it("leaves organization members and platform admins tenant-wide", () => {
    expect(isOwnerScoped(teacher, schoolTenant)).toBe(false);
    expect(isOwnerScoped(admin, defaultTenant)).toBe(false);
    expect(isOwnerScoped(admin, schoolHostOutsider)).toBe(false);
    expect(ownerScope(teacher, schoolTenant, "owner_id")).toEqual({ sql: "", params: [] });
  });

  it("scopes signed-in non-members on an organization host to their own rows", () => {
    expect(isOwnerScoped(teacher, schoolHostOutsider)).toBe(true);
    expect(isOwnerScoped(teacher, suspendedMember)).toBe(true);
    expect(ownerScope(teacher, schoolHostOutsider, "owner_id")).toEqual({ sql: " AND owner_id = ?", params: ["teacher-1"] });
  });
});

describe("isTenantOutsider", () => {
  it("is true only for non-admins without an active membership in an organization tenant", () => {
    expect(isTenantOutsider(teacher, schoolHostOutsider)).toBe(true);
    expect(isTenantOutsider(teacher, suspendedMember)).toBe(true);
    expect(isTenantOutsider(teacher, { tenant: schoolTenant.tenant })).toBe(true);
    expect(isTenantOutsider(teacher, schoolTenant)).toBe(false);
    expect(isTenantOutsider(teacher, defaultTenant)).toBe(false);
    expect(isTenantOutsider(admin, schoolHostOutsider)).toBe(false);
  });
});

describe("canContactUser", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("allows self and platform admins without a lookup", async () => {
    await expect(canContactUser({ sender: teacher, context: defaultTenant, recipientId: "teacher-1" })).resolves.toBe(true);
    await expect(canContactUser({ sender: admin, context: defaultTenant, recipientId: "anyone" })).resolves.toBe(true);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("requires an active membership in organization tenants", async () => {
    mocks.query.mockResolvedValueOnce([]);
    await expect(canContactUser({ sender: teacher, context: schoolTenant, recipientId: "stranger" })).resolves.toBe(false);
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("FROM tenant_memberships");
    expect(mocks.query.mock.calls[0]?.[1]).toEqual(["tenant-school", "stranger"]);
  });

  it("requires a shared active class in the default tenant", async () => {
    mocks.query.mockResolvedValueOnce([]);
    await expect(canContactUser({ sender: teacher, context: defaultTenant, recipientId: "stranger" })).resolves.toBe(false);
    mocks.query.mockResolvedValueOnce([{ id: "class-1" }]);
    await expect(canContactUser({ sender: teacher, context: defaultTenant, recipientId: "student-1" })).resolves.toBe(true);
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain("FROM classes c");
  });
});

describe("assertTenantObject", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("matches the link tenant for organization tenants", async () => {
    mocks.query.mockResolvedValueOnce([{ tenant_id: "tenant-school" }]);
    await expect(assertTenantObject({ tenantId: "tenant-school", table: "lessons", objectId: "lesson-1" })).resolves.toBe(true);
    mocks.query.mockResolvedValueOnce([{ tenant_id: "tenant-other" }]);
    await expect(assertTenantObject({ tenantId: "tenant-school", table: "lessons", objectId: "lesson-1" })).resolves.toBe(false);
  });

  it("requires ownership in the default tenant", async () => {
    mocks.query.mockResolvedValueOnce([{ tenant_id: DEFAULT_TENANT_ID }]).mockResolvedValueOnce([]);
    await expect(
      assertTenantObject({ tenantId: DEFAULT_TENANT_ID, table: "lessons", objectId: "lesson-1", ownerColumn: "teacher_id", userId: "teacher-2" }),
    ).resolves.toBe(false);
    expect(mocks.query.mock.calls[1]).toEqual(["SELECT id FROM lessons WHERE id = ? AND teacher_id = ? LIMIT 1", ["lesson-1", "teacher-2"]]);

    mocks.query.mockResolvedValueOnce([]);
    await expect(assertTenantObject({ tenantId: DEFAULT_TENANT_ID, table: "lessons", objectId: "lesson-1" })).resolves.toBe(false);
  });

  it("never treats another tenant's object as default-tenant data", async () => {
    mocks.query.mockResolvedValueOnce([{ tenant_id: "tenant-school" }]);
    await expect(
      assertTenantObject({ tenantId: DEFAULT_TENANT_ID, table: "lessons", objectId: "lesson-1", isTenantAdmin: true }),
    ).resolves.toBe(false);
  });

  it("rejects unsafe identifiers", async () => {
    await expect(assertTenantObject({ tenantId: DEFAULT_TENANT_ID, table: "lessons; DROP TABLE x", objectId: "1" })).rejects.toThrow(
      "Invalid SQL identifier",
    );
  });
});
