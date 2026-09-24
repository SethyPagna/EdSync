import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  headers: new Map<string, string>(),
  cookies: new Map<string, { value: string }>(),
}));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("next/headers", () => ({
  headers: async () => mocks.headers,
  cookies: async () => mocks.cookies,
}));
import { resolveTenantContext } from "./index";
import { getPermissionSet } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth/session";
const user: SessionUser = {
  id: "outsider",
  email: "test@example.com",
  user_metadata: { role: "teacher" },
};

describe("hostname tenant access", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.headers.clear();
    mocks.cookies.clear();
    mocks.query.mockReset();
    mocks.headers.set("host", "academy.example.com");
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tenant_domains"))
        return [
          { id: "tenant-school", status: "active", portal_id: "portal-school" },
        ];
      if (sql.includes("FROM tenant_portals"))
        return [{ id: "portal-school", tenant_id: "tenant-school" }];
      return [];
    });
  });
  it("does not enroll a visitor or grant teacher permissions in another organization", async () => {
    const context = await resolveTenantContext(user);
    expect(context.membership).toBeNull();
    expect(
      mocks.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT OR IGNORE INTO tenant_memberships"),
      ),
    ).toBe(false);
    expect(await getPermissionSet(user, context)).toEqual(new Set());
  });
  it("ignores spoofed forwarded host headers", async () => {
    mocks.headers.set("x-forwarded-host", "attacker.example.com");
    await resolveTenantContext(user);
    const call = mocks.query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM tenant_domains"),
    );
    expect(call?.[1]).toEqual(["academy.example.com"]);
  });
  it("fails closed for an unknown managed subdomain", async () => {
    vi.stubEnv("PORTAL_BASE_DOMAIN", "example.com");
    mocks.headers.set("host", "school--missing.example.com");
    mocks.query.mockResolvedValue([]);
    await expect(resolveTenantContext(user)).rejects.toThrow(
      "Unknown organization hostname",
    );
  });
});
