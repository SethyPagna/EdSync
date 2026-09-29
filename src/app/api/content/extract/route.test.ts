// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), query: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: mocks.context,
  linkTenantObject: vi.fn(),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.rate, logSecurityEvent: vi.fn() }));

import { POST } from "./route";

function request() {
  return new NextRequest("https://school.edsync.test/api/content/extract", {
    method: "POST",
    body: new URLSearchParams(),
  });
}

describe("content extraction tenant boundary", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: "outsider", user_metadata: { role: "student" } } });
    mocks.context.mockReset().mockResolvedValue({ tenant: { id: "tenant-school" }, portal: null, membership: null });
    mocks.query.mockReset();
    mocks.rate.mockReset().mockResolvedValue({ allowed: true });
  });

  it("rejects an organization outsider before accepting or linking uploaded content", async () => {
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Organization membership required.");
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("continues normal file validation for an active organization member", async () => {
    mocks.context.mockResolvedValueOnce({ tenant: { id: "tenant-school" }, portal: null, membership: { status: "active" } });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("A file upload is required.");
    expect(mocks.rate).toHaveBeenCalledTimes(1);
  });
});
