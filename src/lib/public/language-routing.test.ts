import { describe, expect, it } from "vitest";
import { publicLanguageRouteWithSearch, shouldSyncPublicLanguagePath } from "./language-routing";

describe("public language routing", () => {
  it("syncs public launch and catalog paths", () => {
    expect(shouldSyncPublicLanguagePath("/")).toBe(true);
    expect(shouldSyncPublicLanguagePath("/catalog")).toBe(true);
    expect(shouldSyncPublicLanguagePath("/catalog/course-1")).toBe(true);
    expect(shouldSyncPublicLanguagePath("/org/demo")).toBe(true);
    expect(shouldSyncPublicLanguagePath("/showcase")).toBe(true);
    expect(shouldSyncPublicLanguagePath("/admin/dashboard")).toBe(false);
  });

  it("adds, replaces, and removes language query values", () => {
    expect(publicLanguageRouteWithSearch({ pathname: "/", search: "", language: "Spanish" })).toBe("/?language=Spanish");
    expect(publicLanguageRouteWithSearch({ pathname: "/catalog", search: "?q=math", language: "French" })).toBe(
      "/catalog?q=math&language=French",
    );
    expect(
      publicLanguageRouteWithSearch({
        pathname: "/showcase",
        search: "?language=Spanish&slide=practice",
        language: "English",
      }),
    ).toBe("/showcase?slide=practice");
  });
});
