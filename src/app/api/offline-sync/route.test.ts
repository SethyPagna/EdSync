import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), context: vi.fn(), apply: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: mocks.context,
}));
vi.mock("@/lib/offline-sync", () => ({ applyOfflineSync: mocks.apply }));

import { POST } from "./route";

describe("offline sync tenant boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "visitor", user_metadata: { role: "student" } });
  });

  it("rejects a signed-in outsider before linking events to an organization", async () => {
    mocks.context.mockResolvedValue({ tenant: { id: "tenant-school" }, membership: null });

    const response = await POST(new Request("https://school--main.example.test/api/offline-sync", {
      method: "POST",
      body: JSON.stringify({ items: [{ clientId: "draft-1", itemType: "note" }] }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("syncs an active member's items in their organization", async () => {
    mocks.context.mockResolvedValue({ tenant: { id: "tenant-school" }, membership: { status: "active" } });
    mocks.apply.mockResolvedValue([]);

    const response = await POST(new Request("https://school--main.example.test/api/offline-sync", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith({ tenantId: "tenant-school", userId: "visitor", items: [] });
  });
});
