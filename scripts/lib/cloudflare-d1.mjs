import { loadEnvFile } from "./ops.mjs";

const D1_QUERY_API_BASE = "https://api.cloudflare.com/client/v4";

export function loadCloudflareEnv() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

export async function d1Query(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    throw new Error("Missing Cloudflare D1 env vars.");
  }

  const response = await fetch(`${D1_QUERY_API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || response.statusText);
  }
  return payload.result?.[0]?.results ?? [];
}
