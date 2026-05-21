import { describe, expect, it } from "vitest";
import { tenantObjectJoin, tenantObjectParams, tenantObjectPredicate } from "@/lib/tenancy/object-scope";

describe("tenant object SQL scope", () => {
  it("builds a tenant object link join and predicate", () => {
    expect(
      tenantObjectJoin({
        objectTable: "classes",
        objectAlias: "c",
        linkAlias: "class_link",
      }),
    ).toContain("tenant_object_links class_link");
    expect(tenantObjectPredicate({ linkAlias: "class_link" })).toBe(
      "(class_link.tenant_id = ? OR (? = ? AND class_link.id IS NULL))",
    );
  });

  it("returns params for linked tenant rows and default legacy fallback", () => {
    expect(tenantObjectParams({ objectTable: "classes", tenantId: "tenant_1" })).toEqual([
      "classes",
      "tenant_1",
      "tenant_1",
      "tenant_edsync_default",
    ]);
  });

  it("rejects unsafe aliases", () => {
    expect(() =>
      tenantObjectJoin({
        objectTable: "classes",
        objectAlias: "c;DROP",
        linkAlias: "class_link",
      }),
    ).toThrow("Invalid SQL identifier");
  });
});
