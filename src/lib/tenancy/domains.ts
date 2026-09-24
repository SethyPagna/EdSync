import { normalizePortalDomain } from "@/lib/validation/portal";

const DNS_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A double hyphen separates two normalized slugs without ambiguity. */
export function portalSubdomain(tenantSlug: string, portalSlug: string) {
  const label = `${tenantSlug}--${portalSlug}`;
  return DNS_LABEL.test(tenantSlug) &&
    DNS_LABEL.test(portalSlug) &&
    label.length <= 63
    ? label
    : null;
}

export function portalBaseDomain(value = process.env.PORTAL_BASE_DOMAIN) {
  if (!value?.trim()) return null;
  try {
    return normalizePortalDomain(value);
  } catch {
    return null;
  }
}

export function normalizeRequestHost(value: string) {
  const host = value.trim().toLowerCase();
  if (!host || /[\s,/@\\]/.test(host)) return "";
  if (host.startsWith("["))
    return host === "[::1]" || /^\[::1\]:\d+$/.test(host) ? "::1" : "";
  return host.replace(/:\d+$/, "").replace(/\.$/, "");
}

export function portalFromHostname(
  hostname: string,
  baseDomain: string | null,
) {
  const host = normalizeRequestHost(hostname);
  if (!baseDomain || !host.endsWith(`.${baseDomain}`)) return null;
  const label = host.slice(0, -(baseDomain.length + 1));
  const parts = label.split("--");
  if (parts.length !== 2 || portalSubdomain(parts[0], parts[1]) !== label)
    return null;
  return { tenantSlug: parts[0], portalSlug: parts[1] };
}

export function portalAddress(
  tenantSlug: string,
  portalSlug: string,
  baseDomain: string | null,
) {
  const subdomain = portalSubdomain(tenantSlug, portalSlug);
  return {
    path: `/org/${encodeURIComponent(portalSlug)}?tenant=${encodeURIComponent(tenantSlug)}`,
    subdomain,
    hostname: subdomain && baseDomain ? `${subdomain}.${baseDomain}` : null,
    ready: Boolean(subdomain && baseDomain),
  };
}
