import { describe, expect, it } from "vitest";
import { adminNavItems, navGroupsForRole } from "./AppShell";

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
