import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  batch: vi.fn(),
  user: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query, d1Batch: mocks.batch }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { portalsManage: "portals.manage" },
  requirePermission: mocks.permission,
}));
vi.mock("@/lib/tenancy", () => ({
  resolveTenantContext: async () => ({
    tenant: { id: "t1", slug: "school" },
    portal: null,
  }),
}));
import { GET, POST } from "./route";
const request = (body: unknown) =>
  new Request("http://localhost/api/portals", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("portal management", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.batch.mockReset().mockResolvedValue(undefined);
    mocks.user.mockResolvedValue({ id: "owner" });
    mocks.permission.mockReset().mockResolvedValue(undefined);
  });
  it("requires management permission to reveal domain verification tokens", async () => {
    mocks.permission.mockRejectedValue(new Error("denied"));
    expect((await GET()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("does not clear defaults for a missing or foreign portal", async () => {
    expect(
      (await POST(request({ action: "make_default", id: "foreign" }))).status,
    ).toBe(404);
    expect(
      mocks.query.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE")),
    ).toBe(false);
  });
  it("changes the default in one statement", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "p1" }]);
    expect(
      (await POST(request({ action: "make_default", id: "p1" }))).status,
    ).toBe(200);
    const writes = mocks.query.mock.calls.filter(([sql]) =>
      String(sql).startsWith("UPDATE"),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toContain("CASE WHEN id = ?");
  });
  it("preserves domain verification for an unrelated edit", async () => {
    mocks.query.mockResolvedValueOnce([{ domain: "learn.example.com" }]);
    const response = await POST(
      request({
        action: "update",
        id: "p1",
        name: "New name",
        slug: "main",
        domain: "learn.example.com",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.batch).toHaveBeenCalledOnce();
    expect(mocks.batch.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.batch.mock.calls[0][0][0].sql).toContain(
      "UPDATE tenant_portals",
    );
  });
  it("reports duplicate slugs without writing", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "existing" }]);
    expect(
      (await POST(request({ action: "create", name: "Academy", slug: "main" })))
        .status,
    ).toBe(409);
    expect(
      mocks.query.mock.calls.some(([sql]) => String(sql).startsWith("INSERT")),
    ).toBe(false);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("saves a portal and its domain together", async () => {
    expect(
      (
        await POST(
          request({
            action: "create",
            name: "Academy",
            slug: "academy",
            domain: "learn.example.com",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.batch).toHaveBeenCalledOnce();
    const changes = mocks.batch.mock.calls[0][0];
    expect(changes).toHaveLength(2);
    expect(changes[0].params[0]).toBe(changes[1].params[2]);
  });
  it("deletes portal references and domains in the same batch", async () => {
    mocks.query.mockResolvedValueOnce([{ is_default: 0 }]);
    expect((await POST(request({ action: "delete", id: "p1" }))).status).toBe(
      200,
    );
    expect(mocks.batch.mock.calls[0][0]).toHaveLength(3);
  });
  it("rejects malformed JSON and unknown actions", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost/api/portals", {
            method: "POST",
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(request({ action: "typo" }))).status).toBe(400);
  });
});
