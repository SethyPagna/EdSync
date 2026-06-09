import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { d1Query } from "@/lib/db/d1";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(async () => ({
    id: "admin-1",
    email: "admin@example.com",
    user_metadata: { role: "admin" },
  })),
}));

vi.mock("@/lib/tenancy", () => ({
  DEFAULT_TENANT_ID: "tenant_edsync_default",
  resolveTenantContext: vi.fn(async () => ({
    tenant: { id: "tenant_edsync_default" },
    portal: null,
    membership: null,
  })),
}));

vi.mock("@/lib/db/d1", () => ({
  d1Query: vi.fn(async () => []),
}));

describe("teacher roster route", () => {
  it("qualifies class columns when tenant object links are joined", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const classQuery = vi.mocked(d1Query).mock.calls[0]?.[0] ?? "";
    expect(classQuery).toContain("SELECT c.id, c.name, c.subject, c.grade_level, c.teacher_id");
    expect(classQuery).not.toContain("SELECT id, name");
  });
});
