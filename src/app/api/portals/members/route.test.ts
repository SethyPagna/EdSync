// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  context: vi.fn(),
  permission: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/tenancy", () => ({ resolveTenantContext: mocks.context }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { portalsManage: "portals.manage" }, requirePermission: mocks.permission }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));

import { GET, POST } from "./route";

const request = (action: string) => new Request("https://edsync.test/api/portals/members", { method: "POST", body: JSON.stringify({ action }) });

describe("portal members and invites", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "owner", user_metadata: { role: "teacher" } });
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-one", slug: "school" }, membership: { status: "active" } });
    mocks.permission.mockReset().mockResolvedValue(undefined);
    mocks.query.mockReset().mockResolvedValue([]);
  });

  it("does not reveal members or invite code without portal permission", async () => {
    mocks.permission.mockRejectedValue(new Error("denied"));
    expect((await GET()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
    expect((await POST(request("rotate"))).status).toBe(403);
  });

  it("scopes member and invite reads to the active tenant", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "member-1", email: "member@example.com" }]).mockResolvedValueOnce([{ invite_code: "join-abc", invites_enabled: 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.inviteCode).toBe("join-abc");
    expect(data.members).toHaveLength(1);
    expect(mocks.query.mock.calls).toHaveLength(2);
    expect(mocks.query.mock.calls.every(([, params]) => params[0] === "tenant-one")).toBe(true);
  });

  it("does not present a public tenant slug as an invite code", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ invite_code: null, invites_enabled: 1 }]);
    const response = await GET();
    expect((await response.json()).data.inviteCode).toBeNull();
  });

  it("rotates an unpredictable code only for the active tenant", async () => {
    const response = await POST(request("rotate"));
    expect(response.status).toBe(200);
    const code = (await response.json()).data.inviteCode as string;
    expect(code).toMatch(/^join-[0-9a-f]{20}$/);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("json_set"), [code, "tenant-one"]);
  });

  it("can pause joins and rejects unknown actions", async () => {
    expect((await POST(request("disable"))).status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("invites_enabled"), [0, "tenant-one"]);
    mocks.query.mockClear();
    expect((await POST(request("delete"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("creates a private code when enabling invitations for a legacy tenant", async () => {
    const response = await POST(request("enable"));
    expect(response.status).toBe(200);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("COALESCE(json_extract(settings, '$.invite_code'), ?)");
    expect(params[0]).toMatch(/^join-[0-9a-f]{20}$/);
    expect(params[1]).toBe("tenant-one");
  });
});
