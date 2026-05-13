import { existsSync, readFileSync } from "node:fs";

const API_BASE = "https://api.cloudflare.com/client/v4";
const MANAGED_REFS = new Set([
  "edsync-edge-sensitive-paths",
  "edsync-edge-dangerous-extensions",
  "edsync-edge-high-threat-api",
  "edsync-edge-method-guard",
  "edsync-edge-auth-rate-limit",
  "edsync-edge-upload-rate-limit",
  "edsync-edge-ai-rate-limit",
  "edsync-edge-data-rate-limit",
]);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const domain = process.env.CLOUDFLARE_DOMAIN;

if (!token) {
  throw new Error("CLOUDFLARE_API_TOKEN is required.");
}

if (!zoneId || !domain) {
  throw new Error("CLOUDFLARE_ZONE_ID and CLOUDFLARE_DOMAIN are required so edge rules only target the EdSync hostname.");
}

async function cloudflare(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`${method} ${path} failed: ${message}`);
  }
  return payload.result;
}

async function getEntryPoint(phase) {
  const response = await fetch(`${API_BASE}/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`GET ${phase} entrypoint failed: ${message}`);
  }
  return payload.result;
}

function scoped(expression) {
  return `(http.host eq "${domain}" and ${expression})`;
}

function sensitivePathExpression() {
  return [
    'http.request.uri.path eq "/.env"',
    'starts_with(http.request.uri.path, "/.git")',
    'starts_with(http.request.uri.path, "/.well-known/../")',
    'starts_with(http.request.uri.path, "/wp-")',
    'starts_with(http.request.uri.path, "/wp/")',
    'starts_with(http.request.uri.path, "/wordpress")',
    'starts_with(http.request.uri.path, "/phpmyadmin")',
    'ends_with(lower(http.request.uri.path), ".sql")',
    'ends_with(lower(http.request.uri.path), ".bak")',
    'ends_with(lower(http.request.uri.path), ".old")',
    'ends_with(lower(http.request.uri.path), ".backup")',
    'ends_with(lower(http.request.uri.path), ".env")',
  ].join(" or ");
}

function dangerousExtensionExpression() {
  return [
    'ends_with(lower(http.request.uri.path), ".php")',
    'ends_with(lower(http.request.uri.path), ".phtml")',
    'ends_with(lower(http.request.uri.path), ".asp")',
    'ends_with(lower(http.request.uri.path), ".aspx")',
    'ends_with(lower(http.request.uri.path), ".jsp")',
    'ends_with(lower(http.request.uri.path), ".cgi")',
    'ends_with(lower(http.request.uri.path), ".exe")',
    'ends_with(lower(http.request.uri.path), ".dll")',
    'ends_with(lower(http.request.uri.path), ".bat")',
    'ends_with(lower(http.request.uri.path), ".cmd")',
    'ends_with(lower(http.request.uri.path), ".sh")',
    'ends_with(lower(http.request.uri.path), ".ps1")',
  ].join(" or ");
}

const customRules = [
  {
    ref: "edsync-edge-sensitive-paths",
    description: "EdSync: block probes for secrets and legacy admin files",
    expression: scoped(`(${sensitivePathExpression()})`),
    action: "block",
    enabled: true,
  },
  {
    ref: "edsync-edge-dangerous-extensions",
    description: "EdSync: block executable/script path probes",
    expression: scoped(`(${dangerousExtensionExpression()})`),
    action: "block",
    enabled: true,
  },
  {
    ref: "edsync-edge-high-threat-api",
    description: "EdSync: challenge high-risk API traffic",
    expression: scoped('(starts_with(http.request.uri.path, "/api/") and cf.threat_score gt 30 and not cf.client.bot)'),
    action: "managed_challenge",
    enabled: true,
  },
  {
    ref: "edsync-edge-method-guard",
    description: "EdSync: block unexpected HTTP methods",
    expression: scoped('(not http.request.method in {"GET" "HEAD" "POST" "OPTIONS"})'),
    action: "block",
    enabled: true,
  },
];

function rateLimitRule(ref, description, expression, requestsPerPeriod, period, mitigationTimeout) {
  return {
    ref,
    description,
    expression: scoped(expression),
    action: "block",
    action_parameters: {
      response: {
        status_code: 429,
        content: "Too many requests.",
        content_type: "text/plain",
      },
    },
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period,
      requests_per_period: requestsPerPeriod,
      mitigation_timeout: mitigationTimeout,
      requests_to_origin: true,
    },
    enabled: true,
  };
}

const rateLimitRules = [
  rateLimitRule(
    "edsync-edge-auth-rate-limit",
    "EdSync: rate limit auth attempts",
    '(http.request.method eq "POST" and http.request.uri.path in {"/api/auth/login" "/api/auth/signup"})',
    20,
    60,
    600,
  ),
  rateLimitRule(
    "edsync-edge-upload-rate-limit",
    "EdSync: rate limit uploads and extraction",
    '(http.request.method eq "POST" and http.request.uri.path in {"/api/storage/upload" "/api/content/extract"})',
    80,
    600,
    900,
  ),
  rateLimitRule(
    "edsync-edge-ai-rate-limit",
    "EdSync: rate limit AI routes",
    '(http.request.method eq "POST" and starts_with(http.request.uri.path, "/api/ai/"))',
    180,
    600,
    900,
  ),
  rateLimitRule(
    "edsync-edge-data-rate-limit",
    "EdSync: rate limit data API",
    '(http.request.method eq "POST" and http.request.uri.path eq "/api/data")',
    240,
    300,
    600,
  ),
];

async function upsertEntryPoint(phase, rules, description) {
  const entryPoint = await getEntryPoint(phase);
  const existingRules = entryPoint?.rules ?? [];
  const preservedRules = existingRules.filter((rule) => !MANAGED_REFS.has(rule.ref));
  const nextRules = [...preservedRules, ...rules];

  if (!entryPoint) {
    await cloudflare("POST", `/zones/${zoneId}/rulesets`, {
      name: `EdSync ${phase}`,
      description,
      kind: "zone",
      phase,
      rules: nextRules,
    });
    return "created";
  }

  await cloudflare("PUT", `/zones/${zoneId}/rulesets/${entryPoint.id}`, {
    ...entryPoint,
    description: entryPoint.description || description,
    rules: nextRules,
  });
  return "updated";
}

const customStatus = await upsertEntryPoint(
  "http_request_firewall_custom",
  customRules,
  "EdSync hostname-scoped custom security rules",
);
const rateStatus = await upsertEntryPoint(
  "http_ratelimit",
  rateLimitRules,
  "EdSync hostname-scoped rate limiting rules",
);

console.log(`Cloudflare security rules ${customStatus}/${rateStatus} for ${domain}.`);
