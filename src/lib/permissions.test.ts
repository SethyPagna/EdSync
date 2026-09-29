// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import type { TenantContext } from "@/lib/tenancy";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/d1", () => ({ d1Query: query }));

import { getPermissionSet, PERMISSIONS } from "./permissions";

const teacher: SessionUser = { id: "teacher-1", email: "teacher@example.com", user_metadata: { role: "teacher" } };

function context(roleProfileId: string): TenantContext {
  return {
    tenant: { id: "tenant-school" },
    portal: null,
    membership: { status: "active", role_profile_id: roleProfileId, permissions: [] },
  } as unknown as TenantContext;
}

describe("tenant teacher permissions", () => {
  beforeEach(() => query.mockReset());

  it("does not turn a learner membership into staff access because the account role is teacher", async () => {
    query.mockResolvedValueOnce([{ id: "role_learner", permissions: '["learn"]' }]);
    const permissions = await getPermissionSet(teacher, context("role_learner"));
    expect(permissions.has(PERMISSIONS.learn)).toBe(true);
    expect(permissions.has(PERMISSIONS.coursesAuthor)).toBe(false);
    expect(permissions.has(PERMISSIONS.gradesManage)).toBe(false);
    expect(permissions.has(PERMISSIONS.portalsManage)).toBe(false);
  });

  it("retains solo teacher access through the system role profile", async () => {
    query.mockResolvedValueOnce([{ id: "role_solo_teacher", permissions: '["courses.author","courses.publish","grades.manage","reports.view","learn"]' }]);
    const permissions = await getPermissionSet(teacher, context("role_solo_teacher"));
    expect(permissions.has(PERMISSIONS.coursesAuthor)).toBe(true);
    expect(permissions.has(PERMISSIONS.coursesPublish)).toBe(true);
    expect(permissions.has(PERMISSIONS.gradesManage)).toBe(true);
  });
});
