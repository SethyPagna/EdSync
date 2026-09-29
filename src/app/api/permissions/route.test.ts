// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), context: vi.fn(), query: vi.fn(), permissions: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/permissions", () => ({
  getPermissionSet: mocks.permissions,
  PERMISSIONS: { usersManage: "users.manage" },
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", resolveTenantContext: mocks.context }));

import { GET } from "./route";

describe("permission profile visibility", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "teacher-outside", user_metadata: { role: "teacher" } });
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-school" }, membership: null, portal: null });
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.permissions.mockReset().mockResolvedValue(new Set());
  });

  it("rejects an organization outsider before loading tenant role profiles", async () => {
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.permissions).not.toHaveBeenCalled();
  });

  it("still loads role profiles for an active member", async () => {
    mocks.context.mockResolvedValueOnce({ tenant: { id: "tenant-school" }, membership: { status: "active" }, portal: null });
    mocks.permissions.mockResolvedValueOnce(new Set(["learn"]));

    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect((await response.json()).data.granted).toEqual(["learn"]);
  });
});
