// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/d1", () => ({ d1Query: query }));
import { GET } from "./route";

describe("organization invite lookup", () => {
  beforeEach(() => query.mockReset().mockResolvedValue([]));

  it("only resolves active invitations and blocks slug fallback after rotation", async () => {
    await GET(new Request("https://edsync.test/api/auth/organizations?code=join-a1b2"));
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("invites_enabled");
    expect(sql).toContain("invite_code') IS NOT NULL");
    expect(sql).toContain("invite_code') IS NULL AND lower(t.slug)");
    expect(params).toEqual(["join-a1b2", "join-a1b2"]);
  });

  it("returns the real slug for a valid invite code", async () => {
    query.mockResolvedValueOnce([{ tenant_id: "tenant-1", tenant_slug: "school", tenant_name: "School", tenant_settings: '{"invite_code":"join-secret"}', portal_slug: "main", portal_name: "School Portal", portal_audience: "internal" }]);
    const response = await GET(new Request("https://edsync.test/api/auth/organizations?code=join-secret"));
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.slug).toBe("school");
    expect(data).not.toHaveProperty("inviteCode");
  });

  it("does not reveal a disabled or unknown organization", async () => {
    const response = await GET(new Request("https://edsync.test/api/auth/organizations?code=school"));
    expect(response.status).toBe(404);
    expect((await response.json()).data).toBeNull();
  });

  it("lets the login form accept a slug without revealing tenant details", async () => {
    const response = await GET(new Request("https://edsync.test/api/auth/organizations?purpose=login&code=school"));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ slug: "school", name: "Workspace", portalSlug: null, portalName: null, ssoEnabled: false });
    expect(query).not.toHaveBeenCalled();
  });
});
