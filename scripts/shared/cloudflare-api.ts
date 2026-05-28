import { loadEnvFile } from "./ops";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

type CloudflareApiPayload<T = unknown> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: T;
};

export function loadCloudflareApiEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

function cloudflareErrorMessage(payload: CloudflareApiPayload, fallback: string) {
  return payload?.errors?.map((error) => error.message).join("; ") || fallback;
}

export async function cloudflareRequest<T = unknown>(method: string, path: string, body?: unknown) {
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
  const payload = (await response.json().catch(() => ({}))) as CloudflareApiPayload<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(`${method} ${path} failed: ${cloudflareErrorMessage(payload, response.statusText)}`);
  }
  return payload.result as T;
}

export async function cloudflareGetOptional<T = unknown>(path: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;

  const payload = (await response.json()) as CloudflareApiPayload<T>;
  if (!response.ok || payload.success === false) {
    throw new Error(`GET ${path} failed: ${cloudflareErrorMessage(payload, response.statusText)}`);
  }
  return payload.result as T;
}
