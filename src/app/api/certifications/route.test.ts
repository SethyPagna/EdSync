// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  issue: vi.fn(),
  loadLesson: vi.fn(),
  user: { id: "teacher-a", user_metadata: { role: "teacher" } },
  tenantId: "tenant_edsync_default",
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn(async () => mocks.user) }));
vi.mock("@/lib/db/d1", () => ({ d1Query: mocks.query }));
vi.mock("@/lib/certifications/issuance", () => ({ issueEligibleCertifications: mocks.issue }));
vi.mock("@/lib/lessons/access", () => ({ loadAccessibleLesson: mocks.loadLesson }));
vi.mock("@/lib/permissions", () => ({ PERMISSIONS: { coursesPublish: "courses.publish" }, requirePermission: vi.fn(async () => undefined) }));
vi.mock("@/lib/tenancy", () => ({ DEFAULT_TENANT_ID: "tenant_edsync_default", resolveTenantContext: vi.fn(async () => ({ tenant: { id: mocks.tenantId }, portal: null, membership: { status: "active" } })) }));

import { GET, POST } from "./route";

function post(body: unknown) {
  return POST(new Request("https://edsync.test/api/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), undefined);
}

describe("certification issuance route", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue([]);
    mocks.issue.mockReset().mockResolvedValue({ issued: 0, renewed: 0, examined: 0, nextCursor: null });
    mocks.loadLesson.mockReset().mockResolvedValue({ id: "lesson-a", status: "published" });
    mocks.user.user_metadata.role = "teacher";
    mocks.tenantId = "tenant_edsync_default";
  });

  it("reconciles only the requesting learner before listing credentials", async () => {
    mocks.user.user_metadata.role = "student";
    mocks.issue.mockResolvedValueOnce({ issued: 10, renewed: 0, examined: 10, nextCursor: "rule-a\u001fstudent-010" });
    const response = await GET(new Request("https://edsync.test/api/certifications"), undefined);
    expect(response.status).toBe(200);
    expect(mocks.issue).toHaveBeenCalledWith({ tenantId: "tenant_edsync_default", studentId: "teacher-a", cursor: undefined });
    expect(mocks.issue).toHaveBeenCalledTimes(1);
    expect((await response.json()).data.nextCursor).toBe("rule-a\u001fstudent-010");
    const continued = await GET(new Request("https://edsync.test/api/certifications?cursor=rule-a%1Fstudent-010"), undefined);
    expect(continued.status).toBe(200);
    expect(mocks.issue).toHaveBeenLastCalledWith({ tenantId: "tenant_edsync_default", studentId: "teacher-a", cursor: "rule-a\u001fstudent-010" });
    expect(mocks.issue).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized learner continuation cursor", async () => {
    mocks.user.user_metadata.role = "student";
    const response = await GET(new Request(`https://edsync.test/api/certifications?cursor=${"x".repeat(501)}`), undefined);
    expect(response.status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("owner-scopes a manual issue request and returns its continuation cursor", async () => {
    mocks.query.mockResolvedValueOnce([{ course_id: "lesson-a" }]);
    mocks.issue.mockResolvedValueOnce({ issued: 3, renewed: 1, examined: 10, nextCursor: "rule-a\u001fstudent-z" });
    const response = await post({ action: "issue", id: "rule-a" });
    expect(response.status).toBe(200);
    expect((await response.json()).data.nextCursor).toBe("rule-a\u001fstudent-z");
    expect(String(mocks.query.mock.calls[0][0])).toContain("ownerId");
    expect(mocks.issue).toHaveBeenCalledWith({ tenantId: "tenant_edsync_default", ruleId: "rule-a", ownerId: "teacher-a", cursor: undefined });
  });

  it("does not issue a rule without a linked lesson", async () => {
    mocks.query.mockResolvedValueOnce([{ course_id: null }]);
    const response = await post({ action: "issue", id: "rule-a" });
    expect(response.status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("rejects a course the creator cannot manage", async () => {
    mocks.loadLesson.mockResolvedValueOnce(null);
    const response = await post({ action: "create", title: "Safety", courseId: "lesson-foreign", settings: {} });
    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
