import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
import { GET } from "./route";

describe("personal course access", () => {
  beforeEach(() => {
    mocks.user.mockReset().mockResolvedValue({ id: "session-owner" });
    mocks.query.mockReset().mockResolvedValue([]);
  });
  it("requires a session before reading enrollment data", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("scopes access to the session owner and excludes expired entitlements", async () => {
    mocks.query.mockResolvedValue([
      { id: "product-1", courseId: "course-1", title: "Design" },
    ]);
    const response = await GET();
    expect(mocks.query.mock.calls[0][1]).toEqual(["session-owner"]);
    expect(mocks.query.mock.calls[0][0]).toContain("e.user_id = ?");
    expect(mocks.query.mock.calls[0][0]).toContain(
      "datetime(e.ends_at) > datetime('now')",
    );
    const payload = await response.json() as { data: { courses: unknown[] } };
    expect(payload.data.courses).toHaveLength(1);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("reports database failure instead of a misleading empty library", async () => {
    mocks.query.mockRejectedValue(new Error("D1 unavailable"));
    expect((await GET()).status).toBe(503);
  });
});
