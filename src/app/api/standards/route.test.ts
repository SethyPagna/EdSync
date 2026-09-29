// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), context: vi.fn(), query: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/standards", () => ({ parseStandardsManifest: vi.fn() }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", resolveTenantContext: mocks.context }));

import { GET } from "./route";

describe("standards package visibility", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "former-owner", user_metadata: { role: "teacher" } });
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-school" }, membership: null, portal: null });
    mocks.query.mockReset().mockResolvedValue([{ id: "package-school", owner_id: "former-owner", manifest: '{"private":"course"}' }]);
  });

  it("rejects a former owner before reading the tenant package manifest", async () => {
    const response = await GET(new Request("https://school.example.test/api/standards"), undefined);
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("still lists packages for an active member", async () => {
    mocks.context.mockResolvedValueOnce({ tenant: { id: "tenant-school" }, membership: { status: "active" }, portal: null });

    const response = await GET(new Request("https://school.example.test/api/standards"), undefined);
    expect(response.status).toBe(200);
    expect((await response.json()).data.packages[0].manifest).toEqual({ private: "course" });
    expect(mocks.query.mock.calls[0][1]).toEqual(["tenant-school"]);
  });
});
