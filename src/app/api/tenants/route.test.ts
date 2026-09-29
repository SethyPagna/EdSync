// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), query: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { portalsManage: "portals.manage" }, requirePermission: mocks.permission }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", ensureDefaultTenant: vi.fn(), resolveTenantContext: mocks.context }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { GET, POST } from "./route";

const request = () => new Request("https://edsync.test/api/tenants", { method: "POST", body: JSON.stringify({ name: "New Academy", slug: "new-academy" }) });

describe("tenant creation invites", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "owner", user_metadata: { role: "admin" } });
    mocks.permission.mockReset().mockResolvedValue(undefined);
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-one" }, membership: { status: "active" } });
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

  it("returns only safe tenant fields to active learners", async () => {
    mocks.user.mockResolvedValueOnce({ id: "learner", user_metadata: { role: "student" } });
    mocks.context.mockResolvedValueOnce({
      tenant: { id: "tenant-one", slug: "school", name: "School", plan_tier: "team", settings: '{"invite_code":"join-secret"}' },
      portal: { id: "portal-one", slug: "main", name: "Main", audience: "internal" },
      membership: { id: "member-one", status: "active", role_profile_id: "role_learner" },
    });
    mocks.query.mockResolvedValueOnce([{ id: "tenant-one", slug: "school", name: "School", plan_tier: "team", settings: '{"invite_code":"join-secret"}' }]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      current: {
        tenant: { id: "tenant-one", slug: "school", name: "School", plan_tier: "team" },
        portal: { id: "portal-one", slug: "main", name: "Main", audience: "internal" },
        membership: { id: "member-one", status: "active", role_profile_id: "role_learner" },
      },
      tenants: [{ id: "tenant-one", slug: "school", name: "School", plan_tier: "team" }],
    });
    expect(String(mocks.query.mock.calls[0][0])).toContain("SELECT t.id, t.slug, t.name, t.plan_tier");
    expect(mocks.query.mock.calls[0][1]).toEqual(["learner"]);
  });

  it("rejects a signed-in outsider on an organization hostname before listing tenants", async () => {
    mocks.user.mockResolvedValueOnce({ id: "outsider", user_metadata: { role: "teacher" } });
    mocks.context.mockResolvedValueOnce({
      tenant: { id: "tenant-school", slug: "school", settings: { invite_code: "join-secret" } },
      membership: null,
    });

    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ data: null, error: "Organization membership required." });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("keeps the platform admin list safe across tenants", async () => {
    mocks.context.mockResolvedValueOnce({ tenant: { id: "tenant_edsync_default", slug: "edsync", name: "EdSync", plan_tier: "enterprise" }, membership: null });
    mocks.query.mockResolvedValueOnce([{ id: "tenant-school", slug: "school", name: "School", plan_tier: "team", settings: '{"invite_code":"join-secret"}' }]);

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.tenants).toEqual([{ id: "tenant-school", slug: "school", name: "School", plan_tier: "team" }]);
    expect(JSON.stringify(body)).not.toContain("invite_code");
    expect(String(mocks.query.mock.calls[0][0])).toContain("SELECT id, slug, name, plan_tier FROM tenants");
  });
});
