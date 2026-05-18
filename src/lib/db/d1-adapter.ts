import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1RestResponse<T = Record<string, unknown>> = {
  success: boolean;
  errors?: { message: string }[];
  result?: Array<{ results?: T[]; meta?: { changes?: number } }>;
};

type EdSyncCloudflareEnv = CloudflareEnv & {
  EDSYNC_DB?: D1Database;
};

export type D1QueryAdapter = {
  readonly name: "binding" | "rest";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

function normalizeD1Params(params: unknown[]) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value);
    }
    return value;
  });
}

function createBindingAdapter(database: D1Database): D1QueryAdapter {
  return {
    name: "binding",
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const statement = database.prepare(sql).bind(...normalizeD1Params(params));
      const result = await statement.all<T>();
      if (!result.success) {
        throw new Error(result.error || "Cloudflare D1 binding query failed");
      }
      return result.results ?? [];
    },
  };
}

function createRestAdapter(): D1QueryAdapter {
  return {
    name: "rest",
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
      const token = process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !databaseId || !token) {
        throw new Error(
          "Missing Cloudflare D1 env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN",
        );
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql, params: normalizeD1Params(params) }),
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as D1RestResponse<T>;
      if (!response.ok || !payload.success) {
        const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
        throw new Error(message);
      }

      return payload.result?.[0]?.results ?? [];
    },
  };
}

function getBindingDatabase() {
  try {
    const context = getCloudflareContext();
    return (context.env as EdSyncCloudflareEnv).EDSYNC_DB ?? null;
  } catch {
    return null;
  }
}

export function getD1QueryAdapter(): D1QueryAdapter {
  const bindingDatabase = getBindingDatabase();
  if (bindingDatabase) return createBindingAdapter(bindingDatabase);
  return createRestAdapter();
}
