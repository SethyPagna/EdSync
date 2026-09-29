import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  context: vi.fn(),
  rateLimit: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: mocks.context,
  linkTenantObject: vi.fn(),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mocks.rateLimit,
  logSecurityEvent: vi.fn(),
}));
vi.mock("@/lib/storage/r2", () => ({ putR2Object: mocks.put }));

import { POST } from "./route";

describe("storage upload tenant boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "visitor", user_metadata: { role: "teacher" } });
  });

  it("rejects a signed-in outsider on an organization hostname before reading or storing a file", async () => {
    mocks.context.mockResolvedValue({ tenant: { id: "tenant-school" }, membership: null });

    const response = await POST(new Request("https://school--main.example.test/api/storage/upload", {
      method: "POST",
      body: new FormData(),
    }));

    expect(response.status).toBe(403);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("lets an active member proceed to normal upload validation", async () => {
    mocks.context.mockResolvedValue({
      tenant: { id: "tenant-school" },
      membership: { status: "active" },
    });
    mocks.rateLimit.mockResolvedValue({ allowed: true });

    const response = await POST(new Request("https://school--main.example.test/api/storage/upload", {
      method: "POST",
      body: new FormData(),
    }));

    expect(response.status).toBe(400);
    expect(mocks.rateLimit).toHaveBeenCalledOnce();
  });
});
