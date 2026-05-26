import { describe, expect, it } from "vitest";
import { ALL_CLASSES_SCOPE, classScopeFromSearchParams, hasClassScope, scopedClassHref } from "./class-scope";

describe("class scope helpers", () => {
  it("reads class scope from search params with an all-classes fallback", () => {
    expect(classScopeFromSearchParams(new URLSearchParams("classId=class-1"))).toBe("class-1");
    expect(classScopeFromSearchParams(new URLSearchParams())).toBe(ALL_CLASSES_SCOPE);
    expect(classScopeFromSearchParams(null)).toBe(ALL_CLASSES_SCOPE);
  });

  it("validates all classes and known classes only", () => {
    const classes = [{ id: "class-1" }, { id: "class-2" }];

    expect(hasClassScope(classes, ALL_CLASSES_SCOPE)).toBe(true);
    expect(hasClassScope(classes, "class-2")).toBe(true);
    expect(hasClassScope(classes, "missing")).toBe(false);
  });

  it("builds scoped route hrefs without cluttering the all-classes route", () => {
    expect(scopedClassHref("/teacher/work", ALL_CLASSES_SCOPE)).toBe("/teacher/work");
    expect(scopedClassHref("/teacher/work", "class-1")).toBe("/teacher/work?classId=class-1");
  });
});
