// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { portalsManage: "portals.manage" }, requirePermission: mocks.permission }));
vi.mock("@/lib/tenancy", () => ({ ensureDefaultTenant: vi.fn(), resolveTenantContext: vi.fn(async () => ({ tenant: { id: "tenant-one" } })) }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { POST } from "./route";

const request = () => new Request("https://edsync.test/api/tenants", { method: "POST", body: JSON.stringify({ name: "New Academy", slug: "new-academy" }) });

describe("tenant creation invites", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "owner", user_metadata: { role: "admin" } });
    mocks.permission.mockReset().mockResolvedValue(undefined);
    mocks.query.mockReset().mockResolvedValue([]);
  });

  it("seeds an invite code and returns it to the authorized creator", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.inviteCode).toMatch(/^join-[0-9a-f]{20}$/);
    const tenantWrite = mocks.query.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO tenants"));
    if (!tenantWrite) throw new Error("Tenant insert was not recorded.");
    expect(JSON.parse(tenantWrite[1][6])).toEqual({ invite_code: data.inviteCode, invites_enabled: true });
  });

  it("does not create a tenant without portal management permission", async () => {
    mocks.permission.mockRejectedValue(new Error("denied"));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
