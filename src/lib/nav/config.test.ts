import { describe, expect, it } from "vitest";
import { canAccess, isImmersiveRoute, matchNav } from "./config";

describe("route navigation", () => {
  it("matches aliases and the most specific group tab", () => {
    const courses = matchNav("/student/classes", "student");
    expect(courses.item?.id).toBe("courses");
    expect(courses.subItem?.label).toBe("Access");
    const rules = matchNav("/admin/certifications", "admin");
    expect(rules.item?.id).toBe("rules");
    expect(rules.subItem?.label).toBe("Certifications");
    expect(matchNav("/teacher/lessons/course-1", "teacher").item?.id).toBe("studio");
  });

  it("enforces permissions and tier unless the user is a platform admin", () => {
    const item = { permission: "users.manage", plan: "enterprise" as const };
    expect(canAccess(item, { role: "teacher", permissions: ["users.manage"], planTier: "team" })).toBe(false);
    expect(canAccess(item, { role: "teacher", permissions: [], planTier: "enterprise" })).toBe(false);
    expect(canAccess(item, { role: "teacher", permissions: ["users.manage"], planTier: "enterprise" })).toBe(true);
    expect(canAccess(item, { role: "admin", permissions: [], planTier: "solo" })).toBe(true);
  });

  it("keeps only lesson detail routes immersive by pathname", () => {
    expect(isImmersiveRoute("/student/lessons/lesson-1")).toBe(true);
    expect(isImmersiveRoute("/student/lessons")).toBe(false);
    expect(isImmersiveRoute("/studio")).toBe(false);
  });
});
