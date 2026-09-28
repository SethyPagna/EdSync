// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  user: { id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "teacher" } },
  tenantId: "tenant_edsync_default",
  membership: null as null | { status: string },
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => mocks.user) }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/automation", () => ({ enqueueAutomationJob: vi.fn(async () => "job-1") }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { reportsView: "reports.view", coursesPublish: "courses.publish" },
  requirePermission: vi.fn(async () => undefined),
}));
vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: vi.fn(async () => ({ tenant: { id: mocks.tenantId }, portal: null, membership: mocks.membership })),
}));

import { GET, POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("https://edsync.test/api/automation-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined,
  );
}

describe("automation rules route", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([]);
    mocks.user.user_metadata.role = "teacher";
    mocks.tenantId = "tenant_edsync_default";
    mocks.membership = null;
  });

  it("limits default-tenant teachers to their own rules and skips tenant-wide seeding", async () => {
    const response = await GET(new Request("https://edsync.test/api/automation-rules"), undefined);
    expect(response.status).toBe(200);
    const sqls = mocks.query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((sql) => sql.includes("INSERT OR IGNORE INTO automation_rules"))).toBe(false);
    const [listSql, listParams] = mocks.query.mock.calls.at(-1) as [string, unknown[]];
    expect(listSql).toContain("AND created_by = ?");
    expect(listParams).toEqual(["tenant_edsync_default", "teacher-1"]);
  });

  it("keeps organization tenants tenant-wide for active members", async () => {
    mocks.tenantId = "tenant-school";
    mocks.membership = { status: "active" };
    await GET(new Request("https://edsync.test/api/automation-rules"), undefined);
    const [listSql] = mocks.query.mock.calls.at(-1) as [string, unknown[]];
    expect(listSql).not.toContain("created_by = ?");
  });

  it("owner-scopes non-members on an organization host and skips tenant-wide seeding", async () => {
    mocks.tenantId = "tenant-school";
    await GET(new Request("https://edsync.test/api/automation-rules"), undefined);
    const sqls = mocks.query.mock.calls.map(([sql]) => String(sql));
    expect(sqls.some((sql) => sql.includes("INSERT OR IGNORE INTO automation_rules"))).toBe(false);
    const [listSql, listParams] = mocks.query.mock.calls.at(-1) as [string, unknown[]];
    expect(listSql).toContain("AND created_by = ?");
    expect(listParams).toEqual(["tenant-school", "teacher-1"]);
  });

  it("returns 404 when deleting another owner's rule in the default tenant", async () => {
    const response = await post({ action: "delete", id: "rule-owned-by-someone-else" });
    expect(response.status).toBe(404);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("AND created_by = ?");
    expect(params).toEqual(["tenant_edsync_default", "rule-owned-by-someone-else", "teacher-1"]);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("https://edsync.test/api/automation-rules", { method: "POST", body: "{nope" }),
      undefined,
    );
    expect(response.status).toBe(400);
  });
});
