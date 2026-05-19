import { NextResponse } from "next/server";
import { d1Query } from "@/lib/db/d1";
import { validateOrganizationCode } from "@/lib/auth/organization-code";

function readSettings(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let code: string;
  try {
    code = validateOrganizationCode(url.searchParams.get("code"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Organization code is invalid.";
    return NextResponse.json({ data: null, error: message }, { status: 400 });
  }

  const [row] = await d1Query<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    tenant_settings: string | null;
    portal_slug: string | null;
    portal_name: string | null;
    portal_audience: string | null;
  }>(
    `SELECT t.id AS tenant_id,
            t.slug AS tenant_slug,
            t.name AS tenant_name,
            t.settings AS tenant_settings,
            tp.slug AS portal_slug,
            tp.name AS portal_name,
            tp.audience AS portal_audience
       FROM tenants t
       LEFT JOIN tenant_portals tp ON tp.tenant_id = t.id AND tp.is_default = 1
      WHERE lower(t.slug) = lower(?)
        AND t.status = 'active'
      LIMIT 1`,
    [code],
  );

  if (!row) {
    return NextResponse.json({ data: null, error: "Organization was not found." }, { status: 404 });
  }

  const settings = readSettings(row.tenant_settings);
  const ssoEnabled = Boolean(settings.sso_enabled || settings.ssoEnabled);

  return NextResponse.json({
    data: {
      slug: row.tenant_slug,
      name: row.tenant_name,
      portalSlug: row.portal_slug,
      portalName: row.portal_name,
      portalAudience: row.portal_audience,
      ssoEnabled,
    },
    error: null,
  });
}
