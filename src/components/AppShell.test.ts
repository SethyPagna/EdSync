import { describe, expect, it } from "vitest";
import {
  adminNavItems, shellNavDisplayLabel, shellNavGroupDisplayLabel,
  shellWorkspaceLabel, studentNavItems, teacherNavItems,
} from "./AppShell";

describe("shell navigation", () => {
  it("keeps the primary rail to six or fewer choices per role", () => {
    expect(studentNavItems).toHaveLength(6);
    expect(teacherNavItems).toHaveLength(6);
    expect(adminNavItems).toHaveLength(6);
  });

  it("uses short labels and keeps organization context visible", () => {
    expect(shellNavDisplayLabel({ label: "Courses", role: "student", workspaceContext: null })).toBe("Courses");
    expect(shellNavGroupDisplayLabel({ label: "Rules", role: "admin", workspaceContext: null })).toBe("Rules");
    expect(shellWorkspaceLabel({ role: "teacher", workspaceContext: { type: "organization", organizationName: "North Academy" }, adminViewMode: null, isAdminViewMode: false })).toBe("North Academy");
    expect(shellWorkspaceLabel({ role: "student", workspaceContext: null, adminViewMode: "organization-student", isAdminViewMode: true })).toBe("organization learner workspace");
  });
});
