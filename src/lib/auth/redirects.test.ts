import { describe, expect, it } from "vitest";
import { homeForRole, isSafeAppPath, safeNextPath } from "@/lib/auth/redirects";

describe("auth redirects", () => {
  it("returns a role-specific home path", () => {
    expect(homeForRole("admin")).toBe("/admin/dashboard");
    expect(homeForRole("teacher")).toBe("/teacher/dashboard");
    expect(homeForRole("student")).toBe("/student/dashboard");
    expect(homeForRole(null)).toBe("/auth/login");
    expect(homeForRole("unknown")).toBe("/auth/login");
  });

  it("accepts only known app-local next paths", () => {
    expect(isSafeAppPath("/catalog/course_1")).toBe(true);
    expect(isSafeAppPath("/practice?mode=quiz")).toBe(true);
    expect(isSafeAppPath("/adminx")).toBe(false);
    expect(isSafeAppPath("//evil.example")).toBe(false);
    expect(isSafeAppPath("https://evil.example")).toBe(false);
  });

  it("falls back to role home for unsafe paths", () => {
    expect(safeNextPath("/org/main", "student")).toBe("/org/main");
    expect(safeNextPath("https://evil.example", "teacher")).toBe("/teacher/dashboard");
    expect(safeNextPath("https://evil.example", null)).toBe("/auth/login");
  });
});
