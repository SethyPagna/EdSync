import { describe, expect, it } from "vitest";
import {
  adminNavItems,
  navGroupsForRole,
  shellNavDisplayLabel,
  shellNavGroupDisplayLabel,
  shellWorkspaceLabel,
} from "./AppShell";

function labelsForGroup(groupLabel: string) {
  return navGroupsForRole("admin", adminNavItems).find((group) => group.label === groupLabel)?.items.map((item) => item.label) ?? [];
}

describe("navGroupsForRole", () => {
  it("keeps duplicate admin portal links in their intended groups", () => {
    expect(labelsForGroup("Platform")).toContain("Portals");
    expect(labelsForGroup("Platform")).not.toContain("Organizations");
    expect(labelsForGroup("Owner Views")).toContain("Organizations");
  });

  it("exposes every owner view mode from platform admin", () => {
    expect(labelsForGroup("Owner Views")).toEqual([
      "Individual Account",
      "Organizations",
      "Organization Teacher",
      "Organization Student",
    ]);
  });
});

describe("shellWorkspaceLabel", () => {
  it("uses creator and learner language for individual workspaces", () => {
    expect(shellWorkspaceLabel({
      role: "teacher",
      workspaceContext: { type: "individual" },
      adminViewMode: null,
      isAdminViewMode: false,
    })).toBe("Creator Workspace");
    expect(shellWorkspaceLabel({
      role: "student",
      workspaceContext: { type: "individual" },
      adminViewMode: null,
      isAdminViewMode: false,
    })).toBe("Learner Workspace");
  });

  it("keeps teacher and student labels scoped to organizations", () => {
    expect(shellWorkspaceLabel({
      role: "teacher",
      workspaceContext: { type: "organization", organizationCode: "edsync" },
      adminViewMode: null,
      isAdminViewMode: false,
    })).toBe("Organization Teacher");
    expect(shellWorkspaceLabel({
      role: "student",
      workspaceContext: { type: "organization", organizationCode: "edsync" },
      adminViewMode: null,
      isAdminViewMode: false,
    })).toBe("Organization Student");
  });

  it("shows owner preview labels for platform admin mode", () => {
    expect(shellWorkspaceLabel({
      role: "student",
      workspaceContext: { type: "individual" },
      adminViewMode: "organization-student",
      isAdminViewMode: true,
    })).toBe("organization student workspace");
  });
});

describe("shell nav display labels", () => {
  it("uses creator language for individual creator workspaces", () => {
    const workspaceContext = { type: "individual" as const };
    expect(shellNavDisplayLabel({ label: "Create Lesson", role: "teacher", workspaceContext })).toBe("Create Course");
    expect(shellNavDisplayLabel({ label: "Gradebook & Feedback", role: "teacher", workspaceContext })).toBe("Feedback");
    expect(shellNavDisplayLabel({ label: "Students", role: "teacher", workspaceContext })).toBe("Learners");
    expect(shellNavGroupDisplayLabel({ label: "Classroom", role: "teacher", workspaceContext })).toBe("Course Ops");
  });

  it("uses learner progress language for individual learner workspaces", () => {
    const workspaceContext = { type: "individual" as const };
    expect(shellNavDisplayLabel({ label: "Lessons", role: "student", workspaceContext })).toBe("Courses");
    expect(shellNavDisplayLabel({ label: "Teachers & Classes", role: "student", workspaceContext })).toBe("Course Access");
    expect(shellNavDisplayLabel({ label: "Grades", role: "student", workspaceContext })).toBe("Progress");
    expect(shellNavGroupDisplayLabel({ label: "Support", role: "student", workspaceContext })).toBe("Progress");
  });

  it("preserves organization role labels inside organization workspaces", () => {
    const workspaceContext = { type: "organization" as const };
    expect(shellNavDisplayLabel({ label: "Grades", role: "student", workspaceContext })).toBe("Grades");
    expect(shellNavDisplayLabel({ label: "Students", role: "teacher", workspaceContext })).toBe("Students");
    expect(shellNavGroupDisplayLabel({ label: "Classroom", role: "teacher", workspaceContext })).toBe("Classroom");
  });
});
