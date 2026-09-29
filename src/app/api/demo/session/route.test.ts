import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.rateLimit }));
vi.mock("@/lib/auth/session", () => ({
  createSession: mocks.createSession,
  revokeSession: mocks.revokeSession,
  setSessionCookies: (response: Response, token: string) => {
    response.headers.append("Set-Cookie", `edsync_session=${token}; HttpOnly; Path=/`);
  },
  setActiveTenantCookie: (response: Response, tenantId: string) => {
    response.headers.append("Set-Cookie", `edsync_active_tenant=${tenantId}; HttpOnly; Path=/`);
  },
}));

import { POST } from "./route";

const HOST = "edsync-demo.learn-app.workers.dev";

function request(role: string, hostname = HOST, origin = `https://${hostname}`) {
  return new NextRequest(`https://${hostname}/api/demo/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
      Host: hostname,
    },
    body: new URLSearchParams({ role }),
  });
}

beforeEach(() => {
  vi.stubEnv("EDSYNC_DEMO_MODE", "1");
  vi.stubEnv("EDSYNC_DEMO_HOSTNAME", HOST);
  mocks.query.mockReset().mockResolvedValue([{ full_name: "Sample user" }]);
  mocks.createSession.mockReset().mockResolvedValue({ token: "demo-token", expires: new Date("2030-01-01T00:00:00.000Z") });
  mocks.revokeSession.mockReset().mockResolvedValue(undefined);
  mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 });
});

afterEach(() => vi.unstubAllEnvs());

describe("one-click demo session", () => {
  it("stays closed in production and on any other hostname or origin", async () => {
    vi.stubEnv("EDSYNC_DEMO_MODE", undefined);
    expect((await POST(request("student"))).status).toBe(404);
    vi.stubEnv("EDSYNC_DEMO_MODE", "1");
    expect((await POST(request("student", "edsync.learn-app.workers.dev"))).status).toBe(404);
    expect((await POST(request("student", HOST, "https://attacker.test"))).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("rejects any role other than the seeded learner or teacher", async () => {
    expect((await POST(request("admin"))).status).toBe(400);
    expect((await POST(request("creator"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    ["student", "651615e6-34a6-45b2-a3d7-9d6ab9abbdb2", "student@edsync.test", "/student/dashboard"],
    ["teacher", "7a53c3db-348e-46c4-a77a-384b24be0522", "teacher@edsync.test", "/teacher/dashboard"],
  ])("starts only the seeded %s account", async (role, id, email, destination) => {
    const response = await POST(request(role));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`https://${HOST}${destination}`);
    expect(response.headers.get("set-cookie")).toContain("edsync_session=demo-token");
    expect(mocks.query.mock.calls[0][1]).toEqual([id, email, email, role, "tenant_edsync_default"]);
    expect(mocks.createSession).toHaveBeenCalledWith({
      id,
      email,
      user_metadata: { role, full_name: "Sample user" },
    });
  });

  it("does not create a session if the seeded account is absent", async () => {
    mocks.query.mockResolvedValue([]);

    expect((await POST(request("student"))).status).toBe(503);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
