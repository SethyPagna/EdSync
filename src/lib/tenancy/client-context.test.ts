import { describe, expect, it } from "vitest";
import type { TenantContext } from "./index";
import { toClientTenantContext, toClientTenantSummary } from "./client-context";

describe("client tenant context", () => {
  it.each([
    '{"invite_code":"join-secret","invites_enabled":true}',
    { invite_code: "join-secret", invites_enabled: true },
  ])("excludes private tenant settings whether D1 returns JSON text or a parsed object", (settings) => {
    const context = {
      tenant: { id: "tenant-school", slug: "school", name: "School", plan_tier: "team", settings, owner_id: "owner-private" },
      portal: { id: "portal-school", slug: "main", name: "School portal", audience: "internal", theme: { secret: "hidden" } },
      membership: { id: "membership-1", status: "active", role_profile_id: "role_learner", permissions: ["private.permission"] },
    } as unknown as TenantContext;

    expect(toClientTenantContext(context)).toEqual({
      tenant: { id: "tenant-school", slug: "school", name: "School", plan_tier: "team" },
      portal: { id: "portal-school", slug: "main", name: "School portal", audience: "internal" },
      membership: { id: "membership-1", status: "active", role_profile_id: "role_learner" },
    });
    expect(JSON.stringify(toClientTenantContext(context))).not.toMatch(/invite_code|join-secret|owner-private|private\.permission/);
  });

  it("projects list entries even when a row contains extra private columns", () => {
    const raw = { id: "tenant-school", slug: "school", name: "School", plan_tier: "team" as const, settings: '{"invite_code":"join-secret"}' };
    expect(toClientTenantSummary(raw)).toEqual({ id: "tenant-school", slug: "school", name: "School", plan_tier: "team" });
  });
});
