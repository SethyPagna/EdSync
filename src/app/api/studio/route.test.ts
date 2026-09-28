import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), user: vi.fn() }));

vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/tenancy", () => ({
  resolveTenantContext: async () => ({ tenant: { id: "tenant-a" }, portal: null }),
  linkTenantObject: vi.fn(),
}));
vi.mock("@/lib/learning-events", () => ({ appendLearningEvent: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { coursesPublish: "courses.publish" }, getPermissionSet: vi.fn() }));

import { DELETE, GET, PATCH } from "./route";

const stored = {
  id: "design-1",
  tenant_id: "tenant-a",
  owner_id: "owner",
  item_kind: "slide",
  title: "My design",
  content: "{}",
  plain_text: "",
  status: "draft",
  source_type: null,
  source_id: null,
  metadata: "{}",
  created_at: "2026-09-28 12:00:00",
  updated_at: "2026-09-28 12:00:00",
};

beforeEach(() => {
  mocks.user.mockReset().mockResolvedValue({ id: "owner", user_metadata: { role: "teacher" } });
  mocks.query.mockReset().mockResolvedValue([]);
});

describe("Studio document access", () => {
  it("loads one owned design by id without listing the tenant's other designs", async () => {
    mocks.query.mockResolvedValueOnce([stored]);
    const response = await GET(new Request("http://localhost/api/studio?id=design-1"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.item).toMatchObject({ id: "design-1", title: "My design" });
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).toContain("owner_id = ?");
    expect(mocks.query.mock.calls[0][1]).toEqual(["design-1", "tenant-a", "owner"]);
  });

  it("hides a foreign design and its history", async () => {
    expect((await GET(new Request("http://localhost/api/studio?id=foreign"))).status).toBe(404);
    mocks.query.mockResolvedValueOnce([{ id: "foreign", tenant_id: "tenant-b", owner_id: "owner" }]);
    expect((await GET(new Request("http://localhost/api/studio?historyId=foreign"))).status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("returns 404 for unauthorized edits and deletion without making a write", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "design-1", tenant_id: "tenant-a", owner_id: "someone-else" }]);
    const patch = await PATCH(new Request("http://localhost/api/studio", { method: "PATCH", body: JSON.stringify({ id: "design-1", title: "Changed" }) }));
    expect(patch.status).toBe(404);
    mocks.query.mockResolvedValueOnce([{ id: "design-1", tenant_id: "tenant-a", owner_id: "someone-else" }]);
    const deletion = await DELETE(new Request("http://localhost/api/studio?id=design-1", { method: "DELETE" }));
    expect(deletion.status).toBe(404);
    expect(mocks.query.mock.calls.every(([sql]) => String(sql).startsWith("SELECT"))).toBe(true);
  });
});
