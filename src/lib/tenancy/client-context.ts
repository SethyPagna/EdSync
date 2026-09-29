import type { Tenant, TenantMembership, TenantPortal } from "@/types";
import type { TenantContext } from "./index";

export type ClientTenantSummary = Pick<Tenant, "id" | "slug" | "name" | "plan_tier">;

export type ClientTenantContext = {
  tenant: ClientTenantSummary;
  portal: Pick<TenantPortal, "id" | "slug" | "name" | "audience"> | null;
  membership: Pick<TenantMembership, "id" | "status" | "role_profile_id"> | null;
};

export function toClientTenantSummary(tenant: ClientTenantSummary): ClientTenantSummary {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan_tier: tenant.plan_tier,
  };
}

export function toClientTenantContext(context: TenantContext): ClientTenantContext {
  return {
    tenant: toClientTenantSummary(context.tenant),
    portal: context.portal
      ? {
          id: context.portal.id,
          slug: context.portal.slug,
          name: context.portal.name,
          audience: context.portal.audience,
        }
      : null,
    membership: context.membership
      ? {
          id: context.membership.id,
          status: context.membership.status,
          role_profile_id: context.membership.role_profile_id,
        }
      : null,
  };
}
