// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), batch: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query, d1Batch: mocks.batch }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hash") }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => ({ allowed: true })), logSecurityEvent: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(async () => ({ token: "session", expires: new Date("2030-01-01") })),
  setSessionCookies: mocks.cookie,
  setActiveTenantCookie: mocks.cookie,
}));

import { POST } from "./route";

function signup(code: string) {
  return POST(new Request("https://edsync.test/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: "member@example.com", password: "StrongPass123!", options: { data: { full_name: "New Member", role: "student", account_type: "organization", organization_mode: "join", organization_code: code } } }),
  }));
}

describe("organization invitation signup", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.batch.mockReset().mockResolvedValue(undefined);
    mocks.cookie.mockReset();
  });

  it("uses a rotated invite code for joining but stores the real tenant slug for login", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "tenant-one", slug: "school", name: "School" }]).mockResolvedValueOnce([]);
    const response = await signup("join-abcdef");
    expect(response.status).toBe(200);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("invite_code') IS NOT NULL");
    expect(sql).toContain("invites_enabled");
    expect(params).toEqual(["join-abcdef", "join-abcdef"]);
    const payload = await response.json();
    expect(payload.data.user.user_metadata.tenant_slug).toBe("school");
    expect(mocks.batch.mock.calls[0][0].some((statement: { sql: string; params: unknown[] }) => statement.sql.includes("tenant_memberships") && statement.params[1] === "tenant-one")).toBe(true);
  });

  it("retains slug join only for legacy tenants without an invite code", async () => {
    mocks.query.mockResolvedValueOnce([{ id: "tenant-legacy", slug: "legacy-school", name: "Legacy" }]).mockResolvedValueOnce([]);
    expect((await signup("legacy-school")).status).toBe(200);
    expect(String(mocks.query.mock.calls[0][0])).toContain("invite_code') IS NULL AND lower(slug)");
  });

  it("does not write an account for a disabled or unknown invite", async () => {
    const response = await signup("invalid-code");
    expect(response.status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("gives newly created organizations a private invite code", async () => {
    const response = await POST(new Request("https://edsync.test/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email: "owner@example.com", password: "StrongPass123!", options: { data: { full_name: "Owner", role: "teacher", account_type: "organization", organization_mode: "create", organization_name: "New Academy" } } }),
    }));
    expect(response.status).toBe(200);
    const tenantWrite = mocks.batch.mock.calls[0][0].find((statement: { sql: string }) => statement.sql.includes("INSERT INTO tenants"));
    const settings = JSON.parse(tenantWrite.params[4]);
    expect(settings.invite_code).toMatch(/^join-[0-9a-f]{20}$/);
    expect(settings.invites_enabled).toBe(true);
    expect((await response.json()).data.user.user_metadata).not.toHaveProperty("invite_code");
  });
});
