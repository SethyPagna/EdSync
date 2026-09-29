// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), context: vi.fn(), query: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/learning-events", () => ({ appendLearningEvent: vi.fn() }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", resolveTenantContext: mocks.context }));

import { GET } from "./route";

const publishedBlock = {
  id: "block-school", tenant_id: "tenant-school", owner_id: "owner-school", block_type: "text", title: "Private course block",
  data: '{"text":"School only"}', version: 1, status: "published", tags: "[]", created_at: "2026-01-01", updated_at: "2026-01-01",
};

describe("content block visibility", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "teacher-outside", user_metadata: { role: "teacher" } });
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-school" }, membership: null, portal: null });
    mocks.query.mockReset().mockResolvedValue([publishedBlock]);
  });

  it("rejects an organization outsider before fetching published blocks", async () => {
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("still returns published blocks to an active member", async () => {
    mocks.context.mockResolvedValueOnce({ tenant: { id: "tenant-school" }, membership: { status: "active" }, portal: null });

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.blocks[0].data).toEqual({ text: "School only" });
    expect(mocks.query.mock.calls[0][1]).toEqual(["tenant-school", 0, "teacher-outside"]);
  });
});
