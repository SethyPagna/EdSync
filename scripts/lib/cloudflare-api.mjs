import { loadEnvFile } from "./ops.mjs";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export function loadCloudflareApiEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

function cloudflareErrorMessage(payload, fallback) {
  return payload?.errors?.map((error) => error.message).join("; ") || fallback;
}

export async function cloudflareRequest(method, path, body) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`${method} ${path} failed: ${cloudflareErrorMessage(payload, response.statusText)}`);
  }
  return payload.result;
}

export async function cloudflareGetOptional(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(`GET ${path} failed: ${cloudflareErrorMessage(payload, response.statusText)}`);
  }
  return payload.result;
}
