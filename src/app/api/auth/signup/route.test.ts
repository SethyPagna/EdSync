// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
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

function signup(code: string, role: "teacher" | "student" = "student") {
  return POST(new Request("https://edsync.test/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: "member@example.com", password: "StrongPass123!", options: { data: { full_name: "New Member", role, account_type: "organization", organization_mode: "join", organization_code: code } } }),
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
    expect(sql).toContain("teacher_invite_code') IS NOT NULL");
    expect(sql).toContain("invites_enabled");
    expect(params).toEqual(["student", "join-abcdef", "student", "join-abcdef"]);
    const payload = await response.json();
    expect(payload.data.user.user_metadata.tenant_slug).toBe("school");
    expect(mocks.batch.mock.calls[0][0].some((statement: { sql: string; params: unknown[] }) => statement.sql.includes("tenant_memberships") && statement.params[1] === "tenant-one")).toBe(true);
  });

  it("does not enroll a teacher through a public tenant slug", async () => {
    const response = await signup("legacy-school", "teacher");
    expect(response.status).toBe(404);
    expect(String(mocks.query.mock.calls[0][0])).not.toContain("lower(slug)");
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("only grants instructor membership through a teacher invitation", async () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`CREATE TABLE tenants (id TEXT, slug TEXT, name TEXT, status TEXT, settings TEXT);
        CREATE TABLE auth_users (id TEXT, email TEXT);
        INSERT INTO tenants VALUES ('tenant-one', 'school', 'School', 'active',
          '{"invite_code":"join-learners","teacher_invite_code":"teach-staff","invites_enabled":true}');`);
      mocks.query.mockImplementation(async (sql: string, params: SQLInputValue[] = []) => db.prepare(sql).all(...params));

      expect((await signup("join-learners", "teacher")).status).toBe(404);
      expect((await signup("teach-staff", "student")).status).toBe(404);
      expect(mocks.batch).not.toHaveBeenCalled();

      const response = await signup("teach-staff", "teacher");
      expect(response.status).toBe(200);
      const membership = mocks.batch.mock.calls[0][0].find((statement: { sql: string }) => statement.sql.includes("INSERT INTO tenant_memberships"));
      expect(membership.params[3]).toBe("role_instructor");
      expect((await response.json()).data.user.user_metadata.role).toBe("teacher");

      const learnerResponse = await signup("join-learners", "student");
      expect(learnerResponse.status).toBe(200);
      const learnerMembership = mocks.batch.mock.calls[1][0].find((statement: { sql: string }) => statement.sql.includes("INSERT INTO tenant_memberships"));
      expect(learnerMembership.params[3]).toBe("role_learner");

      db.exec("UPDATE tenants SET settings = json_set(settings, '$.invites_enabled', 0)");
      expect((await signup("teach-staff", "teacher")).status).toBe(404);
      expect((await signup("join-learners", "student")).status).toBe(404);
      expect(mocks.batch).toHaveBeenCalledTimes(2);
    } finally {
      db.close();
    }
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
    expect(settings.teacher_invite_code).toMatch(/^teach-[0-9a-f]{20}$/);
    expect(settings.teacher_invite_code).not.toBe(settings.invite_code);
    expect(settings.invites_enabled).toBe(true);
    expect((await response.json()).data.user.user_metadata).not.toHaveProperty("invite_code");
  });
});
